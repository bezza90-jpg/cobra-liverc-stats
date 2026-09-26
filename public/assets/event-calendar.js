export function londonDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/London', year:'numeric', month:'2-digit', day:'2-digit'}).format(now);
}
function monthAfter(date) {
  const [year, month, day] = date.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay))).toISOString().slice(0, 10);
}
export function nextMeeting(events, type = '', now = new Date()) {
  const today = londonDate(now);
  const matching = events.filter(event => !type || event.type === type)
    .sort((a,b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  // Keep today's meeting all day, then prefer the next published date.
  const upcoming = matching.find(event => event.date >= today);
  if (upcoming) return upcoming;
  // During the off-season retain the last meeting for one calendar month.
  const latest = matching.at(-1);
  return latest && today < monthAfter(latest.date) ? latest : null;
}
