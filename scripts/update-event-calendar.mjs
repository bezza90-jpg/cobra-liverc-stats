import {canonicalDriverKey,canonicalDriverName} from '../public/assets/driver-identity.js';
import {chassisChoice} from './chassis-choice.mjs';
import {loadBookings, matchBooking} from './booking-calendar.mjs';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { BASE_URL, driverKey, fetchText, parseArchive, parseEntryList, parseEventIndex, parseOverall } from './lib/liverc.mjs';
import { londonDate } from '../public/assets/event-calendar.js';
export function calendarMeetings(events) {
  return events.filter(event => /^\d{4}-\d{2}-\d{2}$/.test(event.date) &&
    !/\b(test|testing|cancelled|canceled)\b/i.test(event.name) &&
    /\b(sword|club)\b/i.test(event.name))
    .map(event => ({title:event.name, date:event.date, type:/sword/i.test(event.name) ? 'sword' : 'club', eventId:event.liveRcEventId, resultsUrl:event.sourceUrl}))
    .sort((a,b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}
export function finalLineupUrls(html) {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .filter(([,url,label]) => url.includes('p=view_heat_sheet') && /\b(main|final)\b/i.test(label.replace(/<[^>]*>/g,'')))
    .map(([,url]) => new URL(url.replaceAll('&amp;','&'),BASE_URL).href);
}
export function allFinalsComplete(html) {
  const classes = [...html.matchAll(/<span\b[^>]*class=["']class_header["'][^>]*>([\s\S]*?)<\/span>/gi)];
  const statuses = [...html.matchAll(/<span\b[^>]*class=["']race_status["'][^>]*>([\s\S]*?)<\/span>/gi)];
  return classes.length > 0 && statuses.length === classes.length && statuses.every(([,status]) =>
    /^Status:\s*Complete\b/i.test(status.replace(/<[^>]*>/g,'').trim()) && /p=view_race_result/.test(status));
}

export function enrichNextEventEntries(meeting, entries, chassis = {}, overrides = {}) {
  const defaultCountryCode = String(overrides.defaultCountryCode || 'GB').trim().toUpperCase();
  const driverOverrides = overrides.drivers || {};
  return {
    eventId: meeting?.eventId || '',
    title: meeting?.title || 'Next COBRA race meeting',
    date: meeting?.date || '',
    type: meeting?.type || '',
    sourceUrl: meeting?.resultsUrl || BASE_URL + '/events/',
    updatedAt: new Date().toISOString(),
    entries: entries.map(entry => {
      const sourceKey=driverKey(entry.driverName);
      const key = canonicalDriverKey(sourceKey);
      const override = driverOverrides[key] || driverOverrides[sourceKey] || {};
      return {
        driverKey: key,
        driverName: canonicalDriverName(key,entry.driverName),
        ...(key !== sourceKey ? {bookingName:entry.driverName} : {}),
        className: entry.className,
        countryCode: String(override.countryCode || defaultCountryCode).trim().toUpperCase(),
        chassis: chassisChoice(override, entry.chassis || chassis[key]?.name || chassis[sourceKey]?.name || ''),
        transponder: entry.transponder
      };
    })
  };
}

export function mergeWixEntries(meeting, liveEntries, wixSnapshot) {
  if (!wixSnapshot || String(wixSnapshot.liveRcEventId || '') !== String(meeting?.eventId || '')) return liveEntries;
  const merged=new Map();
  const key=row => `${canonicalDriverKey(driverKey(row.driverName))}|${String(row.className || '').trim().toUpperCase()}`;
  const identity=row=>canonicalDriverKey(driverKey(row.driverName));
  const liveNames=new Set(liveEntries.map(identity));
  const wixSeniorNames=new Set((wixSnapshot.entries || []).filter(row=>row.className!=='Junior Racers').map(identity));
  for (const row of liveEntries) merged.set(key(row),{...row});
  for (const row of wixSnapshot.entries || []) {
    if (!row.driverName || !row.className) continue;
    // A Junior ticket can be used for the under-16 price even when the driver
    // is racing in a senior car class. Respect the senior event assignment.
    if (row.className==='Junior Racers' && (liveNames.has(identity(row)) || wixSeniorNames.has(identity(row)))) continue;
    let id=key(row), current=merged.get(id);
    const transponder=/^[0-9]{7}$/.test(String(row.transponder || '')) ? String(row.transponder) : '';
    // A booking name can differ from the established LiveRC name. When one
    // valid transponder uniquely identifies an existing driver in the same
    // class, merge into that row instead of publishing a duplicate entrant.
    if (!current && transponder) {
      const transponderMatches=[...merged.entries()].filter(([,candidate]) =>
        candidate.className===row.className && String(candidate.transponder || '')===transponder);
      if (transponderMatches.length===1) [id,current]=transponderMatches[0];
    }
    const currentChassis=String(row.chassis || '').trim();
    if (current) merged.set(id,{...current,...(transponder ? {transponder} : {}),...(currentChassis ? {chassis:currentChassis} : {})});
    else merged.set(id,{driverName:row.driverName,className:row.className,transponder,...(currentChassis ? {chassis:currentChassis} : {})});
  }
  return [...merged.values()];
}

async function writeIfChanged(file, value) {
  const output = JSON.stringify(value, null, 2) + '\n';
  const previous = await readFile(file, 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error; });
  if (output === previous) return false;
  const temporary = new URL(file.href + '.tmp');
  await writeFile(temporary, output);
  await rename(temporary, file);
  return true;
}

async function updateNextEventEntries(meetings, today) {
  const ordered = [...meetings].sort((a,b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  const meeting = ordered.find(event => event.date >= today) || ordered.at(-1);
  const destination = new URL('../public/data/next-event-entries.json', import.meta.url);
  if (!meeting) {
    await writeIfChanged(destination, enrichNextEventEntries(null, []));
    return 0;
  }
  const eventHtml = await fetchText(meeting.resultsUrl);
  const entryListUrl = parseEventIndex(eventHtml).entryList;
  const entries = entryListUrl ? parseEntryList(await fetchText(entryListUrl)) : [];
  const wixSnapshot = JSON.parse(await readFile(new URL('../public/data/wix-current-event-entries.json', import.meta.url), 'utf8').catch(() => 'null'));
  const chassis = JSON.parse(await readFile(new URL('../public/data/liverc-chassis.json', import.meta.url), 'utf8').catch(() => '{}'));
  const overrides = JSON.parse(await readFile(new URL('../public/data/next-event-entry-overrides.json', import.meta.url), 'utf8').catch(() => '{}'));
  const mergedEntries=mergeWixEntries(meeting,entries,wixSnapshot);
  await writeIfChanged(destination, enrichNextEventEntries(meeting, mergedEntries, chassis, overrides));
  return mergedEntries.length;
}
export async function updateEventCalendar(events) {
  const meetings = calendarMeetings(events);
  if (!meetings.length) throw Error('No recognised meetings found; keeping the previous calendar.');
  const today = londonDate();
  // Retain the latest past/current meeting of each type plus all future meetings.
  const recent = ['club','sword'].map(type => meetings.filter(e => e.type === type && e.date <= today).at(-1)).filter(Boolean);
  const selected = [...recent, ...meetings.filter(e => e.date > today)];
  for (const meeting of recent) {
    const eventHtml = await fetchText(meeting.resultsUrl);
    const lineups = finalLineupUrls(eventHtml);
    const summaryUrl = parseEventIndex(eventHtml).overall;
    const summary = summaryUrl ? parseOverall(await fetchText(summaryUrl)) : [];
    meeting.completed = lineups.length > 0 && summary.some(row => row.finalPosition > 0 && /(?:main|final)/i.test(row.raceTier));
    for (const url of lineups) {
      if (!allFinalsComplete(await fetchText(url))) meeting.completed = false;
    }
  }
  const bookings = await loadBookings();
  for (const meeting of selected) meeting.bookingUrl = matchBooking(meeting, bookings);
  const file = new URL('../public/data/event-calendar.json', import.meta.url);
  await writeIfChanged(file, {sourceUrl:BASE_URL + '/events/', events:selected});
  const entryCount = await updateNextEventEntries(selected, today);
  console.log(`Calendar refreshed: ${selected.length} meetings; ${entryCount} next-event entries.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await updateEventCalendar(parseArchive(await fetchText(BASE_URL + '/events/')));
}
