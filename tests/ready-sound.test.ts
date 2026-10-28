import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readySoundSamples, readySoundSampleRate} from '../src/renderer/ready-sound.ts';
test('embedded ready sound exactly matches the approved first-note WAV',()=>{
 const wav=readFileSync(new URL('../assets/ready-sound.wav',import.meta.url));
 assert.equal(readySoundSampleRate,wav.readUInt32LE(24));
 assert.equal(readySoundSamples.length,(wav.length-44)/2);
 for(let i=0;i<readySoundSamples.length;i++)assert.equal(readySoundSamples[i],wav.readInt16LE(44+i*2)/32768);
});
