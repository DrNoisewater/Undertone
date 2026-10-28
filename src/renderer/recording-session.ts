/** One recording owner. Serializes shortcut events across async microphone startup. */
export interface SessionRecorder { start(): Promise<void>; stop(): Promise<string>; cancel(): void; }
export interface SessionDependencies {
  recorder: SessionRecorder;
  prepare(): Promise<'hold' | 'toggle'>;
  process(audio: string): Promise<void>;
  status(state: 'starting' | 'listening' | 'processing' | 'cancelled' | 'error', detail?: string): void;
  limitMs?: number;
}
export class RecordingSession {
  private phase: 'idle' | 'starting' | 'recording' | 'processing' = 'idle';
  private mode: 'hold' | 'toggle' = 'toggle';
  private released = false;
  private pressedAgain = false;
  private cancelled = false;
  private timer?: ReturnType<typeof setTimeout>;
  private deps: SessionDependencies;
  constructor(deps: SessionDependencies) { this.deps = deps; }
  async down(): Promise<void> {
    if (this.phase === 'recording') { if (this.mode === 'toggle') await this.finish(); return; }
    if (this.phase === 'starting') { this.pressedAgain = true; return; }
    if (this.phase !== 'idle') return;
    this.phase = 'starting'; this.cancelled = false; this.released = false; this.pressedAgain = false;
    this.deps.status('starting');
    try {
      this.mode = await this.deps.prepare();
      if (this.cancelled) return;
      await this.deps.recorder.start();
      if (this.cancelled) { this.deps.recorder.cancel(); return; }
      this.phase = 'recording';
      if ((this.released && this.mode === 'hold') || (this.pressedAgain && this.mode === 'toggle')) { await this.finish(); return; }
      this.deps.status('listening');
      this.timer = setTimeout(() => void this.finish(), this.deps.limitMs ?? 300000);
    } catch (e) {
      this.deps.recorder.cancel();
      if (!this.cancelled) this.deps.status('error', e instanceof Error ? e.message : String(e));
      this.phase = 'idle';
    } finally { if (this.phase === 'starting') this.phase = 'idle'; }
  }
  async up(): Promise<void> { this.released = true; if (this.mode === 'hold' && this.phase === 'recording') await this.finish(); }
  async finish(): Promise<void> {
    if (this.phase !== 'recording') return;
    this.phase = 'processing'; clearTimeout(this.timer);
    try { const audio = await this.deps.recorder.stop(); this.deps.status('processing'); await this.deps.process(audio); }
    catch (e) { this.deps.recorder.cancel(); this.deps.status('error', e instanceof Error ? e.message : String(e)); }
    finally { this.phase = 'idle'; }
  }
  cancel(): void {
    if (this.phase !== 'starting' && this.phase !== 'recording') return;
    this.cancelled = true; clearTimeout(this.timer); this.deps.recorder.cancel();
    if (this.phase === 'recording') this.phase = 'idle';
    this.deps.status('cancelled');
  }
  dispose(): void { this.cancelled = true; clearTimeout(this.timer); this.deps.recorder.cancel(); }
}
