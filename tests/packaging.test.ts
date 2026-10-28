import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
require('app-builder-lib');
const {WinPackager}=require('app-builder-lib/out/winPackager.js');
const config=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).build;
test('packaging configuration skips the upstream Windows executable editing/download stage',async()=>{
 const packager={platformSpecificBuildOptions:config.win,appInfo:{productFilename:'Undertone'},
 signAndEditResources:()=>{throw new Error('Must not invoke resource-edit tools');}};
 assert.equal(await WinPackager.prototype.signApp.call(packager,{appOutDir:'nonexistent'},true),false);
 assert.equal(WinPackager.prototype.createTransformerForExtraFiles.call(packager,{}),null);
});

test('Windows icon branding preserves unrelated resources and embeds every icon size',()=>{
 const {NtExecutable,NtExecutableResource,Resource,Data}=require('resedit');
 const {brandExecutable}=require('../scripts/brand-windows.cjs');
 const exe=NtExecutable.createEmpty(false,false);
 const resources=NtExecutableResource.from(exe);
 const manifest=Buffer.from('<assembly>keep this manifest</assembly>');
 resources.entries.push({type:24,id:1,lang:1033,codepage:0,bin:manifest.buffer.slice(manifest.byteOffset,manifest.byteOffset+manifest.byteLength)});
 const icon=readFileSync(new URL('../build/icons/icon.ico',import.meta.url));
 const images=Data.IconFile.from(icon).icons.map((i:any)=>i.data);
 Resource.IconGroupEntry.replaceIconsForResource(resources.entries,99,1033,images.slice(0,1));
 resources.outputResource(exe);
 const result=NtExecutableResource.from(NtExecutable.from(brandExecutable(Buffer.from(exe.generate()),icon)));
 const groups=Resource.IconGroupEntry.fromEntries(result.entries);
 assert.equal(groups.length,1);assert.equal(groups[0].id,1);
 assert.equal(groups[0].icons.length,7);
 assert.deepEqual(Buffer.from(result.entries.find((e:any)=>e.type===24).bin),manifest);
 const actual=groups[0].getIconItemsFromEntries(result.entries);
 for(let i=0;i<images.length;i++)assert.deepEqual(Buffer.from(actual[i].bin),Buffer.from(images[i].bin));
 assert.equal(config.afterPack,'scripts/brand-windows.cjs');
});

test('packaging hook brands Windows paths with spaces and skips other platforms',async()=>{
 const {mkdtemp,writeFile,readFile,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');const path=await import('node:path');
 const {NtExecutable,NtExecutableResource,Resource}=require('resedit');
 const hook=require('../scripts/brand-windows.cjs');
 await hook({electronPlatformName:'darwin'});
 const dir=await mkdtemp(path.join(tmpdir(),'Undertone icon test '));
 try {
  await writeFile(path.join(dir,'Undertone.exe'),Buffer.from(NtExecutable.createEmpty(false,false).generate()));
  await hook({electronPlatformName:'win32',appOutDir:dir,packager:{projectDir:fileURLToPath(new URL('..',import.meta.url)),appInfo:{productFilename:'Undertone'}}});
  const resources=NtExecutableResource.from(NtExecutable.from(await readFile(path.join(dir,'Undertone.exe'))));
  assert.equal(Resource.IconGroupEntry.fromEntries(resources.entries).length,1);
 } finally {await rm(dir,{recursive:true,force:true});}
});
