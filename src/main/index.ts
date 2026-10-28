import { OverlayVisibility } from './overlay-visibility';
import { app, BrowserWindow, Menu, Tray, nativeImage, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getInitialStatus } from './dictation';
import { registerIpcHandlers } from './ipc';
import { applyLaunchAtLogin } from './login-item';
import {
  ensureNativeHelper,
  isFnListenerRunning,
  startFnListener,
  stopFnListener,
} from './native-helper';
import { getPermissionState } from './permissions';
import { loadSettings } from './settings';
import { ensureStorage } from './storage';
import { createMainWindow, createOverlayWindow, positionOverlayWindow } from './windows';
import type { AppSettings, AppStatus } from '../shared/types';

app.setName('Undertone');
const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();
app.on('second-instance', () => showMainWindow());
const projectRoot = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let overlayCreation: Promise<BrowserWindow> | null = null;
let overlayAnchor: {x:number;y:number} | undefined;
let tray: Tray | null = null;
let settings: AppSettings;
let status: AppStatus = getInitialStatus();
let helperReady = false;
let isQuitting = false;
const overlayVisibility = new OverlayVisibility({
  show: async isCurrent => {
    const window = await ensureOverlayWindow();
    if (!isCurrent() || !window || window.isDestroyed()) return;
    // Lock to the start monitor; nearest-display lookup also handles unplugged monitors.
    positionOverlayWindow(window, overlayAnchor);
    window.setAlwaysOnTop(true, 'screen-saver');
    window.setOpacity(1);
    if (!window.isVisible()) window.showInactive();
    window.moveTop();
  },
  opacity: value => { if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.setOpacity(value); },
  hide: () => { if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.hide(); },
});

function shutdown(): void {
  if (isQuitting) {
    return;
  }

  isQuitting = true;
  stopFnListener();
  overlayVisibility.dispose();
}

function broadcast(channel: string, payload: unknown): void {
  for (const window of [mainWindow, overlayWindow]) {
    if (window && !window.isDestroyed()) {
      window.webContents.send(channel, payload);
    }
  }
}

async function ensureOverlayWindow(): Promise<BrowserWindow | null> {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return overlayWindow;
  }

  if (!overlayCreation) overlayCreation = createOverlayWindow().then(window => {
    overlayWindow = window;
    attachWindowDiagnostics(window, 'overlay');
    return window;
  }).finally(() => { overlayCreation = null; });
  return overlayCreation;
}

function setStatus(nextStatus: AppStatus): void {
  if (nextStatus.phase === 'starting' || !overlayAnchor) overlayAnchor = screen.getCursorScreenPoint();
  status = nextStatus;
  broadcast('app:status', nextStatus);
  overlayVisibility.setPhase(nextStatus.phase);
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

function hideMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.hide();
}

function attachWindowDiagnostics(window: BrowserWindow, label: string): void {
  window.webContents.on('did-finish-load', () => {
    console.log(`[openwhisp] ${label} did-finish-load`);
  });

  window.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL) => {
      console.error(
        `[openwhisp] ${label} did-fail-load`,
        JSON.stringify({ errorCode, errorDescription, validatedURL }),
      );
    },
  );

  window.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[openwhisp] ${label} render-process-gone`, JSON.stringify(details));
  });

  window.on('unresponsive', () => {
    console.error(`[openwhisp] ${label} unresponsive`);
  });
}

async function ensureHotkeyListener(): Promise<void> {
  if (!helperReady || isFnListenerRunning()) {
    return;
  }

  const permissions = await getPermissionState();
  if (
    !permissions.accessibility ||
    !permissions.inputMonitoring ||
    !permissions.postEvents
  ) {
    return;
  }

  await startFnListener(
    (event) => {
      if (event.type === 'down' && ['transcribing','rewriting','pasting'].includes(status.phase)) return;
      broadcast('hotkey:event', event);

    },
    (message) => {
      setStatus({
        phase: 'error',
        title: 'Shortcut unavailable',
        detail: message,
      });
    },
    settings.hotkey,
  );
}

async function createWindows(): Promise<void> {
  mainWindow = await createMainWindow();
  attachWindowDiagnostics(mainWindow, 'main');

  mainWindow.on('ready-to-show', () => {
    showMainWindow();
  });

  mainWindow.on('close', (event) => {
    if (isQuitting) {
      return;
    }

    if (!app.isPackaged) {
      shutdown();
      return;
    }

    event.preventDefault();
    mainWindow?.hide();
  });

  showMainWindow();
}

async function bootstrap(): Promise<void> {
  settings = await loadSettings();
  await ensureStorage(settings);
  applyLaunchAtLogin(settings.launchAtLogin);

  registerIpcHandlers({
    getSettings: () => settings,
    setSettings: (nextSettings) => {
      const changed = settings.hotkey !== nextSettings.hotkey;
      settings = nextSettings;
      if (changed) { stopFnListener(); void ensureHotkeyListener(); }
    },
    getStatus: () => status,
    setStatus,
    getHelperReady: () => helperReady,
    showMainWindow,
    hideMainWindow,
    ensureHotkeyListener,
  });

  await createWindows();
  await ensureOverlayWindow();
  // Idle overlay remains hidden, including for older saved keep-visible preferences.
  createTray();

  helperReady = await ensureNativeHelper();

  await ensureHotkeyListener();
}

function getTrayIconPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'icons', process.platform === 'win32' ? 'trayWindows.png' : 'trayTemplate.png');
  }
  return path.join(projectRoot, 'build', 'icons', process.platform === 'win32' ? 'trayWindows.png' : 'trayTemplate.png');
}

function createTray(): void {
  const icon = nativeImage.createFromPath(getTrayIconPath());
  icon.setTemplateImage(process.platform === 'darwin');
  tray = new Tray(icon);
  tray.setToolTip('Undertone');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Undertone', click: () => showMainWindow() },
    { type: 'separator' },
    { label: 'Quit Undertone', click: () => { shutdown(); app.quit(); } },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => showMainWindow());
}

if (singleInstance) app.whenReady().then(bootstrap).catch(error => { console.error(error); void import('electron').then(({dialog}) => dialog.showErrorBox('Undertone could not start', String(error))); app.quit(); });

app.on('web-contents-created', (_event, contents) => {
  contents.on('console-message', (_consoleEvent, level, message) => {
    console.log(`[openwhisp:renderer:${level}] ${message}`);
  });
});

app.on('activate', () => {
  showMainWindow();
});

app.on('will-quit', () => {
  shutdown();
});

app.on('before-quit', () => {
  shutdown();
});

process.on('SIGINT', () => {
  shutdown();
  app.quit();
});

process.on('SIGTERM', () => {
  shutdown();
  app.quit();
});

process.on('exit', () => {
  stopFnListener();
});
