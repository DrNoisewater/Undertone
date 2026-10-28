import test from 'node:test';
import assert from 'node:assert/strict';
import { requireLoopback, requireLocalModel } from '../src/main/local-policy.ts';
import { decodePcm16Wave } from '../src/main/wav.ts';
function wave(rate=16000) {
 const b=Buffer.alloc(48);b.write('RIFF');b.writeUInt32LE(40,4);b.write('WAVE',8);b.write('fmt ',12);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(4,40);b.writeInt16LE(-32768,44);b.writeInt16LE(16384,46);return b;
}
test('local-only endpoints accept loopback',()=>{for(const host of ['127.0.0.1','localhost','[::1]'])assert.equal(requireLoopback(`http://${host}:11434`),`http://${host}:11434`);});
test('remote, credentialed and non-HTTP endpoints rejected',()=>{for(const url of ['https://ollama.com','http://192.168.1.2:11434','http://localhost.attacker.test','file:///tmp/server','http://name:secret@localhost','https://127.0.0.1'])assert.throws(()=>requireLoopback(url));});
test('cloud model names blocked',()=>{for(const model of ['deepseek:cloud','gpt-oss:120b-cloud','https://example.com/model',''])assert.throws(()=>requireLocalModel(model));assert.equal(requireLocalModel('gemma4:e4b'),'gemma4:e4b');});
test('PCM decoder preserves sample sign and level',()=>assert.deepEqual([...decodePcm16Wave(wave())],[-1,.5]));
test('truncated and malformed recordings fail safely',()=>{assert.throws(()=>decodePcm16Wave(Buffer.alloc(2)));const b=wave();b.writeUInt32LE(1000,40);assert.throws(()=>decodePcm16Wave(b));});
test('sample rate and channel mismatches rejected',()=>{assert.throws(()=>decodePcm16Wave(wave(48000)));const b=wave();b.writeUInt16LE(2,22);assert.throws(()=>decodePcm16Wave(b));});
test('odd PCM byte lengths rejected',()=>{const b=wave();b.writeUInt32LE(3,40);assert.throws(()=>decodePcm16Wave(b));});
