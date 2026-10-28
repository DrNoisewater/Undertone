import { fileURLToPath } from 'node:url';

import path from 'node:path';
import { app, BrowserWindow, screen } from 'electron';

const preloadPath = fileURLToPath(new URL('../preload/index.cjs', import.meta.url));
const rendererFilePath = fileURLToPath(new URL('../renderer/index.html', import.meta.url));
const overlayWidth = 352;
const overlayHeight = 92;

function getRendererEntry(hash = ''): string {
  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (rendererUrl) {
    return hash ? `${rendererUrl.replace(/\/$/, '')}/#${hash}` : rendererUrl;
  }

  return rendererFilePath + (hash ? `#${hash}` : '');
}

async function loadRendererWindow(window: BrowserWindow, hash = ''): Promise<void> {
  const rendererUrl = process.env.ELECTRON_RENDERER_URL;

  if (rendererUrl) {
    await window.loadURL(getRendererEntry(hash));
    return;
  }

  await window.loadFile(rendererFilePath, {
    hash,
  });
}

export async function createMainWindow(): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    width: 1060,
    height: 720,
    minWidth: 800,
    minHeight: 520,
    show: false,
    backgroundColor: '#151719',
    title: 'Undertone — Noisewater Labs',
    icon: app.isPackaged ? path.join(process.resourcesPath, 'icons', process.platform === 'win32' ? 'icon.ico' : 'icon.png') : fileURLToPath(new URL('../../build/icons/icon.ico', import.meta.url)),
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: {
      x: 18,
      y: 18,
    },
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });

  await loadRendererWindow(window);
  return window;
}

export function positionOverlayWindow(window: BrowserWindow, anchor = screen.getCursorScreenPoint()): void {
  const display = screen.getDisplayNearestPoint(anchor);
  const workArea = display.workArea;
  const margin = 24;

  const x = workArea.x + Math.round((workArea.width - overlayWidth) / 2);
  const y = workArea.y + workArea.height - overlayHeight - margin;

  window.setBounds({ x, y, width: overlayWidth, height: overlayHeight });
}

export async function createOverlayWindow(): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    width: overlayWidth,
    height: overlayHeight,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });

  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  window.setAlwaysOnTop(true, 'screen-saver');
  window.setIgnoreMouseEvents(true);
  positionOverlayWindow(window);

  await loadRendererWindow(window, 'overlay');

  return window;
}
