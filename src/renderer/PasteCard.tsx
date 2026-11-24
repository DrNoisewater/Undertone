import { useEffect, useState } from 'react';

import { Mark } from './App';
import type { PasteReminder } from '../shared/paste-reminder';

/** Floating reminder that the dictation is on the clipboard and still needs pasting. */
export function PasteCard() {
  const [reminder, setReminder] = useState<PasteReminder | null>(null);
  useEffect(() => {
    const api = window.openWhisp;
    const unsubscribe = api.onPasteCard(setReminder);
    // The first reminder can arrive before this listener exists.
    void api.getPasteCard().then(current => { if (current) setReminder(old => old ?? current); }).catch(() => {});
    return unsubscribe;
  }, []);
  if (!reminder) return null;
  return <div className={'paste-card' + (reminder.persistent ? ' persistent' : '')} role="status">
    <Mark />
    <div>
      <strong>{reminder.title}</strong>
      <span>{reminder.detail}</span>
      <em>“{reminder.preview}”</em>
    </div>
    <button type="button" aria-label="Dismiss" title="Dismiss" onClick={() => void window.openWhisp.dismissPasteCard()}>×</button>
  </div>;
}
