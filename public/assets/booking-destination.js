import { londonDate } from './event-calendar.js';
import { bookingUrlForEvent } from './booking-events.js';
export const eventsUrl = 'https://racehub.cobracardiff.co.uk/events/';
export function bookingDestination(events, now = new Date()) {
  const today = londonDate(now);
  const next = (Array.isArray(events) ? events : []).filter(e => e && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.date >= today && !e.completed && !e.cancelled && !/cancelled|postponed|\btest\b/i.test(e.title || '')).sort((a,b) => a.date.localeCompare(b.date))[0];
  return bookingUrlForEvent(next) || eventsUrl;
}
