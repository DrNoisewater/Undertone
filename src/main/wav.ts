export function decodePcm16Wave(buffer: Buffer): Float32Array {
  if (buffer.length < 44 || buffer.length > 20_000_000) throw new Error('Invalid recording size.');
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  const readTag = (offset: number) =>
    String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3),
    );

  if (readTag(0) !== 'RIFF' || readTag(8) !== 'WAVE') {
    throw new Error('Undertone received an invalid WAV recording.');
  }

  let offset = 12;
  let audioFormat = 0;
  let channels = 0;
  let bitsPerSample = 0;
  let dataOffset = 0;
  let dataSize = 0;

  while (offset + 8 <= view.byteLength) {
    const chunkId = readTag(offset);
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkDataOffset = offset + 8;
    if (chunkDataOffset + chunkSize > view.byteLength) throw new Error('Truncated WAV data.');

    if (chunkId === 'fmt ') {
      if (chunkSize < 16 || view.getUint32(chunkDataOffset + 4, true) !== 16000) throw new Error('Expected 16 kHz PCM audio.');
      audioFormat = view.getUint16(chunkDataOffset, true);
      channels = view.getUint16(chunkDataOffset + 2, true);
      bitsPerSample = view.getUint16(chunkDataOffset + 14, true);
    }

    if (chunkId === 'data') {
      dataOffset = chunkDataOffset;
      dataSize = chunkSize;
      break;
    }

    offset += 8 + chunkSize + (chunkSize % 2);
  }

  if (audioFormat !== 1 || channels !== 1 || bitsPerSample !== 16 || dataOffset === 0 || dataSize % 2 !== 0) {
    throw new Error('Undertone expected a mono 16-bit PCM WAV recording.');
  }

  const sampleCount = dataSize / 2;
  const audio = new Float32Array(sampleCount);

  for (let index = 0; index < sampleCount; index += 1) {
    const value = view.getInt16(dataOffset + index * 2, true);
    audio[index] = Math.max(-1, value / 0x8000);
  }

  return audio;
}

