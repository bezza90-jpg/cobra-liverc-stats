import { nextMeeting, londonDate } from './event-calendar.js?v=20260926-midnight';
(async () => {
  'use strict';
  const element = id => document.getElementById(id);
  try {
    const [eventResponse, scheduleResponse, calendarResponse] = await Promise.all([
      fetch('../data/current-event.json', {cache:'no-cache'}),
      fetch('../data/race-day-schedules.json', {cache:'no-cache'}),
      fetch('../data/event-calendar.json', {cache:'no-cache'})
    ]);
    if (!eventResponse.ok || !scheduleResponse.ok || !calendarResponse.ok) throw Error('Event information unavailable');
    const settings = await eventResponse.json();
    const calendar = await calendarResponse.json();
    const meeting = nextMeeting(calendar.events);
    const event = {venue:settings.venue, ...meeting};
    const schedules = await scheduleResponse.json();
    const type = new URLSearchParams(location.search).get('type') || event.type;
    const kind = type === 'sword' ? 'sword' : 'club';
    if (element('eventTitle')) {
      element('eventTitle').textContent = event.title || 'Next COBRA race meeting';
      element('eventType').textContent = event.type === 'sword' ? 'SWORD Championship' : event.type === 'club' ? 'COBRA Club Series' : 'Upcoming meeting';
      element('eventDate').textContent = event.date ? new Date(event.date + 'T12:00:00Z').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}) : 'Next meeting to be announced';
      element('eventVenue').textContent = event.venue || 'Cardiff City House of Sport, Cardiff CF11 8AW';
      if (element('eventDirections')) element('eventDirections').href = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(event.venue || 'Cardiff City House of Sport, Clos Parc Morganwg, Cardiff CF11 8AW');
      if (event.resultsUrl && /^https:\/\//.test(event.resultsUrl)) element('eventResults').href = event.resultsUrl;
      if (event.eventId) element('eventPodium').href = '../podiums/?event=' + encodeURIComponent(event.eventId);
      const booking = element('eventBooking');
      if (booking && /^https:\/\/www\.cobracardiff\.co\.uk\/event-details-1\/[^\s]+$/.test(event.bookingUrl || '')) {
        booking.href = event.bookingUrl;
        booking.hidden = false;
      }
      element('scheduleLink').hidden = !meeting;
      element('scheduleLink').href = '../schedule/?type=' + (event.type === 'sword' ? 'sword' : 'club');
    }
    if (element('scheduleSteps')) {
      element('scheduleTitle').textContent = kind === 'sword' ? 'SWORD race day' : 'Club race day';
      const scheduledMeeting = nextMeeting(calendar.events, kind);
      element('scheduleEvent').textContent = scheduledMeeting ? scheduledMeeting.title : 'Next meeting to be announced.';
      for (const entry of schedules[kind] || []) {
        const row = document.createElement('li');
        const content = document.createElement('div');
        content.className = 'schedule-content';
        const name = document.createElement('strong'); name.textContent = entry.label;
        content.append(name);
        if (entry.description) {
          const description = document.createElement('p');
          description.className = 'schedule-description';
          description.textContent = entry.description;
          content.append(description);
        }
        const time = document.createElement('span');
        time.className = 'schedule-time';
        time.textContent = entry.time || 'To be confirmed';
        row.append(content,time); element('scheduleSteps').append(row);
      }
    }
  } catch (_) {
    if (element('eventDate')) element('eventDate').textContent = 'Meeting information is temporarily unavailable. Please check LiveRC or race control.';
    if (element('scheduleSteps')) element('scheduleSteps').textContent = 'Schedule unavailable; check your event booking.';
  }
})();

// Refresh a page left open overnight once the UK meeting date changes.
const openedDate = londonDate();
setInterval(() => { if (londonDate() !== openedDate) location.reload(); }, 30000);
