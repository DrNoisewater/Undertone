import { app, Notification } from 'electron';
import electronUpdater from 'electron-updater';

// electron-updater is CommonJS; its named exports are not visible to ESM imports.
const { autoUpdater } = electronUpdater;

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const FIRST_CHECK_DELAY_MS = 15_000;

/**
 * Checks GitHub Releases for a newer installer, downloads it in the background,
 * and installs it the next time Undertone quits. Only runs in the installed Windows app.
 * onReady receives the downloaded version so the tray can offer "Restart to update".
 */
export function startAutoUpdates(onReady: (version: string) => void): void {
  if (!app.isPackaged || process.platform !== 'win32') return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', error => console.error('[undertone:update]', error?.message ?? error));
  autoUpdater.on('update-downloaded', info => {
    onReady(info.version);
    if (Notification.isSupported()) {
      new Notification({
        title: `Undertone ${info.version} is ready`,
        body: 'It will install the next time Undertone quits. Choose "Restart to update" in the tray menu to install now.',
      }).show();
    }
  });

  const check = () => { autoUpdater.checkForUpdates().catch(error => console.error('[undertone:update]', error?.message ?? error)); };
  setTimeout(check, FIRST_CHECK_DELAY_MS);
  setInterval(check, CHECK_INTERVAL_MS).unref();
}

export function restartToUpdate(): void {
  // Silent install, then relaunch the new version.
  autoUpdater.quitAndInstall(true, true);
}
