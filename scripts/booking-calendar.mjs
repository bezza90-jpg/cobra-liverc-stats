import {readFile,writeFile,rename} from 'node:fs/promises';
import {londonDate} from '../public/assets/event-calendar.js';
const origin='https://www.cobracardiff.co.uk';
export function bookingUrl(value) {
 try { const url=new URL(value); return url.origin===origin && url.pathname.startsWith('/event-details-1/') ? url.href : ''; } catch { return ''; }
}
export function parseBooking(html,url) {
 const events=[];
 const visit=value=>{
  if (!value || typeof value!=='object') return;
  if (Array.isArray(value)) {value.forEach(visit);return;}
  if ([value['@type']].flat().includes('Event')) events.push(value);
  if (value['@graph']) visit(value['@graph']);
 };
 for (const [,json] of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
  try {visit(JSON.parse(json));} catch { /* Ignore unrelated malformed metadata. */ }
 }
 return events.filter(e=> /\b(sword|club)\b/i.test(e.name||'') && !/Cancelled|Postponed/i.test(e.eventStatus||'') && /^\d{4}-\d{2}-\d{2}T/.test(e.startDate||''))
  .map(e=>({title:e.name,date:londonDate(new Date(e.startDate)),type:/sword/i.test(e.name)?'sword':'club',url:bookingUrl(url)})).filter(e=>e.url);
}
export function matchBooking(meeting,bookings) {
 const urls=[...new Set(bookings.filter(b=>b.date===meeting.date && b.type===meeting.type).map(b=>bookingUrl(b.url)).filter(Boolean))];
 return urls.length===1 ? urls[0] : '';
}
async function fetchPage(url) {
 const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
 if (!response.ok) throw Error('Booking page HTTP '+response.status);
 return response.text();
}
export async function loadBookings() {
 const file=new URL('../data/raw/booking-calendar.json',import.meta.url);
 let cached={events:[]};
 try {cached=JSON.parse(await readFile(file,'utf8'));} catch (error) {if(error.code!=='ENOENT') throw error;}
 if (cached.checkedDate===londonDate()) return cached.events;
 try {
  const sitemap=await fetchPage(origin+'/event-pages-sitemap.xml');
  const urls=[...new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([,url])=>bookingUrl(url)).filter(Boolean))];
  if (!urls.length) throw Error('Booking sitemap has no event pages');
  const events=[];
  for(let i=0;i<urls.length;i+=3) {
   const batch=await Promise.all(urls.slice(i,i+3).map(async url=>parseBooking(await fetchPage(url),url)));
   events.push(...batch.flat());
  }
  if (!events.length) throw Error('Booking pages have no event metadata');
  const temporary=new URL('../data/raw/booking-calendar.json.tmp',import.meta.url);
  await writeFile(temporary,JSON.stringify({checkedDate:londonDate(),events},null,2)+'\n');
  await rename(temporary,file);
  return events;
 } catch(error) {
  console.warn('Booking refresh unavailable; retaining previous date-matched links: '+error.message);
  return cached.events;
 }
}
