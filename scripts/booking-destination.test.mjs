import test from 'node:test';
import assert from 'node:assert/strict';
import {bookingDestination,eventsUrl} from '../public/assets/booking-destination.js';
const first={date:'2026-10-04',title:'SWORD Round 1',bookingUrl:'https://www.cobracardiff.co.uk/event-details-1/cobra-sword-round-1'};
const second={date:'2026-10-11',title:'Club Day',bookingUrl:'https://www.cobracardiff.co.uk/event-details-1/cobra-club-day-2'};
test('booking chooses next meeting and rolls at UK midnight',()=>{assert.equal(bookingDestination([second,first],new Date('2026-10-04T22:59:59Z')),first.bookingUrl);assert.equal(bookingDestination([first,second],new Date('2026-10-04T23:00:00Z')),second.bookingUrl)});
test('past, complete or cancelled meetings are not booking targets',()=>{assert.equal(bookingDestination([{...first,completed:true},second],new Date('2026-10-01')),second.bookingUrl);assert.equal(bookingDestination([{...first,cancelled:true}],new Date('2026-10-01')),eventsUrl);assert.equal(bookingDestination([first],new Date('2026-11-01')),eventsUrl)});
test('missing or untrusted booking links fall back without skipping the nearest meeting',()=>{for(const bookingUrl of ['', 'https://evil.test/event-details-1/a','https://www.cobracardiff.co.uk/elsewhere'])assert.equal(bookingDestination([{...first,bookingUrl},second],new Date('2026-10-01')),eventsUrl);assert.equal(bookingDestination(null),eventsUrl)});
