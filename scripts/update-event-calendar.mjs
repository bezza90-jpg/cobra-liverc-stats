import {loadBookings, matchBooking} from './booking-calendar.mjs';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { BASE_URL, fetchText, parseArchive, parseEventIndex, parseOverall } from './lib/liverc.mjs';
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
  const output = JSON.stringify({sourceUrl:BASE_URL + '/events/', events:selected}, null, 2) + '\n';
  const previous = await readFile(file, 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error; });
  if (output !== previous) {
    const temporary = new URL('../public/data/event-calendar.json.tmp', import.meta.url);
    await writeFile(temporary, output);
    await rename(temporary, file);
  }
  console.log(`Calendar refreshed: ${selected.length} meetings.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await updateEventCalendar(parseArchive(await fetchText(BASE_URL + '/events/')));
}
