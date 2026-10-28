import test from 'node:test';
import assert from 'node:assert/strict';
import { timingHint } from '../src/shared/rewrite-timing.ts';
import { recordRewriteTiming, getRewriteTimings } from '../src/main/rewrite-timings.ts';
test('timing guidance separates cold load, modes, and long text without inventing estimates',()=>{
 const samples=[{level:'soft' as const,seconds:24,loadSeconds:20,words:12},{level:'soft' as const,seconds:6,loadSeconds:0,words:20},{level:'soft' as const,seconds:80,loadSeconds:0,words:100}];
 assert.match(timingHint('soft',samples),/4–6s.*2 samples/);
 assert.match(timingHint('high',samples),/after a short dictation/);
 assert.equal(timingHint('none',samples),'No extra cleanup time');
});
test('timing samples cannot leak across model or endpoint changes',()=>{
 recordRewriteTiming('local|one',{level:'high',seconds:5,loadSeconds:1,words:10});
 assert.equal(getRewriteTimings('local|one').length,1);
 assert.equal(getRewriteTimings('local|two').length,0);
 const copy=getRewriteTimings('local|one');copy.pop();
 assert.equal(getRewriteTimings('local|one').length,1);
 recordRewriteTiming('local|two',{level:'soft',seconds:3,loadSeconds:0,words:10});
 assert.equal(getRewriteTimings('local|one').length,0);
});
