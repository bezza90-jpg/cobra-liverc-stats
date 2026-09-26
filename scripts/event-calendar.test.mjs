import test from 'node:test';
import assert from 'node:assert/strict';
import {nextMeeting, londonDate} from '../public/assets/event-calendar.js';
import {calendarMeetings, allFinalsComplete, finalLineupUrls} from './update-event-calendar.mjs';
const now = new Date('2026-10-04T17:00:00Z');
const current = {date:'2026-10-04', title:'SWORD Round 1', type:'sword'};
const future = {date:'2026-10-11', title:'Club Day', type:'club'};
test('keep current meeting until all finals complete, including after midnight', () => {
 assert.equal(nextMeeting([current,future],'',now),current);
 assert.equal(nextMeeting([current,future],'',new Date('2026-10-05T09:00Z')),current);
 assert.equal(nextMeeting([{...current,completed:true},future],'',now),future);
 assert.equal(nextMeeting([{...current,completed:true}],'',now),null);
 assert.equal(nextMeeting([current,future],'club',now),future);
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
