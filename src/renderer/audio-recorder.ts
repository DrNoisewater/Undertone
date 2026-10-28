function mergeChunks(chunks: Float32Array[]): Float32Array {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const merged = new Float32Array(length);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}

function resample(input: Float32Array, inputSampleRate: number, outputSampleRate: number): Float32Array {
  if (inputSampleRate === outputSampleRate) {
    return input;
  }

  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    const position = index * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, input.length - 1);
    const weight = position - left;
    output[index] = input[left] * (1 - weight) + input[right] * weight;
  }

  return output;
}

function encodeWave(audio: Float32Array, sampleRate: number): string {
  const bytesPerSample = 2;
  const dataLength = audio.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  const writeTag = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeTag(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeTag(8, 'WAVE');
  writeTag(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeTag(36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (const sample of audio) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

export class AudioRecorder {
  deviceId = '';
  onInterrupted: (() => void) | null = null;
  private generation = 0;
  private abortStartup: ((error: Error) => void) | null = null;
  onLevel: ((level: number) => void) | null = null;

  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private silenceNode: GainNode | null = null;
  private chunks: Float32Array[] = [];
  private inputSampleRate = 48_000;

  private async ensureStream(generation: number): Promise<MediaStream> {
    if (this.stream) {
      return this.stream;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        ...(this.deviceId ? {deviceId: {exact: this.deviceId}} : {}),
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    if (generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); throw new Error('Recording cancelled.'); }
    this.stream = stream;
    for (const track of stream.getTracks()) track.onended = () => this.onInterrupted?.();
    return stream;
  }

  async start(): Promise<void> {
    if (this.audioContext) {
      return;
    }

    const generation = ++this.generation;
    const stream = await this.ensureStream(generation);
    this.audioContext = new AudioContext();
    this.inputSampleRate = this.audioContext.sampleRate;
    this.source = this.audioContext.createMediaStreamSource(stream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.silenceNode = this.audioContext.createGain();
    this.silenceNode.gain.value = 0;
    this.chunks = [];

    // Retain the first delivered buffer before announcing readiness.
    let timeout: ReturnType<typeof setTimeout>;
    const firstBuffer = new Promise<void>((resolve, reject) => {
      this.abortStartup = reject;
      timeout = setTimeout(() => reject(new Error('The microphone did not become ready. Check its connection and try again.')), 8000);
      this.processor!.onaudioprocess = (event) => {
        if (generation !== this.generation) return;
        const track = stream.getAudioTracks()[0];
        if (!track || track.readyState !== 'live' || track.muted) return;
        const data = event.inputBuffer.getChannelData(0);
        if (!data.length) return;
        this.chunks.push(new Float32Array(data));
        resolve();
        if (this.onLevel) {
          let sum = 0;
          for (const sample of data) sum += sample * sample;
          this.onLevel(Math.min(1, Math.sqrt(sum / data.length) * 5));
        }
      };
    });
    void firstBuffer.catch(() => {});
    try {
      this.source.connect(this.processor);
      this.processor.connect(this.silenceNode);
      this.silenceNode.connect(this.audioContext.destination);
      await Promise.all([this.audioContext.resume(), firstBuffer]);
      if (generation !== this.generation) throw new Error('Recording cancelled.');
    } catch (error) {
      this.cancel();
      throw error;
    } finally {
      clearTimeout(timeout!);
      this.abortStartup = null;
    }
  }

  playReadySound(samples: Float32Array, sampleRate: number): void {
    const context = this.audioContext;
    if (!context || context.state !== 'running') return;
    try {
      const buffer = context.createBuffer(1, samples.length, sampleRate);
      buffer.getChannelData(0).set(samples);
      const sound = context.createBufferSource();
      sound.buffer = buffer;
      sound.connect(context.destination);
      sound.onended = () => sound.disconnect();
      sound.start();
    } catch { /* Sound is optional; audio capture must continue. */ }
  }

  cancel(): void {
    this.generation++;
    this.abortStartup?.(new Error('Recording cancelled.'));
    this.abortStartup = null;
    if (this.processor) this.processor.onaudioprocess = null;
    this.processor?.disconnect(); this.source?.disconnect(); this.silenceNode?.disconnect();
    void this.audioContext?.close().catch(() => {});
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null; this.audioContext = null; this.processor = null; this.source = null; this.silenceNode = null; this.chunks = [];
  }

  async stop(): Promise<string> {
    if (!this.audioContext || !this.processor || !this.source || !this.silenceNode) {
      throw new Error('The recorder is not running.');
    }

    const context = this.audioContext;
    const chunks = this.chunks;
    const sampleRate = this.inputSampleRate;
    this.processor.disconnect(); this.source.disconnect(); this.silenceNode.disconnect();
    this.processor.onaudioprocess = null;
    this.stream?.getTracks().forEach(track => track.stop());
    this.generation++;
    this.stream = null; this.audioContext = null; this.processor = null; this.source = null; this.silenceNode = null; this.chunks = [];
    await context.close().catch(() => {});
    const merged = mergeChunks(chunks);

    if (merged.length < sampleRate * 0.15) {
      throw new Error('The recording was too short.');
    }

    const resampled = resample(merged, sampleRate, 16_000);
    return encodeWave(resampled, 16_000);
  }
}
