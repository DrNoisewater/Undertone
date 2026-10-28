interface OverlaySurface {
  show(isCurrent: () => boolean): Promise<void>;
  opacity(value: number): void;
  hide(): void;
}
/** Owns visibility and recovery; pending work from an older phase cannot reopen the overlay. */
export class OverlayVisibility {
  private generation = 0;
  private delay?: ReturnType<typeof setTimeout>;
  private fade?: ReturnType<typeof setInterval>;
  private recovery?: ReturnType<typeof setInterval>;
  private surface: OverlaySurface;
  constructor(surface: OverlaySurface) { this.surface = surface; }
  private clear(): void { clearTimeout(this.delay); clearInterval(this.fade); clearInterval(this.recovery); }
  private fadeOut(generation: number): void {
    let step = 0;
    this.fade = setInterval(() => {
      if (generation !== this.generation) return;
      step++;
      this.surface.opacity(Math.max(0, 1 - step / 12));
      if (step === 12) { clearInterval(this.fade); this.surface.hide(); }
    }, 25);
  }
  setPhase(phase: string): void {
    this.clear();
    const generation = ++this.generation;
    if (phase === 'starting') { this.surface.hide(); return; }
    // Completion never shows a hidden window again or delays the fade.
    if (phase === 'idle' || phase === 'done') { this.fadeOut(generation); return; }
    const active = ['listening','transcribing','rewriting','pasting'].includes(phase);
    if (!active && phase !== 'error') { this.surface.hide(); return; }
    let pending = false;
    const show = async () => {
      if (pending || generation !== this.generation) return;
      pending = true;
      try { await this.surface.show(() => generation === this.generation); }
      catch { /* A later recovery tick retries transient window failures. */ }
      finally { pending = false; }
    };
    void show();
    if (active) this.recovery = setInterval(() => { void show(); }, 750);
    else this.delay = setTimeout(() => this.fadeOut(generation), 3500);
  }
  dispose(): void { this.clear(); ++this.generation; this.surface.hide(); }
}
