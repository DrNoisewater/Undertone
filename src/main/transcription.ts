import { decodePcm16Wave } from './wav';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env, pipeline } from '@huggingface/transformers';

import type { AppSettings } from '../shared/types';
import type { StoragePaths } from './storage';

type Transcriber = (
  audio: Float32Array,
  options?: Record<string, unknown>,
) => Promise<{ text?: string }>;

let transcriberKey: string | null = null;
let transcriberPromise: Promise<Transcriber> | null = null;

function configureTransformers(paths: StoragePaths): void {
  env.allowRemoteModels = true;
  env.allowLocalModels = true;
  env.useBrowserCache = false;
  env.cacheDir = paths.models;
  env.localModelPath = paths.models;
}

export async function prepareTranscriber(
  settings: AppSettings,
  paths: StoragePaths,
  onProgress?: (detail: string) => void,
): Promise<void> {
  transcriberPromise = null;
  await getTranscriber(settings, paths, true, onProgress);
  await writeFile(path.join(paths.models, 'ready.json'), JSON.stringify({ model: settings.whisperModel }));
}

async function getTranscriber(settings: AppSettings, paths: StoragePaths, download = false, onProgress?: (detail: string) => void): Promise<Transcriber> {
  configureTransformers(paths);

  const key = `${settings.whisperModel}:${paths.models}`;
  if (transcriberPromise && transcriberKey === key) {
    return transcriberPromise;
  }

  transcriberKey = key;
  transcriberPromise = pipeline('automatic-speech-recognition', settings.whisperModel, {
    progress_callback: (event: {status?: string; file?: string; progress?: number}) => {
      onProgress?.(typeof event.progress === 'number' ? `${event.file ?? 'Speech model'} — ${Math.round(event.progress)}%` : event.status === 'ready' ? 'Speech model ready.' : `Preparing ${event.file ?? 'speech engine'}…`);
    },
    dtype: 'q8',
    device: 'cpu',
    local_files_only: !download,
  } as Record<string, unknown>) as unknown as Promise<Transcriber>;

  try { return await transcriberPromise; } catch (error) { transcriberPromise = null; transcriberKey = null; throw error; }
}

export async function transcribeRecording(
  wavBase64: string,
  settings: AppSettings,
  paths: StoragePaths,
): Promise<string> {
  const transcriber = await getTranscriber(settings, paths);
  const audio = decodePcm16Wave(Buffer.from(wavBase64, 'base64'));
  const result = await transcriber(audio, {
    return_timestamps: false,
    chunk_length_s: 20,
    stride_length_s: 4,
    sampling_rate: 16_000,
  });

  return result.text?.trim() ?? '';
}
