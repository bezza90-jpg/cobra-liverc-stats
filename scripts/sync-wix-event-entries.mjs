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
  const wanted=new Set(Object.values(TICKETS).flatMap(([,number,chassis])=>[number,chassis]).filter(Boolean));
  for (const control of event?.form?.controls || []) for (const input of control.inputs || []) {
    const match=[...wanted].find(label=>label.toLowerCase()===String(input.label || '').trim().toLowerCase());
    if (match && input.name) result[match]=input.name;
  }
  return result;
}
function answers(form) {
  return Object.fromEntries((form?.inputValues || []).map(field=>[field.inputName,String(field.value ?? (field.values || []).join(', ')).trim()]));
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
export function publicEntry(guest,order,mapping) {
  const details=guest.guestDetails || {};
  if (guest.inactive || ['NOT_ATTENDING','CANCELED','CANCELLED'].includes(guest.attendanceStatus)) return null;
  if (guest.attendanceStatus!=='ATTENDING' || !['PAID','FREE'].includes(order.status)) return null;
  const ticket=(order.tickets || []).find(row=>row.ticketNumber===guest.ticketNumber);
  if (!ticket || ticket.canceled || ticket.archived) return null;
  const ticketName=ticket.name || ticket.ticketName || '';
  const definition=TICKETS[ticketName]; if (!definition) return null;
  const [className,label,chassisLabel]=definition;
  const ticketForm=ticket.guestDetails?.form;
  const form=details.formResponse || ticketForm || (sameName(order,details) ? order.checkoutForm : null);
  const values=answers(form);
  const number=values[mapping[label] || label] || '';
  const chassis=chassisLabel ? String(values[mapping[chassisLabel] || chassisLabel] || '').trim().slice(0,80) : '';
  const driverName=publicDriverName(details.firstName,details.lastName);
  if (!driverName) return null;
  return {driverName,className,
    transponder:/^[0-9]{7}$/.test(number) && number!=='1234567' ? number : '',
    ...(chassis ? {chassis} : {})};
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
async function writeIfChanged(file,value) {
  const previous=JSON.parse(await readFile(file,'utf8').catch(()=> 'null'));
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
  const orderNumbers=[...new Set(rows.map(row=>row.orderNumber).filter(Boolean))];
  const orders=new Map();
  for (let index=0;index<orderNumbers.length;index+=4) {
    await Promise.all(orderNumbers.slice(index,index+4).map(async number=>orders.set(number,await order(event.id,number,site,key))));
  }
  // Audit all guest types without changing paid-entry eligibility or publishing private details.
  const audit={};
  for (const row of rows) {
    const currentOrder=orders.get(row.orderNumber) || {};
    const ticket=(currentOrder.tickets || []).find(t=>t.ticketNumber===row.ticketNumber);
    const group=[row.guestType || 'MISSING_TYPE',row.attendanceStatus || 'MISSING_ATTENDANCE',currentOrder.status || 'MISSING_STATUS',ticket ? (ticket.canceled || ticket.archived ? 'INACTIVE_TICKET' : 'TICKET_MATCH') : 'NO_TICKET_MATCH',ticket?.name || ticket?.ticketName || 'NO_TICKET_NAME','GUEST_TICKETS_'+(row.tickets || []).length,row.guestDetails?.firstName && row.guestDetails?.lastName ? 'HAS_NAME' : 'MISSING_NAME'].join('|');
    audit[group]=(audit[group] || 0)+1;
  }
  console.log('Wix extraction audit: '+JSON.stringify(audit));
  const ticketAudit={};
  for (const currentOrder of orders.values()) for (const ticket of currentOrder.tickets || []) {
    const group=[currentOrder.status,ticket.name || ticket.ticketName || 'MISSING_NAME',ticket.canceled ? 'CANCELED' : 'ACTIVE',ticket.archived ? 'ARCHIVED' : 'CURRENT',ticket.guestDetails?.firstName && ticket.guestDetails?.lastName ? 'HAS_GUEST_NAME' : 'NO_GUEST_NAME'].join('|');
    ticketAudit[group]=(ticketAudit[group] || 0)+1;
  }
  console.log('Wix order-ticket audit: '+JSON.stringify(ticketAudit));
  const history=transponderHistory(JSON.parse(await readFile(new URL('../data/raw/entries.json',import.meta.url),'utf8')),today);
  const entries=usePreviousTransponders(rows.filter(row=>row.guestType==='TICKET_HOLDER').map(row=>publicEntry(row,orders.get(row.orderNumber) || {},mapping)).filter(Boolean),history);
  const unique=new Map(entries.map(row=>[`${row.driverName}|${row.className}`,row]));
  const value={liveRcEventId:String(meeting.eventId || ''),wixEventId:event.id,eventTitle:meeting.title,eventDate:meeting.date,updatedAt:new Date().toISOString(),entries:[...unique.values()].sort((a,b)=>a.className.localeCompare(b.className)||a.driverName.localeCompare(b.driverName))};
  return {configured:true,changed:await writeIfChanged(new URL('../public/data/wix-current-event-entries.json',import.meta.url),value),entries:value.entries.length};
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const result=await sync({site:process.env.WIX_SITE_ID,key:process.env.WIX_API_KEY});
  console.log(result.configured ? `Wix current event: ${result.entries} entries; ${result.changed ? 'updated':'unchanged'}.` : 'Wix sync is not configured; add WIX_SITE_ID and WIX_API_KEY repository secrets.');
}
