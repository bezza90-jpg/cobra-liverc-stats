(async () => {
  'use strict';
  const element = id => document.getElementById(id);
  try {
    const [eventResponse, scheduleResponse] = await Promise.all([
      fetch('../data/current-event.json', {cache:'no-store'}),
      fetch('../data/race-day-schedules.json', {cache:'no-store'})
    ]);
    if (!eventResponse.ok || !scheduleResponse.ok) throw Error('Event information unavailable');
    const event = await eventResponse.json();
    const schedules = await scheduleResponse.json();
    const type = new URLSearchParams(location.search).get('type') || event.type;
    const kind = type === 'sword' ? 'sword' : 'club';
    if (element('eventTitle')) {
      element('eventTitle').textContent = event.title || 'Next COBRA race meeting';
      element('eventType').textContent = event.type === 'sword' ? 'SWORD Championship' : 'COBRA Club Series';
      element('eventDate').textContent = event.date ? new Date(event.date + 'T12:00:00Z').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}) : 'Date to be confirmed';
      element('eventVenue').textContent = event.venue || 'Cardiff City House of Sport, Cardiff CF11 8AW';
      if (event.resultsUrl && /^https:\/\//.test(event.resultsUrl)) element('eventResults').href = event.resultsUrl;
      if (event.eventId) element('eventPodium').href = '../podiums/?event=' + encodeURIComponent(event.eventId);
      element('scheduleLink').href = '../schedule/?type=' + (event.type === 'sword' ? 'sword' : 'club');
    }
    if (element('scheduleSteps')) {
      element('scheduleTitle').textContent = kind === 'sword' ? 'SWORD race day' : 'Club race day';
      element('scheduleEvent').textContent = event.title || 'Check the current event for meeting details.';
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
    if (element('scheduleSteps')) element('scheduleSteps').textContent = 'Schedule unavailable; check your event booking.';
  }
})();
