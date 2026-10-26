import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {londonDate} from './sync-wix-event-entries.mjs';
import {validReserveEndpoint} from '../public/assets/event-reserves.js';

const data = async name => JSON.parse(await readFile(new URL(`../public/data/${name}`, import.meta.url), 'utf8'));
const [calendar, snapshot, capacities, reserve] = await Promise.all([
  data('event-calendar.json'), data('wix-current-event-entries.json'), data('event-capacities.json'), data('reserve-service.json')
]);
const today = londonDate();
const meeting = (calendar.events || []).filter(event => event.date >= today && event.bookingUrl)
  .sort((a,b) => a.date.localeCompare(b.date))[0];
assert(meeting, 'No upcoming event with a booking page is configured.');
assert.equal(snapshot.eventDate, meeting.date, 'The Wix entry feed is connected to the wrong event date.');
assert.equal(String(snapshot.liveRcEventId), String(meeting.eventId), 'The Wix entry feed is connected to the wrong LiveRC event.');
assert(snapshot.wixEventId, 'The upcoming booking page has not been matched to a Wix event.');
assert(/^https:\/\/www\.cobracardiff\.co\.uk\/event-details-1\/[a-z0-9-]+$/.test(meeting.bookingUrl), 'The booking URL is invalid.');

const limits = capacities.events?.[String(meeting.eventId)]?.limits || capacities.types?.[meeting.type] || {};
const required = meeting.type === 'sword'
  ? ['Junior Racers','2-Wheel Drive Buggy','4-Wheel Drive Buggy']
  : ['Junior Racers','2-Wheel Drive Buggy','4-Wheel Drive Buggy','Trucks','Vintage'];
for (const className of required) assert(Number.isInteger(limits[className]) && limits[className] > 0, `No capacity is configured for ${className}.`);
assert.equal(reserve.enabled, true, 'The reserve service is disabled.');
assert(validReserveEndpoint(reserve.endpoint), 'The public reserve endpoint is invalid.');
assert(validReserveEndpoint(reserve.managerEndpoint), 'The reserve manager endpoint is invalid.');

const seen = new Set();
for (const entry of snapshot.entries || []) {
  const id = `${String(entry.driverName || '').trim().toUpperCase()}|${String(entry.className || '').trim().toUpperCase()}`;
  assert(entry.driverName && entry.className, 'The Wix entry feed contains an incomplete entry.');
  assert(!seen.has(id), `The Wix entry feed contains a duplicate: ${id}.`);
  seen.add(id);
  assert(!Object.hasOwn(entry,'transponder') && !Object.hasOwn(entry,'transponderSource'), `The public Wix entry feed contains private transponder data for ${entry.driverName}.`);
  assert(String(entry.chassis || '').length <= 80, `The Wix entry feed contains an invalid chassis for ${entry.driverName}.`);
}

console.log(`Booking ready: ${meeting.title} (${meeting.eventId}); ${snapshot.entries.length} current class entries; ${required.length} class capacities; reserve service enabled.`);
