import test from 'node:test';
import assert from 'node:assert/strict';
import {checkPasteTarget} from '../src/shared/paste-target.ts';
import {pasteExplanation} from '../src/shared/paste-feedback.ts';
const original={canPaste:true,processIdentifier:100,windowHandle:'10',focusToken:'field1',fieldSignature:'parent|edit|input|bounds'};
test('same editor accepts direct paste; recreated editor requires a matching signature',()=>{
 assert.equal(checkPasteTarget(original,{...original}),null);
 assert.equal(checkPasteTarget(original,{...original,focusToken:'replacement'}),null);
 assert.equal(checkPasteTarget(original,{...original,focusToken:'different',fieldSignature:'other parent|other bounds'}),'field_changed');
});
test('matching field IDs never override a changed window or process',()=>{
 assert.equal(checkPasteTarget(original,{...original,windowHandle:'20'}),'window_changed');
 assert.equal(checkPasteTarget(original,{...original,processIdentifier:200}),'window_changed');
});
test('missing identifiers do not enable fallback',()=>{
 assert.equal(checkPasteTarget({...original,focusToken:'',fieldSignature:''},{...original,focusToken:'',fieldSignature:''}),'field_changed');
});
test('protected or inaccessible current field always blocks paste',()=>{
 for(const reason of ['password','disabled','read_only','accessibility_unavailable'])assert.equal(checkPasteTarget(original,{...original,canPaste:false,reason}),reason);
 assert.equal(checkPasteTarget({...original,canPaste:false,reason:'password'},original),'password');
});
test('paste outcomes explain the limitation and preserve manual recovery',()=>{
 for(const reason of ['no_field','field_changed','window_changed','modifiers_held','input_blocked','helper_unavailable'])assert.match(pasteExplanation(reason),/Ctrl\+V/);
 assert.match(pasteExplanation('sent'),/shortcut sent/);
 assert.doesNotMatch(pasteExplanation('sent'),/successfully pasted/);
});
