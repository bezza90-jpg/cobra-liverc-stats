export function londonDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/London', year:'numeric', month:'2-digit', day:'2-digit'}).format(now);
}
export function nextMeeting(events, type = '', now = new Date()) {
  const today = londonDate(now);
  const matching = events.filter(event => !type || event.type === type);
  const started = matching.filter(event => event.date <= today).sort((a,b) => b.date.localeCompare(a.date));
  // Keep the most recent meeting until LiveRC confirms all its finals complete.
  if (started[0] && !started[0].completed) return started[0];
  return matching.filter(event => event.date > today && !event.completed)
    .sort((a,b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))[0] || null;
}
