/** Keep the clipboard fallback actionable without claiming SendInput verified insertion. */
export function pasteExplanation(reason: string): string {
  const messages: Record<string,string> = {
    sent: 'Paste shortcut sent to your original field. If nothing appeared, press Ctrl+V; your text is on the clipboard.',
    sent_compatible: 'Paste shortcut sent using compatible editor detection. If nothing appeared, press Ctrl+V; your text is on the clipboard.',
    auto_paste_off: 'Automatic paste is off. Click your text field and press Ctrl+V.',
    no_target: 'No original destination was captured. Click your text field and press Ctrl+V.',
    no_field: 'This editor did not expose a recognizable text field. Click where you want the text and press Ctrl+V.',
    unverified_field: 'The focused field could not be identified reliably. Click your text field and press Ctrl+V.',
    password: 'Automatic paste is disabled in password fields. Your dictation is on the clipboard.',
    disabled: 'The target field is disabled. Your text is on the clipboard.',
    read_only: 'The target field is read-only. Your text is on the clipboard.',
    window_changed: 'The active window changed while you dictated. Click your intended field and press Ctrl+V.',
    field_changed: 'The focused field changed while you dictated. Click your intended field and press Ctrl+V.',
    modifiers_held: 'A Ctrl, Alt, Shift, or Windows key was still held. Release it, then press Ctrl+V in your text field.',
    input_blocked: 'Windows did not accept the full paste shortcut. An administrator-level target app can cause this. Click your field and press Ctrl+V.',
    accessibility_unavailable: 'Windows could not inspect this editor. Click your text field and press Ctrl+V.',
    helper_unavailable: 'The paste helper could not respond. Your text is safe on the clipboard; click your field and press Ctrl+V.',
  };
  return messages[reason] ?? 'Automatic paste could not be confirmed. Click your text field and press Ctrl+V.';
}
