import { getRewriteTimings, recordRewriteTiming } from './rewrite-timings';
import { pasteExplanation } from '../shared/paste-feedback';
import { pasteReminderFor, type PasteCheck, type PasteReminder } from '../shared/paste-reminder';
import { keepsSpeakerWords, prepareDictationText } from '../shared/text-tools';
import { clipboard } from 'electron';

import type { AppSettings, AppStatus, FocusInfo, ProcessAudioResult } from '../shared/types';
import { getEnhancementPrompt, getEnhancementTask } from './prompts';
import { rewriteWithOllama } from './ollama';
import { triggerPaste } from './native-helper';
import { addHistory } from './history';
import { ensureStorage } from './storage';

interface ProcessDictationOptions {
  wavBase64: string;
  settings: AppSettings;
  targetFocus?: FocusInfo;
  setStatus: (status: AppStatus) => void;
  onTextReady?: (result: ProcessAudioResult) => void;
  onPasteFinished?: (text: string, reminder: PasteReminder | null) => void;
}

function createIdleStatus(): AppStatus {
  return {
    phase: 'idle',
    title: 'Ready',
    detail: 'Use your shortcut to dictate into a text field.',
  };
}

export async function processDictationAudio({
  wavBase64,
  settings,
  targetFocus,
  setStatus,
  onTextReady,
  onPasteFinished,
}: ProcessDictationOptions): Promise<ProcessAudioResult> {
  const storage = await ensureStorage(settings);

  setStatus({
    phase: 'transcribing',
    title: 'Transcribing',
    detail: `${settings.whisperLabel} is turning your voice into text.`,
  });

  const { transcribeRecording } = await import('./transcription');
  const rawText = await transcribeRecording(wavBase64, settings, storage);
  if (!rawText) {
    setStatus({
      phase: 'error',
      title: 'Nothing heard',
      detail: 'Undertone did not detect enough speech to transcribe.',
    });
    throw new Error('No speech was detected in the recording.');
  }

  if (settings.enhancementLevel !== 'none') setStatus({
    phase: 'rewriting',
    title: {soft:'Cleaning up',medium:'Refining',high:'Polishing'}[settings.enhancementLevel],
    detail: `${settings.textModel} is applying the selected rewrite level. The first request can take a moment while Ollama warms the model.`,
    preview: rawText,
    rawText,
  });

  const {finalText, usedRewriteFallback} = await prepareDictationText(rawText, settings,
    settings.enhancementLevel === 'none' ? undefined : async text => {
      const level = settings.enhancementLevel as 'soft'|'medium'|'high';
      const candidate = await rewriteWithOllama(
        settings.ollamaBaseUrl,
        settings.textModel,
        getEnhancementPrompt(settings.styleMode, level) + '\nPreserve every line break and paragraph break in the input.\nPreserve names and spelling from this vocabulary when relevant: ' + settings.vocabulary,
        getEnhancementTask(level, text),
        text,
        (seconds,loadSeconds) => recordRewriteTiming(settings.ollamaBaseUrl + '|' + settings.textModel, {level,seconds,loadSeconds,words:text.trim().split(/\s+/u).length}),
      );
      // Fall back to the speaker's own words rather than paste a rewrite that lost or invented content.
      if (!keepsSpeakerWords(text, candidate, level)) throw new Error('Rewrite drifted too far from what was said.');
      return candidate;
    },
  );

  onTextReady?.({rawText, finalText, pasted:false, focusInfo:targetFocus});
  clipboard.writeText(finalText);

  let pasted = false;
  let pasteCheck: PasteCheck = 'unknown';
  const focusInfo = targetFocus;
  let pasteReason = settings.autoPaste ? 'no_target' : 'auto_paste_off';

  if (settings.autoPaste) {
    setStatus({
      phase: 'pasting',
      title: 'Pasting',
      detail: 'Sending the polished text to the active app.',
      preview: finalText,
      rawText,
    });

    const outcome = await triggerPaste(targetFocus, finalText);
    pasted = outcome.ok; pasteReason = outcome.reason; pasteCheck = outcome.verified;
  }

  setStatus({
    phase: 'done',
    rewriteTimings: getRewriteTimings(settings.ollamaBaseUrl + '|' + settings.textModel),
    title: pasted ? (pasteCheck === 'confirmed' ? 'Pasted' : pasteCheck === 'missing' ? 'Paste did not land — press Ctrl+V' : 'Paste sent') : 'Copied — paste manually',
    detail: pasteExplanation(pasteReason).replaceAll('Ctrl+V', process.platform === 'darwin' ? 'Command+V' : 'Ctrl+V') + (usedRewriteFallback ? ' Your original wording was used because polishing was unavailable, changed formatting, or drifted from what you said.' : ''),
    preview: finalText,
    rawText,
  });
  onPasteFinished?.(finalText, pasteReminderFor(finalText, pasted, pasteReason, pasteCheck, process.platform === 'darwin' ? 'Command+V' : 'Ctrl+V'));

  const result = {
    rawText,
    finalText,
    pasted,
    pasteReason,
    pasteCheck,
    focusInfo,
  };
  if (settings.keepHistory) await addHistory(result).catch(() => {});
  return result;
}

export function getInitialStatus(): AppStatus {
  return createIdleStatus();
}
