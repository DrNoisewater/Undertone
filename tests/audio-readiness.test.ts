import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioRecorder } from '../src/renderer/audio-recorder.ts';

function hardware() {
  const track = {readyState:'live', muted:false, stop(){this.readyState='ended';}};
  const stream = {getTracks:()=>[track], getAudioTracks:()=>[track]};
  const node = () => ({connect(){},disconnect(){}});
  const processor = {...node(), onaudioprocess:null as null | ((e:any)=>void)};
  let closed = false;
  class Context {
    sampleRate=48000; destination={};
    createMediaStreamSource(){return node();}
    createScriptProcessor(){return processor;}
    createGain(){return {...node(),gain:{value:1}};}
    async resume(){} async close(){closed=true;}
  }
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async()=>stream}}});
  Object.defineProperty(globalThis,'AudioContext',{configurable:true,value:Context});
  return {track, closed:()=>closed, frame:(value=0.25)=>processor.onaudioprocess?.({inputBuffer:{getChannelData:()=>new Float32Array(4096).fill(value)}})};
}
const tick = () => new Promise(resolve=>setImmediate(resolve));
test('ready waits for delivered audio and retains the first buffer',async()=>{
  const hw=hardware(), recorder=new AudioRecorder(); let ready=false;
  const start=recorder.start().then(()=>{ready=true;}); await tick();
  assert.equal(ready,false,'resuming the context is not microphone readiness');
  hw.frame(); await start; assert.equal(ready,true);
  hw.frame(); const wav=Buffer.from(await recorder.stop(),'base64');
  assert.ok(wav.length>44); assert.ok(wav.readInt16LE(44)>0,'first sample retained');
  assert.equal(hw.track.readyState,'ended'); assert.equal(hw.closed(),true);
});
test('muted microphone does not signal readiness; silence on a live microphone does',async()=>{
  const hw=hardware(), recorder=new AudioRecorder(); let ready=false;
  const start=recorder.start().then(()=>{ready=true;}); await tick();
  hw.track.muted=true; hw.frame(); await tick(); assert.equal(ready,false);
  hw.track.muted=false; hw.frame(0); await start; recorder.cancel();
});
test('cancelling while awaiting first audio rejects startup and releases the microphone',async()=>{
  const hw=hardware(), recorder=new AudioRecorder();
  const start=recorder.start(); const rejected=assert.rejects(start,/cancelled/);
  await tick(); recorder.cancel(); await rejected;
  assert.equal(hw.track.readyState,'ended'); assert.equal(hw.closed(),true);
});
test('microphone that never delivers audio times out and releases resources',async(t)=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const hw=hardware(), recorder=new AudioRecorder();
  const start=recorder.start(); const rejected=assert.rejects(start,/did not become ready/);
  await tick(); t.mock.timers.tick(8000); await rejected;
  assert.equal(hw.track.readyState,'ended'); assert.equal(hw.closed(),true);
});
