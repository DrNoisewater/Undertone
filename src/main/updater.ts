import { app, Notification } from 'electron';
import electronUpdater from 'electron-updater';

import { UpdateTracker } from '../shared/update-tracker';
import type { UpdateStatus } from '../shared/types';

// electron-updater is CommonJS; its named exports are not visible to ESM imports.
const { autoUpdater } = electronUpdater;

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const FIRST_CHECK_DELAY_MS = 30_000;

let tracker: UpdateTracker | null = null;

const errorMessage = (error: unknown) => String((error as Error)?.message ?? error);

/**
 * Checks GitHub Releases for a newer installer, downloads it in the background,
 * and installs it the next time Undertone quits. Only runs in the installed Windows app.
 * onStatus feeds the in-app update status; a single toast is shown when an update is ready.
 */
export function startAutoUpdates(onStatus: (status: UpdateStatus) => void, onToastClick: () => void): void {
  const supported = app.isPackaged && process.platform === 'win32';
  tracker = new UpdateTracker(app.getVersion(), supported, onStatus, version => {
    if (!Notification.isSupported()) return;
    const toast = new Notification({
      title: `Undertone ${version} is ready`,
      body: 'It will install the next time Undertone quits, or choose "Restart to update" in Undertone.',
    });
    toast.on('click', onToastClick);
    toast.show();
  });
  if (!supported) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => tracker?.checking());
  autoUpdater.on('update-available', info => tracker?.available(info.version));
  autoUpdater.on('download-progress', progress => tracker?.progress(progress.percent));
  autoUpdater.on('update-not-available', () => tracker?.notAvailable());
  autoUpdater.on('update-downloaded', info => tracker?.downloaded(info.version));
  autoUpdater.on('error', error => {
    console.error('[undertone:update]', errorMessage(error));
    tracker?.failed(errorMessage(error));
  });

  setTimeout(() => { checkForUpdates(); }, FIRST_CHECK_DELAY_MS);
  setInterval(() => { checkForUpdates(); }, CHECK_INTERVAL_MS).unref();
}

export function getUpdateStatus(): UpdateStatus {
  return tracker?.get() ?? { state: 'unsupported', currentVersion: app.getVersion() };
}

/** Starts a check unless one is already running, an update is ready, or updates are unsupported. */
export function checkForUpdates(): UpdateStatus {
  if (!tracker?.canCheck()) return getUpdateStatus();
  tracker.checking();
  autoUpdater.checkForUpdates().catch(error => {
    console.error('[undertone:update]', errorMessage(error));
    tracker?.failed(errorMessage(error));
  });
  return getUpdateStatus();
}

export function restartToUpdate(): void {
  if (tracker?.get().state !== 'ready') return;
  // Silent install, then relaunch the new version.
  autoUpdater.quitAndInstall(true, true);
}
