import { app } from 'electron';
import path from 'node:path';

import type { AppSettings, EnhancementLevel } from '../shared/types';
import {
  RECOMMENDED_TEXT_MODEL,
  RECOMMENDED_WHISPER_LABEL,
  RECOMMENDED_WHISPER_MODEL,
} from '../shared/recommendations';

export const APP_NAME = 'Undertone';

export const ENHANCEMENT_LABELS: Record<EnhancementLevel, string> = {
  none: 'No filter',
  soft: 'Soft',
  medium: 'Medium',
  high: 'High',
};

export function getDefaultStorageDirectory(): string {
  return path.join(app.getPath('userData'), 'data');
}

export function createDefaultSettings(): AppSettings {
  return {
    storageDirectory: getDefaultStorageDirectory(),
    whisperModel: RECOMMENDED_WHISPER_MODEL,
    whisperLabel: RECOMMENDED_WHISPER_LABEL,
    ollamaBaseUrl: 'http://127.0.0.1:11434',
    textModel: RECOMMENDED_TEXT_MODEL,
    styleMode: 'conversation',
    enhancementLevel: 'none',
    autoPaste: true,
    showOverlay: false,
    launchAtLogin: false,
    setupComplete: false,
    hotkey: 'F9',
    recordingMode: 'toggle',
    microphoneId: '',
    vocabulary: 'Noisewater Labs, Undertone, Stagehand, DealNight',
    keepHistory: false,
    readySound: false,
    spokenFormatting: true,
    shortPunctuationCommands: false,
    wordReplacements: [],
  };
}
