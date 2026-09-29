const escapeText = value => String(value || '').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
export function eventCalendarFile(event, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date || '')) throw Error('Event date unavailable');
  const date = new Date(event.date + 'T00:00:00Z');
  if (date.toISOString().slice(0,10) !== event.date) throw Error('Invalid event date');
  const end = new Date(date.getTime()+86400000).toISOString().slice(0,10).replaceAll('-','');
  const stamp = now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//COBRA//RaceHub//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT',
    'UID:'+escapeText((event.eventId || event.date)+'@racehub.cobracardiff.co.uk'), 'DTSTAMP:'+stamp,
    'DTSTART;VALUE=DATE:'+event.date.replaceAll('-',''),'DTEND;VALUE=DATE:'+end,
    'SUMMARY:'+escapeText(event.title),'LOCATION:'+escapeText(event.venue),
    'DESCRIPTION:'+escapeText('Race date reminder. Check your booking and the COBRA race-day schedule for arrival and start times.'),
    'URL:https://racehub.cobracardiff.co.uk/event/','END:VEVENT','END:VCALENDAR'];
  // Fold by UTF-8 octets, including the continuation space.
  return lines.map(line=>{let out='',part='',size=0;for(const c of line){const n=new TextEncoder().encode(c).length;if(size+n>75){out+=part+'\r\n';part=' ';size=1;}part+=c;size+=n;}return out+part;}).join('\r\n')+'\r\n';
}
export function installCalendarButton(event, container) {
  if (!container || !event?.date) return;
  const link=document.createElement('a');link.className='info-action';link.textContent='Add to calendar';
  link.download='COBRA-'+event.date+'.ics';link.title='Save the race date; check the schedule for arrival times';
  const url=URL.createObjectURL(new Blob([eventCalendarFile(event)],{type:'text/calendar;charset=utf-8'}));
  link.href=url;container.append(link);
  const note=document.createElement('small');note.textContent='Saves the race date. See schedule for arrival times.';container.append(note);
  window.addEventListener('pagehide',()=>URL.revokeObjectURL(url),{once:true});
}
