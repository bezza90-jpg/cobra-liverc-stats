import { bookingDestination, eventsUrl } from './booking-destination.js';
let destination = eventsUrl;
try {
  const response = await fetch('../data/event-calendar.json', {cache:'no-cache', signal:AbortSignal.timeout(5000)});
  if (!response.ok) throw new Error('Calendar unavailable');
  destination = bookingDestination((await response.json()).events);
} catch { /* The Events list is always available as the safe booking destination. */ }
document.getElementById('continueBooking').href = destination;
window.location.replace(destination);
