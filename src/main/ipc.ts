import { getRewriteTimings } from './rewrite-timings';
import { ensureWritingEngine } from './writing-setup';
import { completeWritingSetup } from '../shared/setup-flow';
import { RecoveryBuffer } from './recovery';
import { readHistory, clearHistory } from './history';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { ipcMain, shell, clipboard } from 'electron';

import type {
  AppSettings,
  AppStatus,
  BootstrapState,
  DictationRequest,
  UpdateSettingsInput,
} from '../shared/types';
import { RECOMMENDED_TEXT_MODEL } from '../shared/recommendations';
import { processDictationAudio } from './dictation';
import { applyLaunchAtLogin } from './login-item';
import { pullOllamaModel, listOllamaModels, isOllamaReachable, ensureOllamaRunning, warmOllamaModel } from './ollama';
import { getFocusInfo } from './native-helper';
import { getPermissionState, requestMicrophoneAccess, requestSystemAccess } from './permissions';
import { updateSettings as persistSettings, chooseStorageDirectory } from './settings';
import { ensureStorage } from './storage';

interface IpcDependencies {
  getSettings: () => AppSettings;
  setSettings: (settings: AppSettings) => void;
  getStatus: () => AppStatus;
  setStatus: (status: AppStatus) => void;
  getHelperReady: () => boolean;
  showMainWindow: () => void;
  hideMainWindow: () => void;
  ensureHotkeyListener: () => Promise<void>;
}

export function registerIpcHandlers(dependencies: IpcDependencies): void {
  let processing = false;
  let setupController: AbortController | undefined;
  const recovery = new RecoveryBuffer<DictationRequest>();
  let lastResult: import('../shared/types').ProcessAudioResult | undefined;
  ipcMain.handle('history:list', readHistory);
  ipcMain.handle('history:clear', clearHistory);
  ipcMain.handle('text:copy', (_event, text: string) => { if (typeof text === 'string' && text.length < 100000) clipboard.writeText(text); });
  ipcMain.handle('app:settings', () => dependencies.getSettings());
  const buildBootstrapState = async (): Promise<BootstrapState> => {
    const settings = dependencies.getSettings();
    const storage = await ensureStorage(settings);
    const permissions = await getPermissionState();
    if (permissions.accessibility && permissions.inputMonitoring && permissions.postEvents) {
      await dependencies.ensureHotkeyListener();
    }
    const ollamaReachable = settings.enhancementLevel === 'none' ? await isOllamaReachable(settings.ollamaBaseUrl) : await ensureOllamaRunning(settings.ollamaBaseUrl);
    const ollamaModels = ollamaReachable ? await listOllamaModels(settings.ollamaBaseUrl) : [];

    return {
      settings,
      permissions,
      ollamaReachable,
      ollamaModels,
      recommendedModelInstalled: ollamaModels.some(
        (model) => model.name === settings.textModel || model.name === RECOMMENDED_TEXT_MODEL,
      ),
      speechModelReady: await access(path.join(storage.models, 'ready.json')).then(() => true).catch(() => false),
      helperReady: dependencies.getHelperReady(),
      status: {...dependencies.getStatus(), canRetry: !!recovery.get()},
      lastResult,
      rewriteTimings: getRewriteTimings(settings.ollamaBaseUrl + '|' + settings.textModel),
    };
  };

  ipcMain.handle('app:bootstrap', buildBootstrapState);

  ipcMain.handle('settings:update', async (_event, updates: UpdateSettingsInput) => {
    const nextSettings = await persistSettings(dependencies.getSettings(), updates);
    await ensureStorage(nextSettings);
    applyLaunchAtLogin(nextSettings.launchAtLogin);
    dependencies.setSettings(nextSettings);
    return buildBootstrapState();
  });

  ipcMain.handle('settings:chooseStorage', async () => {
    const selected = await chooseStorageDirectory(dependencies.getSettings().storageDirectory);
    if (!selected) {
      return buildBootstrapState();
    }

    const nextSettings = await persistSettings(dependencies.getSettings(), {
      storageDirectory: selected,
    });

    await ensureStorage(nextSettings);
    dependencies.setSettings(nextSettings);
    return buildBootstrapState();
  });

  ipcMain.handle('permissions:requestMicrophone', async () => {
    await requestMicrophoneAccess();
    return buildBootstrapState();
  });

  ipcMain.handle('permissions:requestSystem', async () => {
    await requestSystemAccess();
    await dependencies.ensureHotkeyListener();
    return buildBootstrapState();
  });

  ipcMain.handle('models:prepareSpeech', async () => {
    const settings = dependencies.getSettings();
    dependencies.setStatus({
      phase: 'transcribing',
      title: 'Preparing speech model',
      detail: 'Downloading and warming the local Whisper model.',
    });

    const storage = await ensureStorage(settings);
    const { prepareTranscriber } = await import('./transcription');
    try { await prepareTranscriber(settings, storage, detail => dependencies.setStatus({phase:'transcribing', title:'Preparing speech model', detail})); } catch (error) { dependencies.setStatus({phase:'error',title:'Speech download failed',detail:String(error)}); throw error; }

    dependencies.setStatus({
      phase: 'idle',
      title: 'Ready',
      detail: 'Press your shortcut, speak, then press it again to finish.',
    });

    return buildBootstrapState();
  });

  ipcMain.handle('models:refreshOllama', buildBootstrapState);

  ipcMain.handle('models:cancelWritingSetup', () => {
    setupController?.abort();
  });
  ipcMain.handle('models:setupWriting', async (_event, level: 'soft'|'medium'|'high' = 'soft') => {
    if (!['soft','medium','high'].includes(level)) throw new Error('Choose Clean, Refine, or Polish.');
    if (setupController || processing || ['starting','listening','transcribing','rewriting','pasting'].includes(dependencies.getStatus().phase)) throw new Error('Wait for the current task to finish.');
    const controller = new AbortController(); setupController = controller;
    const settings = dependencies.getSettings();
    const progress = (detail:string) => dependencies.setStatus({phase:'rewriting',title:'Setting up writing improvements',detail});
    try {
      await completeWritingSetup({
        ensureEngine: () => ensureWritingEngine(settings.ollamaBaseUrl,controller.signal,progress),
        hasModel: async () => (await listOllamaModels(settings.ollamaBaseUrl)).some(m=>m.name===RECOMMENDED_TEXT_MODEL),
        downloadModel: () => pullOllamaModel(settings.ollamaBaseUrl,RECOMMENDED_TEXT_MODEL,progress,controller.signal),
        verify: async () => {
          progress('Checking the downloaded model…');
          if (!(await listOllamaModels(settings.ollamaBaseUrl)).some(m=>m.name===RECOMMENDED_TEXT_MODEL)) throw new Error('The writing model is not ready. Please try setup again.');
        },
        enable: async () => {
          const updated = await persistSettings(dependencies.getSettings(),{textModel:RECOMMENDED_TEXT_MODEL,enhancementLevel:level});
          dependencies.setSettings(updated);
        },
      },controller.signal);
      dependencies.setStatus({phase:'done',title:'Writing improvements are ready',detail:`${{soft:'Clean',medium:'Refine',high:'Polish'}[level]} is enabled. Change the amount of cleanup in Settings anytime.`});
      return buildBootstrapState();
    } catch(error) {
      const detail=controller.signal.aborted ? 'Setup stopped. Basic dictation is unchanged. Installed components are kept for next time.' : (error instanceof Error?error.message:String(error));
      dependencies.setStatus({phase:controller.signal.aborted?'idle':'error',title:controller.signal.aborted?'Setup stopped':'Setup needs attention',detail});
      if (!controller.signal.aborted) throw error;
      return buildBootstrapState();
    } finally { setupController=undefined; }
  });

  ipcMain.handle('models:pullRecommended', async () => {
    const settings = dependencies.getSettings();
    if (!(await isOllamaReachable(settings.ollamaBaseUrl))) {
      throw new Error(
        `Ollama is not running at ${settings.ollamaBaseUrl}. Start the Ollama app or run \`ollama serve\`, then try again.`,
      );
    }

    dependencies.setStatus({
      phase: 'rewriting',
      title: 'Downloading model',
      detail: `Pulling ${RECOMMENDED_TEXT_MODEL} from Ollama.`,
    });

    try { await pullOllamaModel(settings.ollamaBaseUrl, RECOMMENDED_TEXT_MODEL, (detail) => {
      dependencies.setStatus({
        phase: 'rewriting',
        title: 'Downloading model',
        detail,
      });
    }); } catch (error) { dependencies.setStatus({phase:'error',title:'Text download failed',detail:String(error)}); throw error; }

    dependencies.setStatus({
      phase: 'idle',
      title: 'Ready',
      detail: 'Press your shortcut, speak, then press it again to finish.',
    });

    return buildBootstrapState();
  });

  ipcMain.handle('dictation:captureTarget', async () => {
    // Recording is starting: load the writing model while the user speaks. Failures surface later in the rewrite step.
    const settings = dependencies.getSettings();
    if (settings.enhancementLevel !== 'none') void warmOllamaModel(settings.ollamaBaseUrl, settings.textModel).catch(() => {});
    return getFocusInfo();
  });

  const run = async (request: DictationRequest, retry = false) => {
    if (setupController) throw new Error('Wait for writing setup to finish or stop setup first.');
    if (processing) throw new Error('Still finishing your previous recording. Please wait a moment.');
    if (typeof request?.wavBase64 !== 'string' || request.wavBase64.length > 27000000) throw new Error('This recording could not be read. Please try again.');
    processing = true;
    let textReady: import('../shared/types').ProcessAudioResult | undefined;
    recovery.clear();
    try {
      const result = await processDictationAudio({
        wavBase64: request.wavBase64,
        settings: {...dependencies.getSettings(), ...(retry ? {autoPaste:false} : {})},
        targetFocus: retry ? undefined : request.targetFocus,
        setStatus: dependencies.setStatus,
        onTextReady: result => {textReady = result; lastResult = result;},
      });
      lastResult = result;
      return result;
    } catch (error) {
      recovery.keep(request);
      dependencies.setStatus({phase:'error', title:'Your recording is safe for now', detail:'We could not finish that recording. Retry without speaking again, or discard it. It is kept only in memory for up to 10 minutes.', canRetry:true, preview:textReady?.finalText, rawText:textReady?.rawText});
      throw error;
    } finally { processing = false; }
  };
  ipcMain.handle('dictation:processAudio', (_event, request: DictationRequest) => run(request));
  ipcMain.handle('dictation:retry', () => {
    const saved = recovery.get();
    if (!saved) {
      dependencies.setStatus({phase:'idle',title:'Ready',detail:'The temporary recording has expired. You can start a new one.'});
      throw new Error('That temporary recording has expired. Please record again.');
    }
    return run(saved, true);
  });
  ipcMain.handle('dictation:discard', () => {
    if (processing) throw new Error('Please wait for the current recording to finish.');
    recovery.clear();
    dependencies.setStatus({phase:'idle',title:'Recording discarded',detail:'Ready for your next thought.'});
  });

  ipcMain.on('dictation:status', (_event, status: AppStatus) => {
    dependencies.setStatus({...status, canRetry: !!recovery.get()});
  });

  ipcMain.handle('system:showMainWindow', () => {
    dependencies.showMainWindow();
  });

  ipcMain.handle('system:hideMainWindow', () => {
    dependencies.hideMainWindow();
  });

  ipcMain.handle('system:openExternal', async (_event, targetUrl: string) => {
    if (!['https://ollama.com/download', 'ms-settings:privacy-microphone'].includes(targetUrl)) throw new Error('This link is not allowed.');
    await shell.openExternal(targetUrl);
  });

  ipcMain.handle('system:revealStorage', async () => {
    await shell.openPath(dependencies.getSettings().storageDirectory);
  });
}
