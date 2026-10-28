import test from 'node:test';
import assert from 'node:assert/strict';
import {completeWritingSetup} from '../src/shared/setup-flow.ts';
function fixture(installed=false){const calls:string[]=[];return {calls,steps:{ensureEngine:async()=>{calls.push('engine');},hasModel:async()=>{calls.push('check');return installed;},downloadModel:async()=>{calls.push('download');},verify:async()=>{calls.push('verify');},enable:async()=>{calls.push('enable');}}};}
test('optional setup installs, downloads, verifies, then enables clean',async()=>{
 const f=fixture();await completeWritingSetup(f.steps,new AbortController().signal);assert.deepEqual(f.calls,['engine','check','download','verify','enable']);
});
test('existing model is reused without a download',async()=>{
 const f=fixture(true);await completeWritingSetup(f.steps,new AbortController().signal);assert.deepEqual(f.calls,['engine','check','verify','enable']);
});
test('failed download never changes writing settings',async()=>{
 const f=fixture();f.steps.downloadModel=async()=>{throw new Error('offline');};await assert.rejects(completeWritingSetup(f.steps,new AbortController().signal),/offline/);assert.equal(f.calls.includes('enable'),false);
});
test('cancelling during installation finishes that step but never starts model download',async()=>{
 const f=fixture(),controller=new AbortController();f.steps.ensureEngine=async()=>{f.calls.push('engine');controller.abort();};await assert.rejects(completeWritingSetup(f.steps,controller.signal));assert.deepEqual(f.calls,['engine']);
});
test('cancel before setup does no work; failed verification never enables rewriting',async()=>{
 const f=fixture(),controller=new AbortController();controller.abort();await assert.rejects(completeWritingSetup(f.steps,controller.signal));assert.deepEqual(f.calls,[]);
 f.steps.verify=async()=>{throw new Error('not ready');};await assert.rejects(completeWritingSetup(f.steps,new AbortController().signal),/not ready/);assert.equal(f.calls.includes('enable'),false);
});
