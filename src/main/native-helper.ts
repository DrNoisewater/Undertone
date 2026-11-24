import { checkPasteTarget } from '../shared/paste-target';
import type { PasteCheck } from '../shared/paste-reminder';
import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import type { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

import { app } from 'electron';

import type { FocusInfo, HotkeyEvent, PermissionsState } from '../shared/types';
import { pathExists } from './storage';

const projectRoot = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const helperSourcePath = path.join(projectRoot, 'swift', 'OpenWhispHelper.swift');

type ListenerProcess = ChildProcessByStdio<null, Readable, Readable>;

let listenerProcess: ListenerProcess | null = null;

function getHelperBinaryPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'native', process.platform === 'win32' ? 'undertone-helper.exe' : 'openwhisp-helper')
    : path.join(projectRoot, 'build', 'native', process.platform === 'win32' ? 'undertone-helper.exe' : 'openwhisp-helper');
}

async function compileHelper(): Promise<boolean> {
  if (app.isPackaged) {
    return pathExists(getHelperBinaryPath());
  }

  const outputPath = getHelperBinaryPath();
  const outputDirectory = path.dirname(outputPath);
  await mkdir(outputDirectory, { recursive: true });

  return new Promise<boolean>((resolve) => {
    const child = spawn(process.execPath, [path.join(projectRoot, 'scripts/build-native.mjs')], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      windowsHide: true,
    });

    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}

export async function ensureNativeHelper(): Promise<boolean> {
  if (await pathExists(getHelperBinaryPath())) {
    return true;
  }

  if (!(await pathExists(helperSourcePath))) {
    return false;
  }

  return (await compileHelper()) && (await pathExists(getHelperBinaryPath()));
}

async function runHelperJson<T>(args: string[], input?: string): Promise<T> {
  const helperReady = await ensureNativeHelper();
  if (!helperReady) {
    throw new Error('The native Undertone helper is not available.');
  }

  return new Promise<T>((resolve, reject) => {
    // The Windows helper is a console program: without windowsHide every call flashes a console window.
    const child = spawn(getHelperBinaryPath(), args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    // Only paste reads stdin (the dictation, to check it landed); other commands get it closed straight away.
    child.stdin.on('error', () => {});
    child.stdin.end(input ?? '', 'utf8');

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => { child.kill(); reject(new Error('Native helper timed out.')); }, 5000);
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || 'The helper exited unexpectedly.'));
        return;
      }

      try {
        resolve(JSON.parse(stdout.trim()) as T);
      } catch (error) {
        reject(error);
      }
    });
  });
}

export async function getNativePermissionState(): Promise<PermissionsState> {
  try {
    return await runHelperJson<PermissionsState>(['permissions', 'status']);
  } catch {
    return {
      accessibility: false,
      inputMonitoring: false,
      postEvents: false,
      microphone: 'unknown',
    };
  }
}

export async function requestNativePermissions(): Promise<PermissionsState> {
  try {
    return await runHelperJson<PermissionsState>(['permissions', 'request']);
  } catch {
    return getNativePermissionState();
  }
}

export async function getFocusInfo(): Promise<FocusInfo> {
  return runHelperJson<FocusInfo>(['focus']);
}

export async function triggerPaste(targetFocus?: FocusInfo, text?: string): Promise<{ok:boolean;reason:string;verified:PasteCheck}> {
  if (!targetFocus) return {ok:false,reason:'no_target',verified:'unknown'};
  // Windows re-checks the field at paste time (see checkPasteTarget); macOS still requires a field at capture.
  if (process.platform !== 'win32' && !targetFocus.canPaste) return {ok:false,reason:targetFocus.reason || 'no_field',verified:'unknown'};
  const args = ['paste', targetFocus.bundleIdentifier ?? '', String(targetFocus.processIdentifier ?? ''), targetFocus.windowHandle ?? '', targetFocus.focusToken ?? ''];
  if (process.platform === 'win32') args.push(targetFocus.fieldSignature ?? '');
  try {
    if (process.platform === 'win32') {
      const reason = checkPasteTarget(targetFocus, await getFocusInfo());
      if (reason) return {ok:false,reason,verified:'unknown'};
    }
    // Windows reads the dictation from stdin to check that it landed in the field.
    const result = await runHelperJson<{ok:boolean;reason?:string;verified?:string}>(args, process.platform === 'win32' ? text ?? '' : undefined);
    const verified: PasteCheck = result.verified === 'confirmed' || result.verified === 'missing' ? result.verified : 'unknown';
    return {ok:result.ok,reason:result.reason || (result.ok ? 'sent' : 'field_changed'),verified};
  } catch { return {ok:false,reason:'helper_unavailable',verified:'unknown'}; }
}

export async function startFnListener(
  onEvent: (event: HotkeyEvent) => void,
  onError?: (message: string) => void,
  hotkey = 'Ctrl+Alt+Space',
): Promise<boolean> {
  const helperReady = await ensureNativeHelper();
  if (!helperReady || listenerProcess) {
    return helperReady;
  }

  const child = spawn(getHelperBinaryPath(), ['listen', hotkey], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  listenerProcess = child;
  const stdoutInterface = readline.createInterface({ input: child.stdout });

  stdoutInterface.on('line', (line) => {
    if (!line.trim()) {
      return;
    }

    try {
      const message = JSON.parse(line) as { type?: string; message?: string };

      if (message.type === 'fnDown') {
        onEvent({ type: 'down' });
      }

      if (message.type === 'cancel') onEvent({type: 'cancel'});

      if (message.type === 'pasteKey') onEvent({type: 'paste'});

      if (message.type === 'fnUp') {
        onEvent({ type: 'up' });
      }

      if (message.type === 'error') {
        onError?.(message.message ?? 'The native helper could not watch the Fn key.');
      }
    } catch {
      // Ignore malformed lines from the native helper.
    }
  });

  child.stderr.on('data', (chunk) => {
    const message = chunk.toString().trim();
    if (message) {
      onError?.(message);
    }
  });

  child.on('error', (error) => { onError?.(error.message); if (listenerProcess === child) listenerProcess = null; });
  child.on('close', () => {
    stdoutInterface.close();
    if (listenerProcess === child) { listenerProcess = null; onError?.('Keyboard helper stopped. Restart Undertone to reconnect.'); }
  });

  return true;
}

export function isFnListenerRunning(): boolean {
  return listenerProcess !== null;
}

export function stopFnListener(): void {
  listenerProcess?.kill();
  listenerProcess = null;
}
