import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSpokenCommands as format, replaceWords as replace, validateReplacements as validate } from '../src/shared/text-tools.ts';
test('spoken paragraphs and line breaks handle case and transcriber punctuation',()=>{
 assert.equal(format('Hello. New paragraph. Next new line Item'), 'Hello.\n\nNext\nItem');
});
test('explicit punctuation commands do not consume ordinary punctuation words',()=>{
 assert.equal(format('Hello insert comma world insert exclamation mark'), 'Hello, world!');
 assert.equal(format('A period of time and a comma in prose.'), 'A period of time and a comma in prose.');
 assert.equal(format('Ready insert question mark'), 'Ready?');
});
test('literal command escape and word boundaries preserve ordinary text',()=>{
 assert.equal(format('Say literal new paragraph. Now literal insert comma'), 'Say new paragraph. Now insert comma');
 assert.equal(format('A new lineage and a new paragraphical idea'), 'A new lineage and a new paragraphical idea');
});
test('standalone and trailing break commands are useful on their own',()=>{
 assert.equal(format('New paragraph.'),'\n\n');
 assert.equal(format('Hello new line'),'Hello\n');
});
test('whole phrase replacements preserve configured spelling without touching substrings',()=>{
 assert.equal(replace('NOISE WATER LABS makes stagehand, not backstagehand.',[{from:'noise water labs',to:'Noisewater Labs'},{from:'stagehand',to:'Stagehand'}]),'Noisewater Labs makes Stagehand, not backstagehand.');
});
test('longest replacement wins and replacements cannot cascade',()=>{
 assert.equal(replace('noise water labs and noise', [{from:'noise',to:'sound'},{from:'noise water labs',to:'Noisewater Labs'},{from:'sound',to:'wrong'}]),'Noisewater Labs and sound');
});
test('replacement phrases and output are literal, including regex and dollar characters',()=>{
 assert.equal(replace('C++ and a.b',[{from:'C++',to:'$& code'},{from:'a.b',to:'A+B'}]),'$& code and A+B');
});
test('replacements respect unicode word boundaries and paragraph structure',()=>{
 assert.equal(replace('café décafé café',[{from:'café',to:'Coffee'}]),'Coffee décafé Coffee');
 assert.equal(replace('noise\nwater',[{from:'noise water',to:'Noisewater'}]),'noise\nwater');
});
test('replacement validation rejects blank, duplicate, oversized and malformed entries',()=>{
 for(const input of [null,[{from:'',to:'x'}],[{from:'x',to:''}],[{from:'hi',to:'x'},{from:'HI',to:'y'}],[{from:'x\ny',to:'z'}],Array(101).fill({from:'x',to:'y'})])assert.throws(()=>validate(input));
 assert.deepEqual(validate([{from:' name ',to:' Name '}]),[{from:'name',to:'Name'}]);
});

test('Verbatim applies enabled formatting and replacements without a model',async()=>{
 const {prepareDictationText}=await import('../src/shared/text-tools.ts');
 assert.deepEqual(await prepareDictationText('Hello new line noise water',{spokenFormatting:true,wordReplacements:[{from:'noise water',to:'Noisewater'}]}),{finalText:'Hello\nNoisewater',usedRewriteFallback:false});
});
test('disabled formatting preserves command words',async()=>{
 const {prepareDictationText}=await import('../src/shared/text-tools.ts');
 assert.equal((await prepareDictationText('Hello new line',{spokenFormatting:false,wordReplacements:[]})).finalText,'Hello new line');
});
test('personal spelling wins after polish and failed polish retains formatting',async()=>{
 const {prepareDictationText}=await import('../src/shared/text-tools.ts');
 const options={spokenFormatting:true,wordReplacements:[{from:'noise water',to:'Noisewater'}]};
 assert.equal((await prepareDictationText('raw',options,async()=> 'noise water')).finalText,'Noisewater');
 assert.deepEqual(await prepareDictationText('noise water new line Hello',options,async()=>{throw new Error('offline');}),{finalText:'Noisewater\nHello',usedRewriteFallback:true});
});
test('model cannot flatten explicit paragraphs or replace a pure newline command',async()=>{
 const {prepareDictationText}=await import('../src/shared/text-tools.ts');
 const options={spokenFormatting:true,wordReplacements:[]};
 assert.deepEqual(await prepareDictationText('One new paragraph Two',options,async()=> 'One Two'),{finalText:'One\n\nTwo',usedRewriteFallback:true});
 let calls=0;assert.equal((await prepareDictationText('new line',options,async()=>{calls++;return 'bad';})).finalText,'\n');assert.equal(calls,0);
});

test('all punctuation aliases support insert, add, type and optional article',()=>{
 const aliases: Record<string,string>={comma:',',period:'.','full stop':'.','question mark':'?','exclamation mark':'!','exclamation point':'!',colon:':',semicolon:';'};
 for(const [name,symbol] of Object.entries(aliases)) for(const verb of ['insert','add','type']) for(const article of ['', 'a ']) {
  assert.equal(format(`Hello ${verb} ${article}${name}.`),`Hello${symbol}`);
  assert.equal(format(`Hello ${verb} ${article}${name}.`,true),`Hello${symbol}`);
 }
});
test('line and paragraph alternatives preserve standalone and consecutive breaks',()=>{
 for(const alias of ['new line','next line','line break']) assert.equal(format(`One ${alias}. Two`),'One\nTwo');
 for(const alias of ['new paragraph','next paragraph','paragraph break']) assert.equal(format(`${alias}.`),'\n\n');
 assert.equal(format('One next line next paragraph Two'),'One\n\n\nTwo');
});
test('short names are opt-in and literal escapes work without cascading',()=>{
 assert.equal(format('That was a difficult period.'),'That was a difficult period.');
 assert.equal(format('Hello comma world full stop',true),'Hello, world.');
 assert.equal(format('literal question mark literal add a comma literal next paragraph',true),'question mark add a comma next paragraph');
 assert.equal(format('literal period literal type a full stop'),'period type a full stop');
 assert.equal(format('literal comma, literal period.',true),'comma, period.');
 assert.equal(format('periodical semicolons commaé',true),'periodical semicolons commaé');
});
test('aliases accept case and horizontal whitespace but never join across paragraphs',()=>{
 assert.equal(format('Hello ADD\tA  COMMA world'),'Hello, world');
 assert.equal(format('add\na comma'),'add\na comma');
});
test('short-command preference reaches Verbatim; formatting master switch disables everything',async()=>{
 const {prepareDictationText}=await import('../src/shared/text-tools.ts');
 const opts={spokenFormatting:true,shortPunctuationCommands:true,wordReplacements:[]};
 assert.equal((await prepareDictationText('Hello comma next line world period',opts)).finalText,'Hello,\nworld.');
 const raw='Hello comma add a period next paragraph literal comma';
 assert.equal((await prepareDictationText(raw,{...opts,spokenFormatting:false})).finalText,raw);
});
