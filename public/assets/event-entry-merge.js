import {canonicalDriverKey} from './driver-identity.js';

const identity = row => canonicalDriverKey(String(row.driverKey || row.driverName || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,''));
const key = row => `${identity(row)}|${String(row.className || '').trim().toUpperCase()}`;
const validNumber = value => /^[0-9]{7}$/.test(String(value || '')) && String(value) !== '1234567';

function bookingDetails(row, booking, history) {
  const chassis = String(booking.chassis || '').trim();
  const wixNumber = validNumber(booking.transponder) && booking.transponderSource !== 'history';
  const transponder = wixNumber ? String(booking.transponder) :
    validNumber(row.transponder) ? String(row.transponder) :
    validNumber(booking.transponder) ? String(booking.transponder) : history.get(key(booking)) || '';
  return {...row, ...(chassis ? {chassis, chassisSource:'wix'} : {}), transponder};
}

export function applyConfirmedChassis(data, confirmed = {}) {
  if (String(data.eventId) !== String(confirmed.eventId) || data.date !== confirmed.date) return data;
  const chassis = new Map((confirmed.entries || []).map(row => [key(row), row.chassis]));
  return {...data, entries:data.entries.map(row => row.chassisSource !== 'wix' && chassis.has(key(row)) ? {...row, chassis:chassis.get(key(row))} : row)};
}

export function mergeCurrentWixEntries(data, wix = {}, previousTransponders = []) {
  const published = Array.isArray(data?.entries) ? data.entries : [];
  const bookings = Array.isArray(wix?.entries) ? wix.entries : [];
  if (!bookings.length || (wix.eventDate && data.date && wix.eventDate !== data.date) ||
      (wix.liveRcEventId && data.eventId && String(wix.liveRcEventId) !== String(data.eventId))) return data;
  const seniorNames = new Set([...published, ...bookings].filter(row => row.className && row.className !== 'Junior Racers').map(identity));
  const bookedSeniorNames = new Set(bookings.filter(row => row.className && row.className !== 'Junior Racers').map(identity));
  const history = new Map(previousTransponders.filter(row => validNumber(row.transponder) &&
    (!row.eventDate || !data.date || row.eventDate < data.date)).slice()
    .sort((a,b) => String(a.eventDate || '').localeCompare(String(b.eventDate || '')))
    .map(row => [key(row), String(row.transponder)]));
  const merged = published.filter(row => row.className !== 'Junior Racers' || !seniorNames.has(identity(row)))
    .map(row => ({...row, transponder:validNumber(row.transponder) ? String(row.transponder) : history.get(key(row)) || ''}));
  const keys = new Set(merged.map(key));
  const bookingKeys = new Set(bookings.map(key));
  for (const booking of bookings) {
    if (!booking?.driverName || !booking?.className) continue;
    if (booking.className === 'Junior Racers' && seniorNames.has(identity(booking)) && !bookedSeniorNames.has(identity(booking))) continue;
    if (keys.has(key(booking))) {
      const index = merged.findIndex(row => key(row) === key(booking));
      merged[index] = bookingDetails(merged[index], booking, history);
      continue;
    }
    const transponder = String(booking.transponder || '');
    if (/^[0-9]{7}$/.test(transponder) && transponder !== '1234567') {
      const matches = merged.filter(row => row.className === booking.className &&
        String(row.transponder || '') === transponder && !bookingKeys.has(key(row)));
      if (matches.length === 1) {
        const index = merged.indexOf(matches[0]);
        merged[index] = bookingDetails(matches[0], booking, history);
        continue;
      }
    }
    merged.push(bookingDetails({driverName:booking.driverName, driverKey:identity(booking), className:booking.className,
      countryCode:'GB', bookingStatus:'Wix booking'}, booking, history));
    keys.add(key(booking));
  }
  const wixUpdated = Date.parse(wix.updatedAt || '');
  const dataUpdated = Date.parse(data.updatedAt || '');
  return {...data, entries:merged, updatedAt:wixUpdated > dataUpdated ? wix.updatedAt : data.updatedAt};
}

export function entriesForMeeting(data, wix, meeting, previousTransponders = []) {
  if (!meeting) return {...data, entries:[]};
  const matches = data.date === meeting.date && String(data.eventId) === String(meeting.eventId);
  const selected = matches ? data : {eventId:String(meeting.eventId || ''),title:meeting.title,date:meeting.date,type:meeting.type,sourceUrl:meeting.resultsUrl,entries:[],updatedAt:''};
  return mergeCurrentWixEntries(selected, wix, previousTransponders);
}
