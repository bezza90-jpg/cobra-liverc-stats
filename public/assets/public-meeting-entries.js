import {getEventCalendar, nextMeeting} from './event-calendar.js?v=20261122-shared-calendar';

const feeds = new Map();

export async function getPublicMeetingEntries(type = '') {
  const calendar = await getEventCalendar().catch(() => ({}));
  const meeting = nextMeeting(calendar.events || [], type);
  if (!meeting?.date || !meeting.type) return {calendar, meeting, live: null};

  const params = new URLSearchParams({type: meeting.type, date: meeting.date});
  const key = params.toString();
  if (!feeds.has(key)) {
    params.set('fresh', String(Date.now()));
    const url = 'https://booking.cobracardiff.co.uk/api/public-meeting-bookings?' + params;
    const request = fetch(url, {cache: 'no-store'})
      .then(response => response.ok ? response.json() : null)
      .catch(() => null);
    feeds.set(key, request);
  }
  return {calendar, meeting, live: await feeds.get(key)};
}
