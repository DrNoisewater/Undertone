import type { FocusInfo } from './types';
// Positively unsafe targets. Anything else in the same window gets the paste, the same as pressing Ctrl+V yourself.
const BLOCKING = new Set(['password', 'disabled', 'read_only', 'accessibility_unavailable']);
/**
 * Returns why paste must not be sent, or null to send it.
 * Chromium-based apps (Claude, ChatGPT, browsers) build their accessibility tree only after the first
 * query, so the field captured at recording start is often unidentified. That must not block paste
 * when the same window is still in front; a verified field that changed to another verified field still does.
 */
export function checkPasteTarget(original: FocusInfo | undefined, current: FocusInfo): string | null {
  if (!original) return 'no_target';
  if (original.reason === 'password') return 'password';
  if (current.processIdentifier !== original.processIdentifier || current.windowHandle !== original.windowHandle) return 'window_changed';
  if (!current.canPaste && BLOCKING.has(current.reason ?? '')) return current.reason!;
  if (!current.canPaste || !original.canPaste || !original.focusToken) return null;
  if (original.focusToken === current.focusToken) return null;
  if (original.fieldSignature && original.fieldSignature === current.fieldSignature) return null;
  return 'field_changed';
}
