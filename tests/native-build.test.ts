import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {nativeBuildPlan, buildNative} from '../scripts/build-native.mjs';

test('Windows helper source and output use absolute native paths under a username with spaces',()=>{
 const root='C:\\Users\\Dr. Noisewater\\Downloads\\Undertone-v0.4.2';
 const plan=nativeBuildPlan('win32',root,'C:\\Windows');
 assert.equal(plan.source,root+'\\native\\UndertoneHelper.cs');
 assert.equal(plan.args.at(-1),plan.source);
 assert.equal(plan.args.filter(a=>a===plan.source).length,1);
 assert.equal(plan.args.find(a=>a.startsWith('/out:')),'/out:'+root+'\\build\\native\\undertone-helper.exe');
 assert.equal(plan.cwd,root);
 for(const file of plan.required) {assert.equal(path.win32.isAbsolute(file),true);assert.equal(file.includes('/'),false);}
});
test('source archive contains the helper at the path selected by the build',()=>{
 const root=fileURLToPath(new URL('..',import.meta.url));
 assert.ok(existsSync(path.join(root,'native','UndertoneHelper.cs')));
 assert.ok(existsSync(nativeBuildPlan('darwin',root).source));
});
const fakeRoot = 'C:\\Users\\Dr. Noisewater\\Undertone-test';
function fakeIO(exists: (file: string) => boolean) {
 const calls: {directories: unknown[]; compiler: unknown[][]} = {directories:[], compiler:[]};
 return {calls, io: {existsSync:exists, mkdirSync:(...args: unknown[])=>{calls.directories.push(args);}, spawnSync:(...args: unknown[])=>{calls.compiler.push(args);return {status:0};}}};
}
test('all missing prerequisites are reported without creating output or running a compiler',()=>{
 const f=fakeIO(()=>false);
 assert.throws(()=>buildNative('win32',fakeRoot,f.io),error=>{
  assert.match(error.message,/Native build prerequisites are missing/);
  assert.match(error.message,/native\\UndertoneHelper.cs/);
  assert.match(error.message,/UIAutomationClient\.dll/);
  assert.match(error.message,/csc\.exe/);
  return true;
 });
 assert.deepEqual(f.calls,{directories:[],compiler:[]});
});
test('installed Windows framework is not reported missing when only the source is absent',()=>{
 const f=fakeIO(file=>!file.endsWith('UndertoneHelper.cs'));
 assert.throws(()=>buildNative('win32',fakeRoot,f.io),error=>{
  assert.match(error.message,/native\\UndertoneHelper.cs/);
  assert.doesNotMatch(error.message,/UIAutomationClient\.dll|csc\.exe/);
  return true;
 });
 assert.deepEqual(f.calls,{directories:[],compiler:[]});
});
test('complete prerequisites invoke compiler once with unquoted arguments and an explicit working folder',()=>{
 const f=fakeIO(()=>true);
 assert.equal(buildNative('win32',fakeRoot,f.io),0);
 assert.equal(f.calls.directories.length,1);assert.equal(f.calls.compiler.length,1);
 const [compiler,args,options]=f.calls.compiler[0] as [string,string[],{cwd:string;shell:boolean}];
 assert.ok(compiler.endsWith('csc.exe'));
 assert.equal(args.at(-1),fakeRoot+'\\native\\UndertoneHelper.cs');
 assert.equal(options.cwd,fakeRoot);assert.equal(options.shell,false);
});
test('compiler failure status is propagated to the build',()=>{
 const f=fakeIO(()=>true);
 assert.equal(buildNative('win32',fakeRoot,{...f.io,spawnSync:()=>({status:7})}),7);
});
