export const bookingHost = 'https://headless-bkqwbmqsasx-bezza90-1407.wix-site-host.com';

export const bookingEvents = Object.freeze({
  'gpw:2026-12-05': Object.freeze({id:'50b9c26d-f5c3-4b52-892e-f04509eb9730',opensAt:'2026-11-14T19:00:00Z'}),
  'club:2026-11-29': Object.freeze({id:'9147a804-de9d-4d34-b73e-8138a2d3ab43',opensAt:'2026-11-16T18:00:00Z'}),
  'sword:2026-12-13': Object.freeze({id:'eb75cf50-1bbb-4f78-91b2-bc8c0c8b9cba',opensAt:'2026-11-30T18:00:00Z'}),
  'club:2027-01-10': Object.freeze({id:'d4dd18f3-508f-4198-b28e-e1bb6845dc0d',opensAt:'2026-12-28T18:00:00Z'}),
  'sword:2027-01-24': Object.freeze({id:'0ef50ba9-4bbe-4806-8785-a76d030a5780',opensAt:'2027-01-11T18:00:00Z'}),
  'club:2027-02-07': Object.freeze({id:'68a0095d-a96d-4899-9fa7-4fa3a1f4ca61',opensAt:'2027-01-25T18:00:00Z'}),
  'sword:2027-02-21': Object.freeze({id:'1116a143-b077-4677-b407-6d33f8edcfb7',opensAt:'2027-02-08T18:00:00Z'}),
  'sword:2027-03-21': Object.freeze({id:'3fda4dd6-7aff-45af-a4b8-883f81fe8a16',opensAt:'2027-03-08T18:00:00Z'}),
  'club:2027-04-04': Object.freeze({id:'cee56064-6ae7-4d41-8259-91d0d065f775',opensAt:'2027-03-22T18:00:00Z'}),
});

export function bookingEvent(event) {
  if (!event) return null;
  if (event.bookingEventId && /^[a-f0-9-]{36}$/i.test(event.bookingEventId)) return {id:event.bookingEventId,opensAt:event.bookingOpenAt || ''};
  return bookingEvents[`${event.type}:${event.date}`] || null;
}

export function bookingUrlForEvent(event) {
  const mapped = bookingEvent(event);
  return mapped ? `${bookingHost}/booking-preview?event=${encodeURIComponent(mapped.id)}` : '';
}
