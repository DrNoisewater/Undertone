import test from 'node:test';
import assert from 'node:assert/strict';
import {OverlayVisibility} from '../src/main/overlay-visibility.ts';
const flush=async()=>{await Promise.resolve();await Promise.resolve();};
function surface(){const state={visible:false,alpha:1,shows:0};return {state,api:{show:async(current:()=>boolean)=>{if(current()){state.visible=true;state.alpha=1;state.shows++;}},opacity:(v:number)=>{state.alpha=v;},hide:()=>{state.visible=false;}}};}
test('idle and microphone startup never imply recording is ready',async(t)=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval']});const f=surface(),c=new OverlayVisibility(f.api);
 c.setPhase('idle');t.mock.timers.tick(300);c.setPhase('starting');await flush();assert.equal(f.state.shows,0);c.dispose();
});
test('completion immediately fades and hides within 300ms without showing again',async(t)=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval']});const f=surface(),c=new OverlayVisibility(f.api);
 c.setPhase('rewriting');await flush();assert.equal(f.state.visible,true);
 const shows=f.state.shows;c.setPhase('done');await flush();t.mock.timers.tick(100);assert.ok(f.state.alpha>0&&f.state.alpha<1);
 t.mock.timers.tick(200);assert.equal(f.state.visible,false);assert.equal(f.state.shows,shows);
 t.mock.timers.tick(3000);await flush();assert.equal(f.state.visible,false);c.dispose();
});
test('new recording cancels an old fade and resets opacity',async(t)=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval']});const f=surface(),c=new OverlayVisibility(f.api);
 c.setPhase('listening');await flush();c.setPhase('done');t.mock.timers.tick(100);
 c.setPhase('listening');await flush();t.mock.timers.tick(5000);await flush();assert.equal(f.state.visible,true);assert.equal(f.state.alpha,1);c.dispose();
});
test('late async show cannot reopen overlay after completion',async(t)=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval']});const f=surface();let release!:()=>void;const wait=new Promise<void>(r=>release=r);
 const c=new OverlayVisibility({...f.api,show:async current=>{await wait;await f.api.show(current);}});
 c.setPhase('listening');c.setPhase('done');t.mock.timers.tick(300);release();await flush();assert.equal(f.state.visible,false);c.dispose();
});
test('hidden active overlay is restored on the next recovery tick',async(t)=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval']});const f=surface(),c=new OverlayVisibility(f.api);
 for(const phase of ['listening','transcribing','rewriting','pasting']) {
  c.setPhase(phase);await flush();f.state.visible=false;f.state.alpha=0;
  t.mock.timers.tick(750);await flush();assert.equal(f.state.visible,true);assert.equal(f.state.alpha,1);
 }
 c.dispose();t.mock.timers.tick(1500);await flush();assert.equal(f.state.visible,false);
});
test('transient show failure retries without changing dictation status',async(t)=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval']});const f=surface();let attempts=0;
 const c=new OverlayVisibility({...f.api,show:async current=>{if(++attempts===1)throw new Error('temporary');await f.api.show(current);}});
 c.setPhase('rewriting');await flush();assert.equal(f.state.visible,false);
 t.mock.timers.tick(750);await flush();assert.equal(f.state.visible,true);c.dispose();
});
test('error briefly appears then fades without changing error status elsewhere',async(t)=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval']});const f=surface(),c=new OverlayVisibility(f.api);
 c.setPhase('error');await flush();t.mock.timers.tick(3499);assert.equal(f.state.visible,true);
 t.mock.timers.tick(1);t.mock.timers.tick(300);assert.equal(f.state.visible,false);c.dispose();
});
