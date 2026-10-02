import {canonicalDriverKey} from './driver-identity.js';

const identity = row => canonicalDriverKey(String(row.driverKey || row.driverName || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,''));
const key = row => `${identity(row)}|${String(row.className || '').trim().toUpperCase()}`;

export function applyConfirmedChassis(data, confirmed = {}) {
  if (String(data.eventId) !== String(confirmed.eventId) || data.date !== confirmed.date) return data;
  const chassis = new Map((confirmed.entries || []).map(row => [key(row), row.chassis]));
  return {...data, entries:data.entries.map(row => chassis.has(key(row)) ? {...row, chassis:chassis.get(key(row))} : row)};
}

export function mergeCurrentWixEntries(data, wix = {}) {
  const published = Array.isArray(data?.entries) ? data.entries : [];
  const bookings = Array.isArray(wix?.entries) ? wix.entries : [];
  if (!bookings.length || (wix.eventDate && data.date && wix.eventDate !== data.date) ||
      (wix.liveRcEventId && data.eventId && String(wix.liveRcEventId) !== String(data.eventId))) return data;
  const seniorNames = new Set([...published, ...bookings].filter(row => row.className && row.className !== 'Junior Racers').map(identity));
  const merged = published.filter(row => row.className !== 'Junior Racers' || !seniorNames.has(identity(row)));
  const keys = new Set(merged.map(key));
  const bookingKeys = new Set(bookings.map(key));
  for (const booking of bookings) {
    if (!booking?.driverName || !booking?.className) continue;
    if (booking.className === 'Junior Racers' && seniorNames.has(identity(booking))) continue;
    if (keys.has(key(booking))) continue;
    const transponder = String(booking.transponder || '');
    if (/^[0-9]{7}$/.test(transponder) && transponder !== '1234567') {
      const matches = merged.filter(row => row.className === booking.className &&
        String(row.transponder || '') === transponder && !bookingKeys.has(key(row)));
      if (matches.length === 1) continue;
    }
    merged.push({driverName:booking.driverName, driverKey:identity(booking), className:booking.className,
      countryCode:'GB', chassis:booking.chassis || '', transponder:booking.transponder || '', bookingStatus:'Wix booking'});
    keys.add(key(booking));
  }
  const wixUpdated = Date.parse(wix.updatedAt || '');
  const dataUpdated = Date.parse(data.updatedAt || '');
  return {...data, entries:merged, updatedAt:wixUpdated > dataUpdated ? wix.updatedAt : data.updatedAt};
}
