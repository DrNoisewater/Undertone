export type EnhancementLevel = 'none' | 'soft' | 'medium' | 'high';
export type StyleMode = 'conversation' | 'vibe-coding';

export type OverlayPhase =
  | 'idle'
  | 'starting'
  | 'listening'
  | 'transcribing'
  | 'rewriting'
  | 'pasting'
  | 'done'
  | 'error';

export interface AppSettings {
  storageDirectory: string;
  whisperModel: string;
  whisperLabel: string;
  ollamaBaseUrl: string;
  textModel: string;
  styleMode: StyleMode;
  enhancementLevel: EnhancementLevel;
  autoPaste: boolean;
  showOverlay: boolean;
  launchAtLogin: boolean;
  setupComplete: boolean;
  hotkey: string;
  recordingMode: 'hold' | 'toggle';
  microphoneId: string;
  vocabulary: string;
  keepHistory: boolean;
  readySound: boolean;
  spokenFormatting: boolean;
  shortPunctuationCommands: boolean;
  wordReplacements: import("./text-tools").WordReplacement[];
}

export interface PermissionsState {
  microphone: 'granted' | 'denied' | 'restricted' | 'not-determined' | 'unknown';
  accessibility: boolean;
  inputMonitoring: boolean;
  postEvents: boolean;
}

export interface OllamaModelInfo {
  name: string;
  size: number;
  modifiedAt?: string;
}

export interface FocusInfo {
  canPaste: boolean;
  windowHandle?: string;
  focusToken?: string;
  fieldSignature?: string;
  reason?: string;
  role?: string;
  appName?: string;
  bundleIdentifier?: string;
  processIdentifier?: number;
}

export interface AppStatus {
  phase: OverlayPhase;
  title: string;
  detail: string;
  preview?: string;
  rawText?: string;
  rewriteTimings?: import('./rewrite-timing').RewriteTiming[];
  canRetry?: boolean;
  recordingStartedAt?: number;
}

export interface BootstrapState {
  settings: AppSettings;
  permissions: PermissionsState;
  ollamaReachable: boolean;
  ollamaModels: OllamaModelInfo[];
  recommendedModelInstalled: boolean;
  speechModelReady: boolean;
  helperReady: boolean;
  status: AppStatus;
  rewriteTimings?: import('./rewrite-timing').RewriteTiming[];
  lastResult?: ProcessAudioResult;
}

export interface ProcessAudioResult {
  rawText: string;
  finalText: string;
  pasted: boolean;
  pasteReason?: string;
  focusInfo?: FocusInfo;
}

export interface DictationRequest {
  wavBase64: string;
  targetFocus?: FocusInfo;
}

export interface HotkeyEvent {
  type: 'down' | 'up' | 'cancel';
}

export interface UpdateSettingsInput {
  styleMode?: StyleMode;
  enhancementLevel?: EnhancementLevel;
  textModel?: string;
  ollamaBaseUrl?: string;
  storageDirectory?: string;
  autoPaste?: boolean;
  showOverlay?: boolean;
  launchAtLogin?: boolean;
  setupComplete?: boolean;
  hotkey?: string;
  recordingMode?: 'hold' | 'toggle';
  microphoneId?: string;
  vocabulary?: string;
  keepHistory?: boolean;
  readySound?: boolean;
  spokenFormatting?: boolean;
  shortPunctuationCommands?: boolean;
  wordReplacements?: import("./text-tools").WordReplacement[];
}

export interface HistoryEntry extends ProcessAudioResult { id: string; createdAt: string; }
