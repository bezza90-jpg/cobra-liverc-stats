import { londonDate } from './event-calendar.js';
export const eventsUrl = 'https://www.cobracardiff.co.uk/event-list';
export function bookingDestination(events, now = new Date()) {
  const today = londonDate(now);
  const next = (Array.isArray(events) ? events : []).filter(e => e && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.date >= today && !e.completed && !e.cancelled && !/cancelled|postponed|\btest\b/i.test(e.title || '')).sort((a,b) => a.date.localeCompare(b.date))[0];
  try {
    const url = new URL(next?.bookingUrl);
    if (url.origin === 'https://www.cobracardiff.co.uk' && /^\/event-details-1\/[^/]+\/?$/.test(url.pathname) && !url.username && !url.password) return url.href;
  } catch {}
  return eventsUrl;
}
