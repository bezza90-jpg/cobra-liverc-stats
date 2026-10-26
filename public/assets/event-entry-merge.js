import {canonicalDriverKey} from './driver-identity.js';

const identity = row => canonicalDriverKey(String(row.driverKey || row.driverName || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,''));
const key = row => `${identity(row)}|${String(row.className || '').trim().toUpperCase()}`;

function bookingDetails(row, booking) {
  const chassis = String(booking.chassis || '').trim();
  const {transponder:_transponder,transponderSource:_source,...publicRow}=row;
  return {...publicRow, ...(chassis ? {chassis, chassisSource:'wix'} : {})};
}

export function applyConfirmedChassis(data, confirmed = {}) {
  const publicData={...data,entries:(data.entries || []).map(row=>bookingDetails(row,{}))};
  if (String(data.eventId) !== String(confirmed.eventId) || data.date !== confirmed.date) return publicData;
  const chassis = new Map((confirmed.entries || []).map(row => [key(row), row.chassis]));
  return {...publicData, entries:publicData.entries.map(row => row.chassisSource !== 'wix' && chassis.has(key(row)) ? {...row, chassis:chassis.get(key(row))} : row)};
}

export function mergeCurrentWixEntries(data, wix = {}) {
  const published = Array.isArray(data?.entries) ? data.entries.map(row=>bookingDetails(row,{})) : [];
  const bookings = Array.isArray(wix?.entries) ? wix.entries.map(row=>bookingDetails(row,{})) : [];
  if ((wix.eventDate && data.date && wix.eventDate !== data.date) ||
      (wix.liveRcEventId && data.eventId && String(wix.liveRcEventId) !== String(data.eventId))) return data;
  const ticketLimits=wix.ticketLimits && typeof wix.ticketLimits==='object' ? wix.ticketLimits : data.ticketLimits;
  if (!bookings.length) return {...data,...(ticketLimits ? {ticketLimits} : {})};
  const seniorNames = new Set([...published, ...bookings].filter(row => row.className && row.className !== 'Junior Racers').map(identity));
  const bookedSeniorNames = new Set(bookings.filter(row => row.className && row.className !== 'Junior Racers').map(identity));
  const merged = published.filter(row => row.className !== 'Junior Racers' || !seniorNames.has(identity(row)))
    .map(row => ({...row}));
  const keys = new Set(merged.map(key));
  for (const booking of bookings) {
    if (!booking?.driverName || !booking?.className) continue;
    if (booking.className === 'Junior Racers' && seniorNames.has(identity(booking)) && !bookedSeniorNames.has(identity(booking))) continue;
    if (keys.has(key(booking))) {
      const index = merged.findIndex(row => key(row) === key(booking));
      merged[index] = bookingDetails(merged[index], booking);
      continue;
    }
    merged.push(bookingDetails({driverName:booking.driverName, driverKey:identity(booking), className:booking.className,
      countryCode:'GB', bookingStatus:'Wix booking'}, booking));
    keys.add(key(booking));
  }
  const wixUpdated = Date.parse(wix.updatedAt || '');
  const dataUpdated = Date.parse(data.updatedAt || '');
  return {...data, entries:merged, ...(ticketLimits ? {ticketLimits} : {}), updatedAt:wixUpdated > dataUpdated ? wix.updatedAt : data.updatedAt};
}

export function entriesForMeeting(data, wix, meeting) {
  if (!meeting) return {...data, entries:[]};
  const matches = data.date === meeting.date && String(data.eventId) === String(meeting.eventId);
  const selected = matches ? data : {eventId:String(meeting.eventId || ''),title:meeting.title,date:meeting.date,type:meeting.type,sourceUrl:meeting.resultsUrl,entries:[],updatedAt:''};
  return mergeCurrentWixEntries(selected, wix);
}
