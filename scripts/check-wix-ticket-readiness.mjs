import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {londonDate} from './sync-wix-event-entries.mjs';

const API='https://www.wixapis.com';
const data=async name=>JSON.parse(await readFile(new URL(`../public/data/${name}`,import.meta.url),'utf8'));
const TICKET_CLASSES={
  'Junior Entry':'Junior Racers',
  '2WD SWORD Entry':'2-Wheel Drive Buggy',
  '4WD SWORD Entry':'4-Wheel Drive Buggy'
};

export function expectedTicketLimits(meeting,capacities) {
  const override=capacities.events?.[String(meeting.eventId)] || {};
  const limits=override.limits || capacities.types?.[meeting.type] || {};
  const reserved=override.reserved || capacities.reservedByType?.[meeting.type] || {};
  return Object.fromEntries(Object.entries(limits).map(([className,limit])=>[
    className,
    Number(limit)-(reserved[className] || []).length
  ]));
}

export function ticketReadiness(ticketDefinitions,meeting,capacities) {
  const expected=expectedTicketLimits(meeting,capacities);
  const required=Object.entries(TICKET_CLASSES).filter(([,className])=>expected[className] !== undefined);
  const starts=new Set();
  const checked=[];
  const problems=[];
  for (const [ticketName,className] of required) {
    const ticket=ticketDefinitions.find(row=>String(row.name || '').trim()===ticketName);
    if (!ticket) {
      problems.push(`Wix has no ${ticketName} ticket for ${meeting.title}.`);
      continue;
    }
    const limit=Number(ticket.actualLimit ?? ticket.initialLimit);
    if (!Number.isInteger(limit)) problems.push(`${ticketName} has no finite ticket limit.`);
    else if (limit!==expected[className]) problems.push(`${ticketName} is ${limit}; expected ${expected[className]} public tickets after reserved club places.`);
    const start=ticket.salePeriod?.startDate;
    if (!start) problems.push(`${ticketName} has no sale opening time.`);
    else if (Number.isNaN(Date.parse(start))) problems.push(`${ticketName} has an invalid sale opening time.`);
    else starts.add(start);
    checked.push({name:ticketName,limit,start});
  }
  if (starts.size!==1) problems.push('The SWORD ticket types do not share the same sale opening time.');
  assert.equal(problems.length,0,problems.join(' '));
  return checked;
}

async function queryTicketDefinitions(eventId,site,key) {
  const response=await fetch(`${API}/events-ticket-definitions/v3/ticket-definitions/query`,{
    method:'POST',
    headers:{Authorization:key,'wix-site-id':site,'Content-Type':'application/json'},
    body:JSON.stringify({query:{filter:{eventId:{$eq:eventId}},paging:{limit:100,offset:0}}})
  });
  if (!response.ok) throw Error(`Wix ticket preflight returned HTTP ${response.status}. The API key needs Manage Ticket Definitions permission.`);
  const body=await response.json();
  if (!Array.isArray(body.ticketDefinitions)) throw Error('Wix ticket preflight returned no ticket definitions.');
  return body.ticketDefinitions;
}

export async function checkWixTicketReadiness({site,key}) {
  assert(site && key,'WIX_SITE_ID and WIX_API_KEY are required.');
  const [calendar,snapshot,capacities]=await Promise.all([
    data('event-calendar.json'),data('wix-current-event-entries.json'),data('event-capacities.json')
  ]);
  const today=londonDate();
  const meeting=(calendar.events || []).filter(event=>event.date>=today && event.bookingUrl)
    .sort((a,b)=>a.date.localeCompare(b.date))[0];
  assert(meeting,'No upcoming event with a booking page is configured.');
  assert.equal(String(snapshot.liveRcEventId),String(meeting.eventId),'The Wix entry feed is connected to the wrong LiveRC event.');
  assert(snapshot.wixEventId,'The upcoming booking page has not been matched to a Wix event.');
  const definitions=await queryTicketDefinitions(snapshot.wixEventId,site,key);
  const visible=definitions.filter(row=>Object.hasOwn(TICKET_CLASSES,String(row.name || '').trim()));
  console.log(`Wix ticket settings: ${visible.map(row=>`${row.name} ${Number(row.actualLimit ?? row.initialLimit)} opens ${row.salePeriod?.startDate || 'unset'}`).join('; ')}.`);
  const checked=ticketReadiness(definitions,meeting,capacities);
  const opening=new Intl.DateTimeFormat('en-GB',{
    timeZone:'Europe/London',weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'
  }).format(new Date(checked[0].start));
  console.log(`Wix tickets ready for ${meeting.title}: ${checked.map(row=>`${row.name} ${row.limit}`).join('; ')}; sales open ${opening}.`);
  return checked;
}

if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  await checkWixTicketReadiness({site:process.env.WIX_SITE_ID,key:process.env.WIX_API_KEY});
}
