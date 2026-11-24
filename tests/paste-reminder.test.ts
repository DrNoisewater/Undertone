import test from 'node:test';
import assert from 'node:assert/strict';
import {pasteReminderFor, PasteReminderCard, REMINDER_FADE_MS} from '../src/shared/paste-reminder.ts';

function surface(){const state={visible:false,shows:0,last:null as unknown};return {state,api:{show:(r:unknown)=>{state.visible=true;state.shows++;state.last=r;},hide:()=>{state.visible=false;}}};}

test('confirmed paste shows no card; definite misses stay; unsure cases fade',()=>{
 assert.equal(pasteReminderFor('hello',true,'sent','confirmed'),null);
 assert.equal(pasteReminderFor('hello',true,'sent','missing')?.persistent,true);
 assert.equal(pasteReminderFor('hello',true,'sent_window','unknown')?.persistent,false);
 assert.equal(pasteReminderFor('hello',true,'sent')?.persistent,false);
 assert.equal(pasteReminderFor('hello',false,'window_changed')?.persistent,true);
 assert.equal(pasteReminderFor('hello',false,'helper_unavailable')?.persistent,true);
 assert.equal(pasteReminderFor('hello',false,'auto_paste_off')?.persistent,false);
 assert.equal(pasteReminderFor('   ',false,'window_changed'),null);
 assert.equal(pasteReminderFor('one\n\ntwo  three',false,'no_target')?.preview,'one two three');
 assert.match(pasteReminderFor('hi',false,'no_target','unknown','Command+V')!.title,/Command\+V/);
});

test('unsure card fades after 20 seconds; a definite miss stays',(t)=>{
 t.mock.timers.enable({apis:['setTimeout','Date']});
 const f=surface(),card=new PasteReminderCard(f.api);
 card.show('hi',pasteReminderFor('hi',true,'sent','unknown'));
 assert.equal(f.state.visible,true);t.mock.timers.tick(REMINDER_FADE_MS-1);assert.equal(f.state.visible,true);
 t.mock.timers.tick(1);assert.equal(f.state.visible,false);assert.equal(card.visible,false);
 card.show('hi',pasteReminderFor('hi',false,'window_changed'));t.mock.timers.tick(REMINDER_FADE_MS*10);assert.equal(f.state.visible,true);
 card.hide();
});

test('the user pressing Ctrl+V takes the card down, but Undertone\'s own paste does not',(t)=>{
 t.mock.timers.enable({apis:['setTimeout','Date']});
 const f=surface(),card=new PasteReminderCard(f.api);
 card.show('hi',pasteReminderFor('hi',false,'window_changed'));
 t.mock.timers.tick(100);card.pasteKeyPressed();assert.equal(f.state.visible,true);
 t.mock.timers.tick(1000);card.pasteKeyPressed();assert.equal(f.state.visible,false);
});

test('copying something else takes the card down; the same text (any line endings) does not',(t)=>{
 t.mock.timers.enable({apis:['setTimeout','Date']});
 const f=surface(),card=new PasteReminderCard(f.api);
 card.show('a\nb',pasteReminderFor('a\nb',false,'window_changed'));
 card.clipboardIs('a\r\nb');assert.equal(f.state.visible,true);
 card.clipboardIs('something else');assert.equal(f.state.visible,false);
});

test('a new reminder replaces the old one and its timer; no card means nothing shown',(t)=>{
 t.mock.timers.enable({apis:['setTimeout','Date']});
 const f=surface(),card=new PasteReminderCard(f.api);
 card.show('a',pasteReminderFor('a',true,'sent','unknown'));t.mock.timers.tick(REMINDER_FADE_MS-10);
 card.show('b',pasteReminderFor('b',false,'window_changed'));t.mock.timers.tick(REMINDER_FADE_MS);
 assert.equal(f.state.visible,true);assert.equal(f.state.shows,2);
 card.show('c',null);assert.equal(f.state.visible,false);assert.equal(f.state.shows,2);
});
