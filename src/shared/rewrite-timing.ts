import type { EnhancementLevel } from './types';
export interface RewriteTiming { level: EnhancementLevel; seconds: number; loadSeconds: number; words: number; }
export function timingHint(level: EnhancementLevel, samples: RewriteTiming[]): string {
  if (level === 'none') return 'No extra cleanup time';
  const recent = samples.filter(s => s.level === level && s.words <= 40 && s.words > 0 && Number.isFinite(s.seconds) && s.seconds > 0).slice(-5);
  if (!recent.length) return 'Estimate available after a short dictation';
  const times = recent.map(s => Math.max(1, Math.round(s.seconds - Math.min(s.seconds, Math.max(0, s.loadSeconds)))));
  const low = Math.min(...times), high = Math.max(...times);
  return `About ${low === high ? low : `${low}–${high}`}s extra · short dictation, model loaded (${recent.length} sample${recent.length === 1 ? '' : 's'})`;
}
