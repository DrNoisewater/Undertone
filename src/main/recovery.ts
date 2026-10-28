/** Failed audio is memory-only, explicitly discardable, and expires after ten minutes. */
export class RecoveryBuffer<T> {
  private value?: T;
  private timer?: ReturnType<typeof setTimeout>;
  private ttlMs: number;
  constructor(ttlMs = 600000) { this.ttlMs = ttlMs; }
  keep(value: T): void {
    this.clear(); this.value = value;
    this.timer = setTimeout(() => this.clear(), this.ttlMs);
    this.timer.unref?.();
  }
  get(): T | undefined { return this.value; }
  clear(): void { clearTimeout(this.timer); this.value = undefined; }
}
