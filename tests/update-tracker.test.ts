import test from 'node:test';
import assert from 'node:assert/strict';
import {UpdateTracker} from '../src/shared/update-tracker.ts';
import {isHiddenLaunch,HIDDEN_LAUNCH_ARG} from '../src/shared/startup.ts';
import type {UpdateStatus} from '../src/shared/types.ts';
function make(supported=true){const published:UpdateStatus[]=[],toasts:string[]=[];return {published,toasts,t:new UpdateTracker('1.0.0',supported,s=>published.push(s),v=>toasts.push(v))};}
test('check, download progress and ready flow is reported in the app',()=>{
 const {t,published}=make();assert.equal(t.get().state,'idle');
 t.checking();t.available('1.1.0');t.progress(42.4);t.downloaded('1.1.0');
 assert.deepEqual(published.map(s=>s.state),['checking','downloading','downloading','ready']);
 assert.equal(published[2].percent,42);assert.equal(t.get().version,'1.1.0');assert.equal(t.get().currentVersion,'1.0.0');
});
test('only one toast is shown even when the update is downloaded again or a newer one arrives',()=>{
 const {t,toasts}=make();t.downloaded('1.1.0');t.downloaded('1.1.0');t.downloaded('1.2.0');
 assert.deepEqual(toasts,['1.1.0']);assert.equal(t.get().version,'1.2.0');
});
test('no toast when up to date or when a check fails',()=>{
 const {t,toasts}=make();t.checking();t.notAvailable();assert.equal(t.get().state,'up-to-date');
 t.checking();t.failed('offline');assert.deepEqual(t.get(),{state:'error',message:'offline',currentVersion:'1.0.0'});assert.deepEqual(toasts,[]);
});
test('a ready update is kept and blocks further checks',()=>{
 const {t}=make();t.downloaded('1.1.0');assert.equal(t.canCheck(),false);
 t.checking();t.notAvailable();t.failed('x');t.available('1.1.0');assert.equal(t.get().state,'ready');
});
test('a check cannot start while one is running or when updates are unsupported',()=>{
 const {t}=make();t.checking();assert.equal(t.canCheck(),false);
 const u=make(false);assert.equal(u.t.get().state,'unsupported');assert.equal(u.t.canCheck(),false);u.t.checking();u.t.failed('x');assert.equal(u.t.get().state,'unsupported');assert.deepEqual(u.published,[]);
});
test('hidden launch is detected only from the sign-in argument',()=>{
 assert.equal(isHiddenLaunch(['Undertone.exe',HIDDEN_LAUNCH_ARG]),true);
 assert.equal(isHiddenLaunch(['Undertone.exe']),false);
});
