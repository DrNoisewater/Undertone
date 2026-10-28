import { contextBridge, ipcRenderer } from 'electron';

import type {
  AppStatus,
  BootstrapState,
  DictationRequest,
  FocusInfo,
  HotkeyEvent,
  UpdateSettingsInput,
} from '../shared/types';

const api = {
  platform: process.platform,
  retryRecording: () => ipcRenderer.invoke('dictation:retry'),
  discardRecording: () => ipcRenderer.invoke('dictation:discard'),
  getSettings: () => ipcRenderer.invoke('app:settings'),
  history: () => ipcRenderer.invoke('history:list'),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  copyText: (text: string) => ipcRenderer.invoke('text:copy', text),
  bootstrap: () => ipcRenderer.invoke('app:bootstrap') as Promise<BootstrapState>,
  updateSettings: (updates: UpdateSettingsInput) =>
    ipcRenderer.invoke('settings:update', updates) as Promise<BootstrapState>,
  chooseStorage: () => ipcRenderer.invoke('settings:chooseStorage') as Promise<BootstrapState>,
  requestMicrophoneAccess: () =>
    ipcRenderer.invoke('permissions:requestMicrophone') as Promise<BootstrapState>,
  requestSystemAccess: () =>
    ipcRenderer.invoke('permissions:requestSystem') as Promise<BootstrapState>,
  prepareSpeechModel: () =>
    ipcRenderer.invoke('models:prepareSpeech') as Promise<BootstrapState>,
  refreshOllama: () => ipcRenderer.invoke('models:refreshOllama') as Promise<BootstrapState>,
  setupWriting: (level: 'soft'|'medium'|'high') => ipcRenderer.invoke('models:setupWriting',level) as Promise<BootstrapState>,
  cancelWritingSetup: () => ipcRenderer.invoke('models:cancelWritingSetup'),
  pullRecommendedModel: () =>
    ipcRenderer.invoke('models:pullRecommended') as Promise<BootstrapState>,
  captureFocusTarget: () =>
    ipcRenderer.invoke('dictation:captureTarget') as Promise<FocusInfo>,
  processAudio: (request: DictationRequest) =>
    ipcRenderer.invoke('dictation:processAudio', request) as Promise<{
      rawText: string;
      finalText: string;
      pasted: boolean;
    }>,
  pushStatus: (status: AppStatus) => ipcRenderer.send('dictation:status', status),
  showMainWindow: () => ipcRenderer.invoke('system:showMainWindow'),
  hideMainWindow: () => ipcRenderer.invoke('system:hideMainWindow'),
  openExternal: (targetUrl: string) => ipcRenderer.invoke('system:openExternal', targetUrl),
  revealStorage: () => ipcRenderer.invoke('system:revealStorage'),
  onStatus: (listener: (status: AppStatus) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, status: AppStatus) => listener(status);
    ipcRenderer.on('app:status', wrapped);
    return () => ipcRenderer.removeListener('app:status', wrapped);
  },
  onHotkey: (listener: (event: HotkeyEvent) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, event: HotkeyEvent) => listener(event);
    ipcRenderer.on('hotkey:event', wrapped);
    return () => ipcRenderer.removeListener('hotkey:event', wrapped);
  },
};

contextBridge.exposeInMainWorld('openWhisp', api);
