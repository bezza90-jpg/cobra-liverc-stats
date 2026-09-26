import test from 'node:test';
import assert from 'node:assert/strict';
import {nextMeeting, londonDate} from '../public/assets/event-calendar.js';
import {calendarMeetings, allFinalsComplete, finalLineupUrls} from './update-event-calendar.mjs';
const now = new Date('2026-10-04T17:00:00Z');
const current = {date:'2026-10-04', title:'SWORD Round 1', type:'sword'};
const future = {date:'2026-10-11', title:'Club Day', type:'club'};
test('keep today even when complete and roll over at UK midnight', () => {
 assert.equal(nextMeeting([current,future],'',now),current);
 const complete = {...current,completed:true};
 assert.equal(nextMeeting([complete,future],'',now),complete);
 assert.equal(nextMeeting([current,future],'',new Date('2026-10-04T22:59:59Z')),current);
 assert.equal(nextMeeting([current,future],'',new Date('2026-10-04T23:00:00Z')),future);
 assert.equal(nextMeeting([current],'',new Date('2026-10-04T23:00:00Z')),current);
 assert.equal(nextMeeting([current,future],'club',now),future);
 assert.equal(nextMeeting([current,future],'sword',new Date('2026-10-05T09:00Z')),current);
});
test('winter rollover uses GMT midnight', () => {
 const winter = {...current,date:'2026-12-06'};
 const next = {...future,date:'2026-12-13'};
 assert.equal(nextMeeting([winter,next],'',new Date('2026-12-06T23:59:59Z')),winter);
 assert.equal(nextMeeting([winter,next],'',new Date('2026-12-07T00:00:00Z')),next);
});

test('UK dates include BST midnight', () => assert.equal(londonDate(new Date('2026-10-03T23:30Z')),'2026-10-04'));
test('future zero-entry meetings are included; tests and cancelled meetings are excluded', () => {
 const raw = name => ({name,date:'2026-10-04',entries:0,liveRcEventId:'1',sourceUrl:'https://cobracardiff.liverc.com/results/?p=view_event&id=1'});
 assert.deepEqual(calendarMeetings([raw('SWORD Round 1'),raw('Club test'),raw('Club cancelled')]).map(e=>e.title),['SWORD Round 1']);
});
test('completion needs every scheduled final and result link, not just an overall ranking', () => {
 const complete = '<span class="class_header">2WD A-Main</span><span class="race_status">Status: Complete (<a href="?p=view_race_result&id=1">View Results</a>)</span>';
 const pending = '<span class="class_header">4WD A-Main</span><span class="race_status">Status: Not Started</span>';
 assert.equal(allFinalsComplete(complete),true);
 assert.equal(allFinalsComplete(complete+pending),false);
 assert.equal(allFinalsComplete(''),false);
 assert.equal(allFinalsComplete(complete+'<span class="class_header">Junior A-Main</span>'),false);
 assert.deepEqual(finalLineupUrls('<a href="/results/?p=view_heat_sheet&amp;id=2">Main Events</a><a href="?p=view_heat_sheet&id=3">Qualifier Round 4</a>'),['https://cobracardiff.liverc.com/results/?p=view_heat_sheet&id=2']);
});

import {parseBooking,matchBooking} from './booking-calendar.mjs';
test('booking matches exact date and type, not a guessed slug', () => {
 const url='https://www.cobracardiff.co.uk/event-details-1/cobra-sword-round-1';
 const html='<script type="application/ld+json">'+JSON.stringify({'@type':'Event',name:'COBRA SWORD Round 1',startDate:'2026-10-04T08:00:00+01:00',eventStatus:'https://schema.org/EventScheduled'})+'</script>';
 const bookings=parseBooking(html,url);
 assert.equal(matchBooking({date:'2026-10-04',type:'sword'},bookings),url);
 assert.equal(matchBooking({date:'2026-10-11',type:'sword'},bookings),'');
 assert.equal(matchBooking({date:'2026-10-04',type:'club'},bookings),'');
 assert.equal(matchBooking({date:'2026-10-04',type:'sword'},[...bookings,{...bookings[0],url:url+'-other'}]),'');
 assert.deepEqual(parseBooking(html.replace('EventScheduled','EventCancelled'),url),[]);
 assert.deepEqual(parseBooking(html,'https://example.com/event-details-1/fake'),[]);
});

test('last meeting remains for one calendar month unless a future date is published', () => {
 const last = {...current, date:'2026-03-21', completed:true};
 const next = {...future, date:'2026-10-04'};
 assert.equal(nextMeeting([last],'',new Date('2026-04-20T22:59:59Z')),last);
 assert.equal(nextMeeting([last],'',new Date('2026-04-20T23:00:00Z')),null);
 assert.equal(nextMeeting([last,next],'',new Date('2026-03-22T12:00Z')),next);
 assert.equal(nextMeeting([],'',now),null);
});
test('one-month fallback clamps month-end and crosses year boundaries', () => {
 const jan = {...current,date:'2026-01-31'};
 assert.equal(nextMeeting([jan],'',new Date('2026-02-27T23:59:59Z')),jan);
 assert.equal(nextMeeting([jan],'',new Date('2026-02-28T00:00:00Z')),null);
 const dec = {...current,date:'2026-12-21'};
 assert.equal(nextMeeting([dec],'',new Date('2027-01-20T23:59:59Z')),dec);
 assert.equal(nextMeeting([dec],'',new Date('2027-01-21T00:00:00Z')),null);
});
