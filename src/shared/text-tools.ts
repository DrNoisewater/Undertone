export interface WordReplacement { from: string; to: string }
export function validateReplacements(value: unknown): WordReplacement[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error('Use up to 100 word replacements.');
  const seen = new Set<string>();
  return value.map(item => {
    if (!item || typeof item.from !== 'string' || typeof item.to !== 'string') throw new Error('Each replacement needs a phrase and replacement text.');
    const from = item.from.trim(), to = item.to.trim();
    if (!from || !to || from.length > 120 || to.length > 500 || /[\r\n]/.test(from + to)) throw new Error('Use single-line phrases (up to 120 characters) and replacement text (up to 500).');
    const key = from.toLocaleLowerCase();
    if (seen.has(key)) throw new Error(`Duplicate replacement: ${from}`);
    seen.add(key); return {from, to};
  });
}
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function replaceWords(text: string, replacements: WordReplacement[]): string {
  if (!replacements.length) return text;
  const rules = [...replacements].sort((a,b) => b.from.length-a.from.length);
  const pattern = rules.map(r => escapeRegex(r.from).replace(/[ \t]+/g, '[ \t]+')).join('|');
  return text.replace(new RegExp(`(?<![\\p{L}\\p{N}_])(?:${pattern})(?![\\p{L}\\p{N}_])`, 'giu'), match =>
    rules.find(r => r.from.toLowerCase().replace(/[ \t]+/g,' ') === match.toLowerCase().replace(/[ \t]+/g,' '))!.to);
}
// Explicit commands are the default; bare punctuation names require opt-in.
export function formatSpokenCommands(text: string, shortCommands = false): string {
  const punctuation: Record<string,string> = {'comma':',','period':'.','full stop':'.','question mark':'?','exclamation mark':'!','exclamation point':'!','colon':':','semicolon':';'};
  const commands: Record<string,string> = {'new paragraph':'\n\n','next paragraph':'\n\n','paragraph break':'\n\n','new line':'\n','next line':'\n','line break':'\n'};
  for (const [name, symbol] of Object.entries(punctuation)) {
    for (const verb of ['insert','add','type']) {
      commands[`${verb} ${name}`] = symbol;
      commands[`${verb} a ${name}`] = symbol;
    }
    if (shortCommands) commands[name] = symbol;
  }
  const alternatives = (names: string[]) => names.sort((a,b)=>b.length-a.length).map(name=>escapeRegex(name).replace(/ /g,'[ \\t]+')).join('|');
  const names = alternatives(Object.keys(commands));
  const literalNames = alternatives([...new Set([...Object.keys(commands),...Object.keys(punctuation)])]);
  // Handle literal escapes in the same pass so escaped phrases cannot be processed again.
  return text.replace(new RegExp(`(?<![\\p{L}\\p{N}_])(?:literal[ \\t]+(${literalNames})|(${names}))(?![\\p{L}\\p{N}_])([.,!?;:]?)`, 'giu'), (_all, literal: string|undefined, name: string|undefined, trailing: string) => literal ? literal + trailing : commands[name!.toLowerCase().replace(/[ \t]+/g,' ')])
    .replace(/[ \t]*\n[ \t]*/g,'\n').replace(/[ \t]+([,.;:!?])/g,'$1').replace(/([,;:!?])(?=[\p{L}\p{N}])/gu,'$1 ').replace(/^[ \t]+|[ \t]+$/g,'');
}

export async function prepareDictationText(rawText: string, options: {spokenFormatting: boolean; shortPunctuationCommands?: boolean; wordReplacements: WordReplacement[]}, rewrite?: (text: string) => Promise<string>): Promise<{finalText:string;usedRewriteFallback:boolean}> {
  const formatted = options.spokenFormatting ? formatSpokenCommands(rawText, options.shortPunctuationCommands) : rawText;
  let finalText = formatted, usedRewriteFallback = false;
  if (rewrite && formatted.trim()) {
    try {
      const candidate = await rewrite(formatted);
      // Keep explicit line/paragraph breaks even if the optional model ignores instructions.
      const breaks = (s:string) => JSON.stringify(s.match(/\n+/g) ?? []);
      if (!candidate.trim() || (options.spokenFormatting && (
        breaks(candidate) !== breaks(formatted) ||
        candidate.startsWith('\n') !== formatted.startsWith('\n') ||
        candidate.endsWith('\n') !== formatted.endsWith('\n')
      ))) throw new Error('Rewrite changed explicit formatting.');
      finalText = candidate;
    } catch { usedRewriteFallback = true; }
  }
  return {finalText:replaceWords(finalText, options.wordReplacements),usedRewriteFallback};
}

// Fraction of the speaker's words (minus fillers) that must survive each cleanup level.
const MIN_KEPT: Record<'soft'|'medium'|'high', number> = {soft: 0.85, medium: 0.7, high: 0.6};
const FILLERS = new Set(['um','umm','uh','uhh','er','erm','ah','hmm','mm','like','so','just','you','know','i','mean','kind','sort','of','actually','basically','literally','really','okay','ok','yeah','well','right','wait','no']);
const words = (s: string) => s.toLocaleLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];

/** Rejects rewrites that drop or invent too much of what the speaker said. Short dictations are not checked. */
export function keepsSpeakerWords(original: string, candidate: string, level: 'soft'|'medium'|'high'): boolean {
  const spoken = words(original).filter(w => !FILLERS.has(w));
  if (spoken.length < 8) return true;
  const written = words(candidate);
  const available = new Map<string, number>();
  for (const w of written) available.set(w, (available.get(w) ?? 0) + 1);
  let kept = 0;
  for (const w of spoken) { const n = available.get(w) ?? 0; if (n > 0) { kept++; available.set(w, n - 1); } }
  const added = written.length - words(original).length;
  return kept / spoken.length >= MIN_KEPT[level] && added <= Math.max(6, words(original).length * 0.25);
}
