/// <reference types="vite/client" />

import type {
  AppStatus,
  BootstrapState,
  DictationRequest,
  FocusInfo,
  HotkeyEvent,
  UpdateSettingsInput,
} from '../shared/types';

declare global {
  interface Window {
    openWhisp: {
      platform: string;
      retryRecording: () => Promise<import('../shared/types').ProcessAudioResult>;
      discardRecording: () => Promise<void>;
      getSettings: () => Promise<import('../shared/types').AppSettings>;
      history: () => Promise<import('../shared/types').HistoryEntry[]>;
      clearHistory: () => Promise<void>;
      copyText: (text: string) => Promise<void>;
      bootstrap: () => Promise<BootstrapState>;
      updateSettings: (updates: UpdateSettingsInput) => Promise<BootstrapState>;
      chooseStorage: () => Promise<BootstrapState>;
      requestMicrophoneAccess: () => Promise<BootstrapState>;
      requestSystemAccess: () => Promise<BootstrapState>;
      prepareSpeechModel: () => Promise<BootstrapState>;
      refreshOllama: () => Promise<BootstrapState>;
      setupWriting: (level: 'soft'|'medium'|'high') => Promise<BootstrapState>;
      cancelWritingSetup: () => Promise<void>;
      pullRecommendedModel: () => Promise<BootstrapState>;
      captureFocusTarget: () => Promise<FocusInfo>;
      processAudio: (request: DictationRequest) => Promise<{
        rawText: string;
        finalText: string;
        pasted: boolean;
      }>;
      pushStatus: (status: AppStatus) => void;
      showMainWindow: () => Promise<void>;
      hideMainWindow: () => Promise<void>;
      openExternal: (targetUrl: string) => Promise<void>;
      revealStorage: () => Promise<void>;
      onStatus: (listener: (status: AppStatus) => void) => () => void;
      onHotkey: (listener: (event: HotkeyEvent) => void) => () => void;
    };
  }
}

export {};
