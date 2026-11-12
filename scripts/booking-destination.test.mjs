import test from 'node:test';
import assert from 'node:assert/strict';
import {bookingDestination,eventsUrl} from '../public/assets/booking-destination.js';
const first={date:'2026-11-29',type:'club',title:'Club Day'};
const second={date:'2026-12-13',type:'sword',title:'SWORD Round 3'};
const url=id=>'https://headless-bkqwbmqsasx-bezza90-1407.wix-site-host.com/booking-preview?event='+id;
test('booking chooses the next mapped meeting in the new flow',()=>{assert.equal(bookingDestination([second,first],new Date('2026-11-12T12:00:00Z')),url('9147a804-de9d-4d34-b73e-8138a2d3ab43'));assert.equal(bookingDestination([second],new Date('2026-11-30T00:00:00Z')),url('eb75cf50-1bbb-4f78-91b2-bc8c0c8b9cba'))});
test('past, complete or cancelled meetings are not booking targets',()=>{assert.equal(bookingDestination([{...first,completed:true},second],new Date('2026-11-01')),url('eb75cf50-1bbb-4f78-91b2-bc8c0c8b9cba'));assert.equal(bookingDestination([{...first,cancelled:true}],new Date('2026-11-01')),eventsUrl);assert.equal(bookingDestination([first],new Date('2026-12-01')),eventsUrl)});
test('an unmapped event falls back to the RaceHub event chooser',()=>{assert.equal(bookingDestination([{date:'2027-05-01',type:'club',title:'Unmapped'}],new Date('2027-04-01')),eventsUrl);assert.equal(bookingDestination(null),eventsUrl)});
