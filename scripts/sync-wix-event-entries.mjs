import {readFile,writeFile,rename} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {transponderHistory,usePreviousTransponders} from './lib/transponder-history.mjs';

const API='https://www.wixapis.com';
export const TICKETS={
  'Junior Entry':['Junior Racers','Junior Transponder Number','Junior Chassis'],
  '2WD Entry':['2-Wheel Drive Buggy','2WD Transponder Number','2WD Chassis'],
  '2WD SWORD Entry':['2-Wheel Drive Buggy','2WD Transponder Number','2WD Chassis'],
  '4WD Entry':['4-Wheel Drive Buggy','4WD Transponder Number','4WD Chassis'],
  '4WD SWORD Entry':['4-Wheel Drive Buggy','4WD Transponder Number','4WD Chassis'],
  'Vintage Entry':['Vintage','Vintage Transponder Number','Vintage Chassis'],
  'Mother Trucker Entry':['Trucks','Truck Transponder Number','Truck Chassis'],
  'Mother Truckers Entry':['Trucks','Truck Transponder Number','Truck Chassis']
};

export function bookingSlug(url) {
  try { return new URL(url).pathname.split('/').filter(Boolean).at(-1) || ''; }
  catch { return ''; }
}
export function londonDate(now=new Date()) {
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const value=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
export function formMapping(event) {
  const result={};
  const wanted=new Set(['Classes to enter',...Object.values(TICKETS).flatMap(([,number,chassis])=>[number,chassis]).filter(Boolean)]);
  for (const control of event?.form?.controls || []) for (const input of control.inputs || []) {
    const match=[...wanted].find(label=>label.toLowerCase()===String(input.label || '').trim().toLowerCase());
    if (match && input.name) result[match]=input.name;
  }
  return result;
}
function answers(form) {
  return Object.fromEntries((form?.inputValues || []).map(field=>[field.inputName,String(field.values?.length ? field.values.join(', ') : (field.value ?? '')).trim()]));
}
function sameName(a,b) {
  const clean=value=>String(value || '').toUpperCase().replace(/[^A-Z0-9]/g,'');
  return clean(`${a?.firstName || ''}${a?.lastName || ''}`)===clean(`${b?.firstName || ''}${b?.lastName || ''}`);
}
export function publicDriverName(firstValue,lastValue) {
  const first=String(firstValue || '').trim().replace(/\s+/g,' ');
  const last=String(lastValue || '').trim().replace(/\s+/g,' ');
  if (!first || !last) return '';
  // Wix occasionally stores the full name in both guest fields. It can also
  // repeat the surname once at the join. Keep the safe public name concise.
  if (first.includes(' ') && first.toUpperCase()===last.toUpperCase()) return first.toUpperCase();
  const words=`${first} ${last}`.toUpperCase().split(/\s+/).filter(Boolean);
  const collapsed=words.filter((word,index)=>index<2 || word!==words[index-1]);
  return collapsed.join(' ');
}
export function publicEntries(guest,order,mapping) {
  const details=guest.guestDetails || {};
  if (guest.inactive || ['NOT_ATTENDING','CANCELED','CANCELLED'].includes(guest.attendanceStatus)) return [];
  if (guest.attendanceStatus!=='ATTENDING' || !['PAID','FREE'].includes(order.status)) return [];
  const ticket=(order.tickets || []).find(row=>row.ticketNumber===guest.ticketNumber);
  if (!ticket) throw Error('An attending paid ticket could not be matched; retaining the published roster.');
  if (ticket.canceled || ticket.archived || order.archived) return [];
  const values={...(sameName(order,details) ? answers(order.checkoutForm) : {}),...answers(ticket.guestDetails?.form),...answers(details.formResponse)};
  const ticketName=ticket.name || ticket.ticketName || '';
  let definitions=TICKETS[ticketName] ? [TICKETS[ticketName]] : [];
  if (ticketName==='Adult Double Class') {
    const selected=String(values[mapping['Classes to enter'] || 'Classes to enter'] || '').split(/[,;\n]+/).map(value=>value.trim()).filter(Boolean);
    const classDefinitions={'2WD':TICKETS['2WD Entry'],'4WD':TICKETS['4WD Entry'],'VINTAGE':TICKETS['Vintage Entry'],'TRUCKS':TICKETS['Mother Trucker Entry']};
    definitions=selected.map(value=>{
      const name=value.toUpperCase().replace(/\s+/g,' ');
      const aliases={'2-WHEEL DRIVE BUGGY':'2WD','4-WHEEL DRIVE BUGGY':'4WD','2WD ENTRY':'2WD','4WD ENTRY':'4WD','VINTAGE ENTRY':'VINTAGE','TRUCK':'TRUCKS','MOTHER TRUCKER ENTRY':'TRUCKS','MOTHER TRUCKERS ENTRY':'TRUCKS'};
      return classDefinitions[aliases[name] || name];
    });
    if (definitions.length!==2 || definitions.some(value=>!value) || definitions[0][0]===definitions[1][0]) throw Error('A paid double-class ticket has incomplete or unrecognised class selections; retaining the published roster.');
  }
  if (!definitions.length) throw Error('Unrecognised attending paid Wix ticket type: '+ticketName+'; retaining the published roster.');
  const driverName=publicDriverName(details.firstName,details.lastName);
  if (!driverName) throw Error('An attending paid ticket has incomplete driver details; retaining the published roster.');
  return definitions.map(([className,label,chassisLabel])=>{
    const number=values[mapping[label] || label] || '';
    const chassis=chassisLabel ? String(values[mapping[chassisLabel] || chassisLabel] || '').trim().slice(0,80) : '';
    return {driverName,className,transponder:/^[0-9]{7}$/.test(number) && number!=='1234567' ? number : '',...(chassis ? {chassis} : {})};
  });
}
export function publicEntry(guest,order,mapping) { return publicEntries(guest,order,mapping)[0] || null; }

export function entriesFromOrders(orders,guests,mapping) {
  const guestByTicket=new Map(guests.filter(row=>row.guestType==='TICKET_HOLDER').map(row=>[row.ticketNumber,row]));
  return orders.flatMap(order=>{
    if (!['PAID','FREE'].includes(order.status) || order.archived) return [];
    if (!Array.isArray(order.tickets)) throw Error('Paid Wix order has no ticket data; retaining the published roster.');
    return order.tickets.flatMap(ticket=>{
      const guest=guestByTicket.get(ticket.ticketNumber) || {ticketNumber:ticket.ticketNumber,attendanceStatus:'ATTENDING',guestDetails:ticket.guestDetails || {}};
      return publicEntries(guest,order,mapping);
    });
  });
}

async function request(path,site,key,payload) {
  const response=await fetch(API+path,{method:payload ? 'POST':'GET',headers:{Authorization:key,'wix-site-id':site,'Content-Type':'application/json'},body:payload ? JSON.stringify(payload):undefined});
  if (!response.ok) throw Error(`Wix returned HTTP ${response.status}. Check the site ID and read-only Events permission.`);
  return response.json();
}
async function upcomingEvents(site,key) {
  const result=[];
  for (let offset=0;offset<1000;offset+=100) {
    const data=await request('/events/v3/events/query',site,key,{query:{filter:{status:{$eq:'UPCOMING'}},paging:{limit:100,offset},sort:[{fieldName:'dateAndTimeSettings.startDate',order:'ASC'}]},fields:['FORM']});
    if (!Array.isArray(data.events)) throw Error('Wix did not return upcoming events.');
    result.push(...data.events); if (data.events.length<100) return result;
  }
  throw Error('Wix returned too many upcoming events.');
}
async function guests(eventId,site,key) {
  const result=[]; let cursor='';
  for (let page=0;page<1000;page++) {
    const query=cursor ? {cursorPaging:{limit:100,cursor}} : {filter:{eventId:{$eq:eventId}},cursorPaging:{limit:100}};
    const data=await request('/events/v2/guests/query',site,key,{query,fields:['GUEST_DETAILS']});
    if (!Array.isArray(data.guests)) throw Error('Wix guest response was incomplete.');
    result.push(...data.guests); cursor=data.pagingMetadata?.cursors?.next || ''; if (!cursor) return result;
  }
  throw Error('Wix guest list exceeded the paging limit.');
}
async function order(eventId,number,site,key) {
  const path=`/events/v1/events/${encodeURIComponent(eventId)}/orders/${encodeURIComponent(number)}?fieldset=DETAILS&fieldset=FORM&fieldset=TICKETS`;
  const data=await request(path,site,key); if (!data.order) throw Error('A Wix order could not be read.'); return data.order;
}

async function listOrders(eventId,site,key) {
  const result=[];
  for (let offset=0;offset<100000;offset+=100) {
    const data=await request('/events/v1/orders?eventId='+encodeURIComponent(eventId)+'&offset='+offset+'&limit=100&fieldset=DETAILS&fieldset=FORM&fieldset=TICKETS',site,key);
    if (!Array.isArray(data.orders) || !Number.isInteger(data.total)) throw Error('Wix order list was incomplete; retaining the published roster.');
    result.push(...data.orders);
    if (result.length===data.total) return result;
    if (result.length>data.total || data.orders.length<100) throw Error('Wix order pagination was incomplete; retaining the published roster.');
  }
  throw Error('Wix order list exceeded paging limit.');
}

export function assertRosterContinuity(previous, next) {
  if (!previous || !previous.wixEventId || previous.wixEventId!==next.wixEventId || previous.eventDate!==next.eventDate) return;
  const key=row=>String(row.driverName || '').trim().replace(/\s+/g,' ').toUpperCase()+'|'+String(row.className || '').trim().toUpperCase();
  const current=new Set((next.entries || []).map(key));
  const missing=(previous.entries || []).filter(row=>!current.has(key(row)));
  if (missing.length) throw Error('Wix sync would remove '+missing.length+' previously published class entries from the same event; keeping the last complete roster. Diagnose cancellations, renamed tickets or incomplete API data before approving removals.');
}

async function writeIfChanged(file,value) {
  const previous=JSON.parse(await readFile(file,'utf8').catch(()=> 'null'));
  assertRosterContinuity(previous,value);
  if (entrySnapshot(previous)===entrySnapshot(value)) return false;
  const output=JSON.stringify(value,null,2)+'\n';
  if (await readFile(file,'utf8').catch(()=> '')===output) return false;
  const temp=new URL(file.href+'.tmp'); await writeFile(temp,output); await rename(temp,file); return true;
}
export function entrySnapshot(value) {
  if (!value) return '';
  const {updatedAt,...snapshot}=value;
  return JSON.stringify(snapshot);
}
export async function sync({site,key}) {
  if (!site || !key) throw Error('Wix sync credentials are missing; entries have not been refreshed.');
  const calendar=JSON.parse(await readFile(new URL('../public/data/event-calendar.json',import.meta.url),'utf8'));
  const today=londonDate();
  const meeting=(calendar.events || []).filter(event=>event.date>=today && event.bookingUrl).sort((a,b)=>a.date.localeCompare(b.date))[0];
  if (!meeting) throw Error('No upcoming COBRA event with a Wix booking page was found.');
  const slug=bookingSlug(meeting.bookingUrl), events=await upcomingEvents(site,key);
  const event=events.find(row=>row.slug===slug);
  if (!event) throw Error(`No upcoming Wix event matched ${slug}.`);
  const mapping=formMapping(event), rows=await guests(event.id,site,key);
  const orders=await listOrders(event.id,site,key);
  const counts={}; for (const order of orders) counts[order.status]=(counts[order.status] || 0)+1;
  console.log('Wix order statuses: '+JSON.stringify(counts));
  const history=transponderHistory(JSON.parse(await readFile(new URL('../data/raw/entries.json',import.meta.url),'utf8')),today);
  const entries=usePreviousTransponders(entriesFromOrders(orders,rows,mapping),history);
  const unique=new Map(entries.map(row=>[`${row.driverName}|${row.className}`,row]));
  const value={liveRcEventId:String(meeting.eventId || ''),wixEventId:event.id,eventTitle:meeting.title,eventDate:meeting.date,updatedAt:new Date().toISOString(),entries:[...unique.values()].sort((a,b)=>a.className.localeCompare(b.className)||a.driverName.localeCompare(b.driverName))};
  return {configured:true,changed:await writeIfChanged(new URL('../public/data/wix-current-event-entries.json',import.meta.url),value),entries:value.entries.length};
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const result=await sync({site:process.env.WIX_SITE_ID,key:process.env.WIX_API_KEY});
  console.log(result.configured ? `Wix current event: ${result.entries} entries; ${result.changed ? 'updated':'unchanged'}.` : 'Wix sync is not configured; add WIX_SITE_ID and WIX_API_KEY repository secrets.');
}
