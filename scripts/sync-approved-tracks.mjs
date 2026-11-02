import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const defaultRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function syncApprovedTracks(root=defaultRoot){
 const pub=path.join(root,'public'),base=path.join(pub,'virtual-race-replay'),file=path.join(pub,'data/approved-track-assignments.json');let approved;try{approved=JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return 0;throw e;}
 const [catalog,plans,gallery,template]=await Promise.all([fs.readFile(path.join(base,'catalog.json'),'utf8').then(JSON.parse),fs.readFile(path.join(base,'track-plans.json'),'utf8').then(JSON.parse),fs.readFile(path.join(pub,'data/track-gallery.json'),'utf8').then(JSON.parse),fs.readFile(path.join(base,'sword-round-2-2026-11-01-flyover.html'),'utf8')]);
 gallery.events||={};gallery.flyoverEvents||=[];let count=0;
 for(const record of approved.assignments||[]){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(record.eventDate)||!/^planned-[a-f0-9-]{36}$/i.test(record.trackId)||record.designPath!=='virtual-race-replay/designs/'+record.trackId+'.json'||record.imagePath!=='track-photos/'+record.trackId+'/presentation.png')throw Error('Approved track assignment contains invalid paths or date.');
  const design=JSON.parse(await fs.readFile(path.join(pub,record.designPath),'utf8'));await fs.access(path.join(pub,record.imagePath));if(!record.approvedAt||!design.points?.length||!record.plan?.presentation||record.plan.date!==record.eventDate)throw Error('Approved track package is incomplete.');
  const matches=(catalog.events||[]).filter(e=>e.date===record.eventDate),targets=matches.length?matches:[{id:record.trackId,name:record.eventTitle,date:record.eventDate}];
  plans['date:'+record.eventDate]={...record.plan,designPath:record.designPath.replace('virtual-race-replay/','')};
  for(const event of targets){const id=String(event.id);if(!/^(\d+|planned-[a-f0-9-]{36})$/i.test(id))throw Error('Invalid matched race event.');const mapped={...design,eventId:id,eventDate:record.eventDate,eventName:event.name};await fs.writeFile(path.join(base,'designs',id+'.json'),JSON.stringify(mapped,null,2)+'\n');if(/^\d+$/.test(id))plans[id]={...record.plan,eventId:id,name:event.name,designPath:'designs/'+id+'.json'};
   const flyover='track-'+id+'-flyover.html',explore='track-'+id+'-explore.html',dateLabel=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(record.eventDate+'T12:00:00Z'));
   let page=template.replaceAll('518556',id).replaceAll('SWORD Round 2',html(event.name)).replaceAll('1 November 2026',dateLabel).replaceAll('2026-11-01',record.eventDate).replaceAll('track-photos/'+id+'/presentation.png',record.imagePath).replaceAll('track-photos/'+id+'/plan.png',record.imagePath);
   await fs.writeFile(path.join(base,flyover),page);await fs.writeFile(path.join(base,explore),page.replace('data-track-mode="flyover"','data-track-mode="explore"'));
   gallery.events[id]={...(gallery.events[id]||{}),name:event.name,date:record.eventDate,showInArchive:true,designImage:'../'+record.imagePath,flyoverUrl:'../virtual-race-replay/'+flyover,exploreUrl:'../virtual-race-replay/'+explore};if(!gallery.flyoverEvents.includes(id))gallery.flyoverEvents.push(id);count++;
  }
  if(matches.length){delete gallery.events[record.trackId];gallery.flyoverEvents=gallery.flyoverEvents.filter(id=>id!==record.trackId);}
 }
 await fs.writeFile(path.join(base,'track-plans.json'),JSON.stringify(plans,null,2)+'\n');await fs.writeFile(path.join(pub,'data/track-gallery.json'),JSON.stringify(gallery,null,2)+'\n');return count;
}
