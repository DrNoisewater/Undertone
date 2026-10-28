import { validateReplacements } from '../shared/text-tools';
import { dialog, app } from 'electron';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

import { requireLoopback, requireLocalModel } from './local-policy';
import { createDefaultSettings } from './defaults';
import type { AppSettings, UpdateSettingsInput } from '../shared/types';

const SETTINGS_FILE = 'settings.json';

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), SETTINGS_FILE);
}

export async function loadSettings(): Promise<AppSettings> {
  const settingsPath = getSettingsPath();

  try {
    const raw = await readFile(settingsPath, 'utf8');
    return { ...createDefaultSettings(), ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    const defaults = createDefaultSettings();
    await saveSettings(defaults);
    return defaults;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const settingsPath = getSettingsPath();
  await mkdir(path.dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath + '.tmp', `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
  await rename(settingsPath + '.tmp', settingsPath);
}

export async function updateSettings(
  current: AppSettings,
  updates: UpdateSettingsInput,
): Promise<AppSettings> {
  if (updates.ollamaBaseUrl !== undefined) requireLoopback(updates.ollamaBaseUrl);
  if (updates.textModel !== undefined) requireLocalModel(updates.textModel);
  if (updates.hotkey && !['Ctrl+Alt+Space','Ctrl+Shift+Space','F8','F9'].includes(updates.hotkey)) throw new Error('Unsupported shortcut.');
  if (updates.vocabulary && updates.vocabulary.length > 4000) throw new Error('Vocabulary is limited to 4,000 characters.');
  for (const key of ['readySound', 'spokenFormatting', 'shortPunctuationCommands'] as const) {
    if (updates[key] !== undefined && typeof updates[key] !== 'boolean') throw new Error('Invalid recording option.');
  }
  if (updates.wordReplacements !== undefined) updates = {...updates, wordReplacements: validateReplacements(updates.wordReplacements)};
  const nextSettings = {
    ...current,
    ...updates,
  };

  await saveSettings(nextSettings);
  return nextSettings;
}

export async function chooseStorageDirectory(currentDirectory: string): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: 'Choose storage folder',
    defaultPath: currentDirectory,
    properties: ['openDirectory', 'createDirectory'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
}
