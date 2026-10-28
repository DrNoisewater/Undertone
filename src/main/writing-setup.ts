import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { app } from 'electron';
import { ensureOllamaRunning, isOllamaInstalled } from './ollama';
const run = promisify(execFile);

export async function ensureWritingEngine(baseUrl: string, signal: AbortSignal, progress: (message:string)=>void): Promise<void> {
  signal.throwIfAborted();
  progress('Checking your computer…');
  if (await ensureOllamaRunning(baseUrl)) return;
  signal.throwIfAborted();
  if (isOllamaInstalled()) throw new Error('The writing engine is installed but could not start. Restart Ollama, then choose Set up writing improvements again.');
  if (process.platform !== 'win32') throw new Error('On this platform, install Ollama using Get Ollama first. Then choose Set up writing improvements; Undertone will handle the model and settings.');
  const directory = await mkdtemp(path.join(app.getPath('temp'), 'undertone-setup-'));
  const installer = path.join(directory, 'OllamaSetup.exe');
  try {
    progress('Downloading the local writing engine…');
    const response = await fetch('https://ollama.com/download/OllamaSetup.exe', {signal:AbortSignal.any([signal,AbortSignal.timeout(1800000)])});
    if (!response.ok || !response.body || !response.url.startsWith('https://')) throw new Error('Could not download the writing engine. Check your internet connection and try again.');
    const total = Number(response.headers.get('content-length'));
    let received = 0, lastUpdate = 0;
    const meter = new Transform({transform(chunk, _encoding, callback) {
      received += chunk.length;
      if (received > 6 * 1024 ** 3) {callback(new Error('Unexpected installer size.'));return;}
      if (Date.now()-lastUpdate>500) {
        progress(total>0 ? `Downloading writing engine — ${Math.min(100,Math.floor(received/total*100))}%` : `Downloading writing engine — ${Math.round(received/1024/1024)} MB`);
        lastUpdate=Date.now();
      }
      callback(null,chunk);
    }});
    await pipeline(Readable.fromWeb(response.body as import('node:stream/web').ReadableStream),meter,createWriteStream(installer,{flags:'wx'}),{signal});
    signal.throwIfAborted();
    progress('Checking the installer’s Windows signature…');
    // The path is passed through the environment, never interpolated into PowerShell code.
    await run(path.join(process.env.SystemRoot || 'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),
      ['-NoProfile','-NonInteractive','-Command',"$s=Get-AuthenticodeSignature -LiteralPath $env:UNDERTONE_INSTALLER; if ($s.Status -ne 'Valid') { Write-Error 'Installer signature validation failed'; exit 1 }"],
      {env:{...process.env,UNDERTONE_INSTALLER:installer},windowsHide:true,timeout:60000}).catch(()=>{throw new Error('Windows could not verify the downloaded installer. Nothing was installed. Check your connection and try again.');});
    signal.throwIfAborted();
    progress('Installing the writing engine… Windows may ask for permission.');
    // Finish an in-progress installation even if Stop is clicked; do not kill its installer.
    await run(installer,['/VERYSILENT','/NORESTART','/SUPPRESSMSGBOXES'],{windowsHide:true,timeout:1800000}).catch(()=>{throw new Error('The writing engine installer did not finish. If Windows asked for permission, allow it and try setup again.');});
    signal.throwIfAborted();
    progress('Starting the writing engine…');
    if (!(await ensureOllamaRunning(baseUrl))) throw new Error('Installation finished, but the writing engine has not started. Choose Set up writing improvements again in a moment.');
  } finally { await rm(directory,{recursive:true,force:true}).catch(()=>{}); }
}
