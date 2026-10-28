import type { RewriteTiming } from '../shared/rewrite-timing';
let currentKey = '';
let samples: RewriteTiming[] = [];
export function getRewriteTimings(key: string): RewriteTiming[] { return key === currentKey ? [...samples] : []; }
export function recordRewriteTiming(key: string, sample: RewriteTiming): void {
  if (key !== currentKey) { currentKey = key; samples = []; }
  samples = [...samples, sample].slice(-60);
}
