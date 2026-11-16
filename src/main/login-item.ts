import { app } from 'electron';

import { HIDDEN_LAUNCH_ARG } from '../shared/startup';

export function applyLaunchAtLogin(openAtLogin: boolean): void {
  if (!app.isPackaged) return;
  if (process.platform !== 'darwin') {
    try {
      // The sign-in entry passes HIDDEN_LAUNCH_ARG so Undertone starts in the tray without a window.
      app.setLoginItemSettings({ openAtLogin, args: [HIDDEN_LAUNCH_ARG] });
    } catch {
      // Ignore platform-specific startup registration errors in development.
    }
    return;
  }

  if (!app.isPackaged) {
    return;
  }

  try {
    app.setLoginItemSettings({ openAtLogin });
  } catch {
    // Packaged builds can still hit OS policy issues; keep the app usable.
  }
}
