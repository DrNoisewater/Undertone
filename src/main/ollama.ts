import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { requireLoopback, requireLocalModel } from './local-policy';

import type { OllamaModelInfo } from '../shared/types';

interface OllamaTagsResponse {
  models?: Array<{
    name: string;
    size: number;
    modified_at?: string;
    remote_host?: string;
    remote_model?: string;
  }>;
}

const OLLAMA_DISCOVERY_TIMEOUT_MS = 5_000;
const OLLAMA_PULL_TIMEOUT_MS = 600_000;
const OLLAMA_CHAT_TIMEOUT_MS = 90_000;

function buildUrl(baseUrl: string, pathName: string): string {
  return new URL(pathName, requireLoopback(baseUrl)).toString();
}

function formatOllamaConnectionMessage(baseUrl: string): string {
  return `Ollama is not running at ${baseUrl}. Start the Ollama app or run \`ollama serve\`, then try again.`;
}

function toOllamaError(baseUrl: string, error: unknown, timeoutMs?: number): Error {
  if (error instanceof Error) {
    const nested = (error as Error & { cause?: { code?: string } }).cause;
    if (nested?.code === 'ECONNREFUSED') {
      return new Error(formatOllamaConnectionMessage(baseUrl));
    }

    if (error.name === 'AbortError') {
      const seconds = timeoutMs ? Math.round(timeoutMs / 1000) : 5;
      return new Error(`Ollama did not respond at ${baseUrl} within ${seconds} seconds.`);
    }

    if (error.message === 'fetch failed') {
      return new Error(formatOllamaConnectionMessage(baseUrl));
    }
  }

  return error instanceof Error ? error : new Error('Undertone could not reach Ollama.');
}

async function fetchWithTimeout(
  input: string,
  init?: RequestInit,
  timeoutMs = OLLAMA_DISCOVERY_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, { ...init, redirect: 'error', signal: init?.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal });
    // Buffer the response inside the timeout for non-streaming requests.
    if (!input.endsWith('/api/pull')) {
      const body = await response.arrayBuffer();
      return new Response(body, { status: response.status, headers: response.headers });
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

const OLLAMA_APP_PATH = process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Ollama', 'ollama app.exe') : '/Applications/Ollama.app';

// The server alone: no tray icon or chat window. Windows only; macOS keeps opening the app.
const OLLAMA_SERVER_PATH = process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Ollama', 'ollama.exe') : '';

export function isOllamaInstalled(): boolean {
  return fs.existsSync(OLLAMA_APP_PATH) || (OLLAMA_SERVER_PATH !== '' && fs.existsSync(OLLAMA_SERVER_PATH));
}

export async function launchOllamaApp(baseUrl?: string): Promise<void> {
  const hidden = OLLAMA_SERVER_PATH !== '' && fs.existsSync(OLLAMA_SERVER_PATH);
  // Bind the server to the address Undertone talks to (loopback only).
  const env = hidden && baseUrl ? {...process.env, OLLAMA_HOST: new URL(requireLoopback(baseUrl)).host} : process.env;
  await new Promise<void>((resolve,reject)=>{
    const child=hidden
      ? spawn(OLLAMA_SERVER_PATH,['serve'],{detached:true,stdio:'ignore',windowsHide:true,env})
      : spawn(process.platform==='win32'?OLLAMA_APP_PATH:'open',process.platform==='win32'?[]:['-a','Ollama'],{detached:true,stdio:'ignore',windowsHide:true});
    child.once('error',reject);
    child.once('spawn',()=>{child.unref();resolve();});
  });
}

async function waitForOllama(baseUrl: string, attempts = 10): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    if (await isOllamaReachable(baseUrl)) return true;
    await new Promise((r) => setTimeout(r, 1_000));
  }
  return false;
}

let starting: Promise<boolean> | null = null;

export async function ensureOllamaRunning(baseUrl: string): Promise<boolean> {
  if (await isOllamaReachable(baseUrl)) return true;
  // The warm-up at recording start and the rewrite can both ask; start the server only once.
  starting ??= startOllama(baseUrl).finally(() => { starting = null; });
  return starting;
}

async function startOllama(baseUrl: string): Promise<boolean> {
  if (!isOllamaInstalled()) return false;
  try {
    await launchOllamaApp(baseUrl);
    return waitForOllama(baseUrl);
  } catch {
    return false;
  }
}

export async function isOllamaReachable(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(
      buildUrl(baseUrl, '/api/version'),
      undefined,
      OLLAMA_DISCOVERY_TIMEOUT_MS,
    );
    return response.ok;
  } catch {
    return false;
  }
}

export async function listOllamaModels(baseUrl: string): Promise<OllamaModelInfo[]> {
  try {
    const response = await fetchWithTimeout(
      buildUrl(baseUrl, '/api/tags'),
      undefined,
      OLLAMA_DISCOVERY_TIMEOUT_MS,
    );
    if (!response.ok) {
      throw new Error('Undertone could not read the local Ollama models.');
    }

    const payload = (await response.json()) as OllamaTagsResponse;

    return (payload.models ?? [])
      .filter(model => !model.remote_host && !model.remote_model && !/cloud/i.test(model.name))
      .map((model) => ({
        name: model.name,
        size: model.size,
        modifiedAt: model.modified_at,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  } catch (error) {
    throw toOllamaError(baseUrl, error, OLLAMA_DISCOVERY_TIMEOUT_MS);
  }
}

export async function pullOllamaModel(
  baseUrl: string,
  modelName: string,
  onProgress?: (status: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  try {
    const response = await fetchWithTimeout(
      buildUrl(baseUrl, '/api/pull'),
      {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: requireLocalModel(modelName),
          stream: true,
        }),
      },
      OLLAMA_PULL_TIMEOUT_MS,
    );

    if (!response.ok || !response.body) {
      throw new Error('Undertone could not download the Ollama model.');
    }

    signal?.throwIfAborted();
    const reader = response.body.getReader();
    const cancel = () => { void reader.cancel().catch(()=>{}); };
    signal?.addEventListener('abort',cancel,{once:true});
    const timeout = setTimeout(() => void reader.cancel('Download timed out'), OLLAMA_PULL_TIMEOUT_MS);
    let complete = false;
    try {
    const decoder = new TextDecoder();
    let buffered = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffered += decoder.decode(value, { stream: true });
      const lines = buffered.split('\n');
      buffered = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        const payload = JSON.parse(line) as {
          error?: string;
          status?: string;
          completed?: number;
          total?: number;
        };

        if (payload.error) throw new Error(payload.error);
        if (payload.status === 'success') complete = true;
        if (typeof payload.completed === 'number' && typeof payload.total === 'number' && payload.total > 0) {
          const percent = Math.min(100, Math.round((payload.completed / payload.total) * 100));
          onProgress?.(`Downloading ${modelName} (${percent}%)`);
        } else if (payload.status) {
          onProgress?.(payload.status);
        }
      }
    }
    } finally { clearTimeout(timeout); signal?.removeEventListener('abort',cancel); await reader.cancel().catch(() => {}); }
    signal?.throwIfAborted();
    if (!complete) throw new Error('Model download did not complete. Retry the download.');
  } catch (error) {
    throw toOllamaError(baseUrl, error, OLLAMA_PULL_TIMEOUT_MS);
  }
}

async function verifyLocalModel(baseUrl: string, modelName: string): Promise<{capabilities?: string[]}> {
  requireLocalModel(modelName);
  const installed = await listOllamaModels(baseUrl);
  if (!installed.some(model => model.name === modelName)) throw new Error('The selected model is not installed locally.');
  const infoResponse = await fetchWithTimeout(buildUrl(baseUrl, '/api/show'), { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({model:modelName}) });
  if (!infoResponse.ok) throw new Error('Could not verify that the model is local.');
  const info = await infoResponse.json() as {remote_host?: string; remote_model?: string; capabilities?: string[]; model_info?: Record<string, unknown>};
  if (info.remote_host || info.remote_model || !info.model_info || Object.keys(info.model_info).length === 0) throw new Error('Remote or unverified models cannot process dictation.');
  return info;
}

/** Loads the writing model into memory while the user is still speaking, so the rewrite does not wait for it. */
export async function warmOllamaModel(baseUrl: string, modelName: string): Promise<void> {
  await ensureOllamaRunning(baseUrl);
  await verifyLocalModel(baseUrl, modelName);
  // An empty prompt only loads the model; nothing is generated.
  await fetchWithTimeout(buildUrl(baseUrl, '/api/generate'), { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({model:requireLocalModel(modelName), keep_alive:'10m'}) }, OLLAMA_CHAT_TIMEOUT_MS);
}

export async function rewriteWithOllama(
  baseUrl: string,
  modelName: string,
  systemPrompt: string,
  userMessage: string,
  rawText: string,
  onTiming?: (seconds: number, loadSeconds: number) => void,
): Promise<string> {
  try {
    const started = performance.now();
    // Restart Ollama if it was closed since Undertone started.
    await ensureOllamaRunning(baseUrl);
    const info = await verifyLocalModel(baseUrl, modelName);
    const response = await fetchWithTimeout(
      buildUrl(baseUrl, '/api/chat'),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: requireLocalModel(modelName),
          stream: false,
          keep_alive: '10m',
          ...(info.capabilities?.includes('thinking') ? { think: false } : {}),
          options: {
            temperature: 0,
          },
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: userMessage,
            },
          ],
        }),
      },
      OLLAMA_CHAT_TIMEOUT_MS,
    );

    if (!response.ok) {
      throw new Error('Undertone could not reach Ollama for the rewrite pass.');
    }

    const payload = (await response.json()) as {
      load_duration?: number;
      message?: {
        content?: string;
      };
    };

    if (!payload.message?.content?.trim()) throw new Error('The writing model returned no text.');
    onTiming?.((performance.now() - started) / 1000, Math.max(0, Number(payload.load_duration) || 0) / 1e9);
    return cleanRewriteOutput(payload.message?.content, rawText);
  } catch (error) {
    throw toOllamaError(baseUrl, error, OLLAMA_CHAT_TIMEOUT_MS);
  }
}

function cleanRewriteOutput(content: string | undefined, rawText: string): string {
  const trimmed = content?.trim();
  if (!trimmed) {
    return rawText;
  }

  const stripped =
    trimmed.startsWith('"') && trimmed.endsWith('"')
      ? trimmed.slice(1, -1).trim()
      : trimmed.startsWith("'") && trimmed.endsWith("'")
        ? trimmed.slice(1, -1).trim()
        : trimmed;

  const metaLeadPattern =
    /^(sure|here(?:'s| is)|rewritten|revised|updated|i changed|i rewrote|i made|this is)/i;

  if (!metaLeadPattern.test(stripped)) {
    return stripped;
  }

  const quotedMatches = Array.from(
    stripped.matchAll(/["“”'`](.+?)["“”'`]/g),
    (match) => match[1]?.trim(),
  ).filter((value): value is string => Boolean(value));

  if (quotedMatches.length > 0) {
    return quotedMatches.sort((left, right) => right.length - left.length)[0];
  }

  const colonIndex = stripped.indexOf(':');
  if (colonIndex >= 0) {
    const afterColon = stripped.slice(colonIndex + 1).trim();
    const cleanedTail = afterColon.replace(/\bI changed\b[\s\S]*$/i, '').trim();
    if (cleanedTail) {
      return cleanedTail;
    }
  }

  return stripped;
}
