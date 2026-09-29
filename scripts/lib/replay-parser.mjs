import {canonicalDriverKey,canonicalDriverName} from '../../public/assets/driver-identity.js';
export const driverKey=name=>canonicalDriverKey(name.toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,''));
export function parseReplay(html,meta){
 const rows=[...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(m=>m[1]);const drivers=[],omitted=[];
 for(const m of html.matchAll(/racerLaps\[(\d+)\]\s*=\s*\{([\s\S]*?)\n\s*\};/g)){
  const id=m[1],body=m[2];const match=body.match(/'driverName'\s*:\s*'((?:\\.|[^'\\])*)'/);if(!match)continue;
  const name=match[1].replace(/\\'/g,"'").replace(/&amp;/g,'&');
  const laps=[...body.matchAll(/'lapNum'\s*:\s*'(\d+)'\s*,\s*'pos'\s*:\s*'(\d+)'\s*,\s*'time'\s*:\s*'([\d.]+)'/g)].map(x=>({lap:+x[1],position:+x[2],seconds:+x[3]})).filter(x=>x.lap>0);
  if(!laps.length)continue;
  const row=rows.find(r=>r.includes(`data-driver-id="${id}"`));if(!row)throw Error('Missing result '+id);
  const finalPosition=+row.match(/<td>\s*(\d+)\s*<\/td>/)?.[1],number=+row.match(/class="car_num">(\d+)/)?.[1];
  const total=row.match(/(\d+)\/(?:(\d+):)?(\d+\.\d+)/);if(!total)throw Error('Missing total '+name);
  const expected=+(total[2]||0)*60 + +total[3];
  if(!finalPosition||!number||laps.some((l,i)=>l.lap!==i+1||l.seconds<=0)||laps.length!==+total[1]||Math.abs(laps.reduce((s,l)=>s+l.seconds,0)-expected)>.02){omitted.push(name);continue;}
  drivers.push({id,key:driverKey(name),name:canonicalDriverName(driverKey(name),name),number,finalPosition,officialTime:expected,laps});
 }
 if(!drivers.length)throw Error('No complete lap records');
 return {id:meta.liveRcRaceId,eventId:meta.liveRcEventId,event:meta.eventName,date:meta.eventDate,name:meta.raceName,round:meta.round,className:meta.className,isFinal:meta.isFinal,source:meta.sourceUrl,omitted,drivers};
}
