import { app } from 'electron';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { HistoryEntry, ProcessAudioResult } from '../shared/types';
const file = () => path.join(app.getPath('userData'), 'history.json');
export async function readHistory(): Promise<HistoryEntry[]> {
  try { const data=JSON.parse(await readFile(file(),'utf8')); return Array.isArray(data) ? data.slice(0,100) : []; } catch { return []; }
}
export async function clearHistory(): Promise<void> { await writeFile(file(), '[]'); }
export async function addHistory(result: ProcessAudioResult): Promise<void> {
  const entries=await readHistory();
  entries.unshift({...result,id:randomUUID(),createdAt:new Date().toISOString()});
  await mkdir(path.dirname(file()),{recursive:true});
  await writeFile(file()+'.tmp',JSON.stringify(entries.slice(0,100)),'utf8');
  await rename(file()+'.tmp',file());
}
