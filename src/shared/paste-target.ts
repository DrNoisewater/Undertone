import type { FocusInfo } from './types';
export function checkPasteTarget(original: FocusInfo | undefined, current: FocusInfo): string | null {
  if (!original) return 'no_target';
  if (!original.canPaste) return original.reason || 'no_field';
  if (current.processIdentifier !== original.processIdentifier || current.windowHandle !== original.windowHandle) return 'window_changed';
  if (!current.canPaste) return current.reason || 'no_field';
  if (original.focusToken && original.focusToken === current.focusToken) return null;
  if (original.fieldSignature && original.fieldSignature === current.fieldSignature) return null;
  return 'field_changed';
}
