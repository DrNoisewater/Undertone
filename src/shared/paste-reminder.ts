/** What the helper saw in the text field after sending Ctrl+V. */
export type PasteCheck = 'confirmed' | 'missing' | 'unknown';

export interface PasteReminder {
  /** Stays until Ctrl+V, close, a clipboard change or the next dictation; otherwise fades on its own. */
  persistent: boolean;
  title: string;
  detail: string;
  preview: string;
}

/** How long a reminder stays when Undertone cannot tell whether the paste landed. */
export const REMINDER_FADE_MS = 20_000;
/** Ctrl+V seen this soon after the card appears is Undertone's own paste, not the user's. */
const OWN_PASTE_GRACE_MS = 500;

/** Decides whether the "text still needs pasting" card is shown, and how. Null means no card. */
export function pasteReminderFor(text: string, pasted: boolean, reason: string, check: PasteCheck = 'unknown', pasteKey = 'Ctrl+V'): PasteReminder | null {
  if (!text.trim()) return null;
  if (pasted && check === 'confirmed') return null;
  const preview = text.replace(/\s+/gu, ' ').trim();
  if (pasted && check === 'missing') return {persistent: true, title: `Not pasted — press ${pasteKey}`, detail: 'The paste did not show up in your text field.', preview};
  if (pasted) return {persistent: false, title: 'Text is on the clipboard', detail: `If it did not paste, press ${pasteKey}.`, preview};
  if (reason === 'auto_paste_off') return {persistent: false, title: `Text ready — press ${pasteKey}`, detail: 'Click where you want it, then paste.', preview};
  return {persistent: true, title: `Not pasted — press ${pasteKey}`, detail: 'Click where you want it, then paste.', preview};
}

interface ReminderSurface {
  show(reminder: PasteReminder): void;
  hide(): void;
}

/** Owns when the card is up. Every way out (paste, close, clipboard change, new dictation, timeout) goes through hide. */
export class PasteReminderCard {
  private surface: ReminderSurface;
  private text = '';
  private shownAt = 0;
  private timer?: ReturnType<typeof setTimeout>;
  constructor(surface: ReminderSurface) { this.surface = surface; }

  get visible(): boolean { return this.text !== ''; }

  show(text: string, reminder: PasteReminder | null): void {
    this.hide();
    if (!reminder) return;
    this.text = text;
    this.shownAt = Date.now();
    this.surface.show(reminder);
    if (!reminder.persistent) this.timer = setTimeout(() => this.hide(), REMINDER_FADE_MS);
  }

  /** The user pressed Ctrl+V (or Shift+Insert) somewhere. */
  pasteKeyPressed(): void {
    if (this.visible && Date.now() - this.shownAt >= OWN_PASTE_GRACE_MS) this.hide();
  }

  /** Something else was copied, so Ctrl+V would no longer paste the dictation. */
  clipboardIs(current: string): void {
    // Windows may hand plain text back with CRLF line endings.
    if (this.visible && current.replace(/\r\n/gu, '\n') !== this.text.replace(/\r\n/gu, '\n')) this.hide();
  }

  hide(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (!this.visible) return;
    this.text = '';
    this.surface.hide();
  }
}
