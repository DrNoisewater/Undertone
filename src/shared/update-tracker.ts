import type { UpdateStatus } from './types';

/**
 * Turns updater events into the status shown in the app, and shows at most one
 * toast per app run, when an update has finished downloading.
 */
export class UpdateTracker {
  private status: UpdateStatus;
  private toasted = false;
  private readonly publish: (status: UpdateStatus) => void;
  private readonly toast: (version: string) => void;

  constructor(currentVersion: string, supported: boolean, publish: (status: UpdateStatus) => void, toast: (version: string) => void) {
    this.publish = publish;
    this.toast = toast;
    this.status = { state: supported ? 'idle' : 'unsupported', currentVersion };
  }

  get(): UpdateStatus { return this.status; }

  /** True when a check may start: supported, and not already checking, downloading or ready. */
  canCheck(): boolean { return ['idle', 'up-to-date', 'error'].includes(this.status.state); }

  checking(): void { if (this.canCheck()) this.set({ state: 'checking' }); }

  available(version: string): void { if (this.status.state !== 'ready') this.set({ state: 'downloading', version, percent: 0 }); }

  progress(percent: number): void {
    if (this.status.state === 'downloading') this.set({ ...this.status, percent: Math.max(0, Math.min(100, Math.round(percent))) });
  }

  notAvailable(): void { if (this.status.state !== 'ready') this.set({ state: 'up-to-date' }); }

  downloaded(version: string): void {
    this.set({ state: 'ready', version });
    if (!this.toasted) { this.toasted = true; this.toast(version); }
  }

  failed(message: string): void { if (this.status.state !== 'ready' && this.status.state !== 'unsupported') this.set({ state: 'error', message }); }

  private set(next: Omit<UpdateStatus, 'currentVersion'>): void {
    this.status = { ...next, currentVersion: this.status.currentVersion };
    this.publish(this.status);
  }
}
