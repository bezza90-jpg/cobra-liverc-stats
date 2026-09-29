import test from 'node:test';
import assert from 'node:assert/strict';
import {eventCalendarFile} from '../public/assets/calendar-download.js';
test('calendar is an all-day reminder with next-day exclusive end and escaped text',()=>{
 const text=eventCalendarFile({date:'2026-12-31',title:'Race, one; two\nHello',venue:'Cardiff',eventId:'123'},new Date('2026-09-30T01:00:00Z'));
 assert.ok(text.includes('DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101'));
 assert.ok(text.includes('SUMMARY:Race\\, one\\; two\\nHello'));
 assert.ok(!text.includes('TZID'));assert.ok(text.includes('DTSTAMP:20260930T010000Z'));
});
test('calendar rejects invalid dates and folds Unicode within the byte limit',()=>{
 assert.throws(()=>eventCalendarFile({date:'2026-02-30'}));
 const text=eventCalendarFile({date:'2026-10-04',title:'🏁'.repeat(50)});
 for(const line of text.split('\r\n')) assert.ok(Buffer.byteLength(line)<=75);
 assert.ok(text.replace(/\r\n /g,'').includes('SUMMARY:'+'🏁'.repeat(50)));
});