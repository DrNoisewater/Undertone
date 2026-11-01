import test from 'node:test';
import assert from 'node:assert/strict';
import { getEnhancementPrompt, getEnhancementTask } from '../src/main/prompts.ts';
import { keepsSpeakerWords } from '../src/shared/text-tools.ts';

test('polish keeps the speaker voice instead of formal rewriting', () => {
  const prompt = getEnhancementPrompt('conversation', 'high');
  assert.match(prompt, /KEEP THEIR VOICE/);
  assert.match(prompt, /Do not summarize/);
  assert.doesNotMatch(prompt, /professional language|expand fragments/i);
});

test('lighter levels are not told to rewrite or resolve intent', () => {
  for (const level of ['none', 'soft'] as const) {
    const task = getEnhancementTask(level, 'hello');
    assert.doesNotMatch(task, /rewrite|final intent/i);
    assert.match(task, /<dictation>\nhello\n<\/dictation>/);
  }
});

const raw = 'um so the build keeps failing and I think it is the cache because when I clear it it works but then it breaks again an hour later';

test('faithful polish passes the drift check', () => {
  const polished = 'So the build keeps failing, and I think it is the cache. When I clear it, it works, but then it breaks again an hour later.';
  assert.equal(keepsSpeakerWords(raw, polished, 'high'), true);
  assert.equal(keepsSpeakerWords(raw, polished, 'soft'), true);
});

test('summarized or reworded output fails the drift check', () => {
  assert.equal(keepsSpeakerWords(raw, 'The build fails intermittently due to a caching issue.', 'high'), false);
  assert.equal(keepsSpeakerWords(raw, raw + ' Please let me know at your earliest convenience whether you can investigate this matter further.', 'high'), false);
});

test('self-corrections and short dictations are allowed', () => {
  assert.equal(keepsSpeakerWords('make it white actually black', 'Make it black.', 'medium'), true);
});
