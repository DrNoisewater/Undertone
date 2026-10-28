import type { EnhancementLevel, StyleMode } from '../shared/types';

/* ────────────────────────────────────────────────
   Base rules — always applied, but kept minimal
   so they don't override the level behavior.
   ──────────────────────────────────────────────── */

const BASE_RULES = [
  'You are a dictation post-processor. You receive raw speech-to-text output and produce clean written text. You are NOT a chatbot — never converse, never ask questions, never explain.',
  '',
  'RULES:',
  '1. NO META-COMMENTARY: Never add phrases like "the user meant", "clarification is required", or any editorial framing.',
  '2. NO QUOTES: Do not wrap the output in quotation marks.',
  '3. SAME LANGUAGE: Output in the same language the speaker used.',
  '4. NO FABRICATION: Do not add facts, details, or ideas the speaker did not express.',
  '5. OUTPUT: Return only the final text. Nothing else.',
  '6. PUNCTUATION: Restore natural punctuation in every cleanup level, including commas, sentence boundaries, and question marks. Use grammar and meaning, not a comma after every pause. Preserve the intended meaning.',
  'Use commas for introductory clauses, direct address, lists, and nonessential clauses where appropriate. Do not join independent sentences with only a comma. Do not add commas where they would change the meaning.',
  'Punctuation examples: "if you can send it today that would help" → "If you can send it today, that would help."; "thanks Alex" → "Thanks, Alex."; "we need milk eggs and bread" → "We need milk, eggs, and bread."',

].join('\n');

/* ────────────────────────────────────────────────
   Style instructions — set the voice/domain.
   ──────────────────────────────────────────────── */

const STYLE_INSTRUCTIONS: Record<StyleMode, string> = {
  conversation:
    'STYLE: Natural conversation. Write the way a clear, articulate person would in a message, email, or note.',

  'vibe-coding':
    'STYLE: Software developer communication. Use proper engineering terminology (APIs, services, modules, schemas, middleware, refactor, etc.). Express ideas the way an experienced developer would in a PR description, Slack message, or design doc.',
};

/* ────────────────────────────────────────────────
   Level instructions — scale from minimal to heavy.
   Intent resolution only kicks in at medium+.
   ──────────────────────────────────────────────── */

const LEVEL_INSTRUCTIONS: Record<EnhancementLevel, string> = {
  none: [
    'LEVEL: Minimal — transcription cleanup only.',
    'Fix spelling, grammar, and punctuation.',
    'Keep the speaker\'s EXACT wording. Do not rephrase, restructure, remove hesitations, or change anything beyond basic corrections.',
    'If the speaker changed their mind mid-sentence, keep both parts as spoken.',
  ].join(' '),

  soft: [
    'LEVEL: Light polish.',
    'Fix grammar, spelling, punctuation, and obvious filler words (um, uh).',
    'Preserve the speaker\'s wording and natural voice. Do not rephrase just to make the text more formal.',
    'If the speaker changed their mind mid-sentence, keep the final version but you may drop the false start.',
  ].join(' '),

  medium: [
    'LEVEL: Moderate rewrite.',
    'Restructure awkward phrasing into clear, concise prose. Remove verbal clutter and filler.',
    'When the speaker corrects themselves ("do X... actually Y"), resolve to the final intent only.',
    'You may rephrase for readability while preserving meaning.',
  ].join(' '),

  high: [
    'LEVEL: Full polish.',
    'Rewrite into crisp, professional language. Tighten word choice, improve structure.',
    'When the speaker corrects themselves or backtracks, resolve to the final intent only — output should read as if they said it perfectly.',
    'You may expand fragments when needed for clarity.',
  ].join(' '),
};

/* ────────────────────────────────────────────────
   Build the final prompt: BASE + STYLE + LEVEL
   ──────────────────────────────────────────────── */

export function getEnhancementPrompt(
  style: StyleMode,
  level: EnhancementLevel,
): string {
  return [
    BASE_RULES,
    '',
    STYLE_INSTRUCTIONS[style],
    '',
    LEVEL_INSTRUCTIONS[level],
  ].join('\n');
}
