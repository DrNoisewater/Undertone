import test from 'node:test';
import assert from 'node:assert/strict';
import { RecordingSession } from '../src/renderer/recording-session.ts';
import { RecoveryBuffer } from '../src/main/recovery.ts';
function deferred() {let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};}
function fixture(mode:'hold'|'toggle'='toggle') {
 const calls={start:0,stop:0,cancel:0,process:0};const statuses:string[]=[];
 const deps={recorder:{start:async()=>{calls.start++;},stop:async()=>{calls.stop++;return 'audio';},cancel:()=>{calls.cancel++;}},prepare:async()=>mode,process:async()=>{calls.process++;},status:(state:string)=>{statuses.push(state);},limitMs:1000};
 return {calls,statuses,deps,session:new RecordingSession(deps)};
}
test('one press starts, release keeps recording, second press finishes once',async()=>{
 const f=fixture();await f.session.down();await f.session.up();assert.equal(f.calls.stop,0);await f.session.down();await f.session.up();assert.equal(f.calls.process,1);assert.equal(f.calls.start,1);f.session.dispose();
});
test('hold release during microphone startup still finishes exactly once',async()=>{
 const f=fixture('hold'),d=deferred();f.deps.recorder.start=async()=>{f.calls.start++;await d.promise;};
 const starting=f.session.down();await Promise.resolve();await f.session.up();d.resolve();await starting;
 assert.equal(f.calls.process,1);assert.equal(f.calls.stop,1);f.session.dispose();
});
test('Escape during microphone startup discards late audio without processing',async()=>{
 const f=fixture(),d=deferred();f.deps.recorder.start=async()=>{await d.promise;};
 const starting=f.session.down();await Promise.resolve();f.session.cancel();d.resolve();await starting;
 assert.equal(f.calls.process,0);assert.ok(f.statuses.includes('cancelled'));assert.equal(f.statuses.includes('listening'),false);f.session.dispose();
});
test('Escape while recording discards and next recording still works',async()=>{
 const f=fixture();await f.session.down();f.session.cancel();assert.equal(f.calls.process,0);await f.session.down();await f.session.down();assert.equal(f.calls.process,1);f.session.dispose();
});
test('repeated keys during processing cannot start duplicate recording',async()=>{
 const f=fixture(),d=deferred();f.deps.process=async()=>{f.calls.process++;await d.promise;};
 await f.session.down();const stopping=f.session.down();await Promise.resolve();await f.session.down();await f.session.down();assert.equal(f.calls.start,1);d.resolve();await stopping;f.session.dispose();
});
test('microphone startup failure releases resources and allows retry',async()=>{
 const f=fixture();let fail=true;f.deps.recorder.start=async()=>{if(fail)throw new Error('unplugged');};await f.session.down();assert.ok(f.statuses.includes('error'));assert.equal(f.calls.cancel,1);fail=false;await f.session.down();await f.session.down();assert.equal(f.calls.process,1);f.session.dispose();
});
test('maximum recording length finishes automatically',async()=>{
 const f=fixture();f.deps.limitMs=5;await f.session.down();await new Promise(r=>setTimeout(r,20));assert.equal(f.calls.process,1);f.session.dispose();
});
test('recovery buffer retains failed input, replaces it, and discards on demand',()=>{
 const buffer=new RecoveryBuffer<string>();buffer.keep('first');assert.equal(buffer.get(),'first');buffer.keep('second');assert.equal(buffer.get(),'second');buffer.clear();assert.equal(buffer.get(),undefined);
});
test('failed recording expires from memory',async()=>{
 const buffer=new RecoveryBuffer<string>(5);buffer.keep('audio');await new Promise(r=>setTimeout(r,20));assert.equal(buffer.get(),undefined);
});
test('second toggle press during startup finishes instead of leaving the mic running',async()=>{
 const f=fixture(),d=deferred();f.deps.recorder.start=async()=>{await d.promise;};const starting=f.session.down();await Promise.resolve();await f.session.down();d.resolve();await starting;assert.equal(f.calls.process,1);f.session.dispose();
});
test('ready cue is emitted once after capture is ready, never after an early release',async()=>{
 const f=fixture(),d=deferred();f.deps.recorder.start=()=>d.promise;
 const start=f.session.down();await Promise.resolve();assert.deepEqual(f.statuses,['starting']);
 d.resolve();await start;assert.equal(f.statuses.filter(s=>s==='listening').length,1);f.session.cancel();f.session.dispose();
 const held=fixture('hold'),delay=deferred();held.deps.recorder.start=()=>delay.promise;
 const pending=held.session.down();await Promise.resolve();await held.session.up();delay.resolve();await pending;
 assert.equal(held.statuses.includes('listening'),false);held.session.dispose();
});
test('five minute auto-stop starts after readiness and processes exactly once',async(t)=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture(),d=deferred();f.deps.limitMs=300000;f.deps.recorder.start=()=>d.promise;
 const starting=f.session.down();await Promise.resolve();t.mock.timers.tick(300000);assert.equal(f.calls.stop,0);
 d.resolve();await starting;t.mock.timers.tick(299999);assert.equal(f.calls.stop,0);
 t.mock.timers.tick(1);await Promise.resolve();await Promise.resolve();assert.equal(f.calls.stop,1);assert.equal(f.calls.process,1);
 t.mock.timers.tick(300000);assert.equal(f.calls.stop,1);f.session.dispose();
});
