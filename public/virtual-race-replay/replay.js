import {paceMap} from './pace.js';
import {renderPlan,planPoint,routePath,straightFor,gridPositions} from './track-layouts.js';
if(window.self!==window.top)document.documentElement.classList.add('embedded');
import {prepare,ordered,timeAtProgress,visualFraction} from './engine.js';
const $=id=>document.getElementById(id),svgNS='http://www.w3.org/2000/svg';
const palette=['#85ed40','#56d7ff','#ffca53','#ff7eb1','#c0a2ff','#ff9868','#58e3bb','#e6ebed','#ddea62','#5a92ff','#ff5656','#cda47b'];
const clock=s=>`${Math.floor(s/60)}:${(s%60).toFixed(1).padStart(4,'0')}`;
const params=new URLSearchParams(location.search),originalRoute=$('route').getAttribute('d');
let catalog,trackPlans={},avatars={},event,selectedDriver=params.get('driver')||'',dayMode=false,frame=0,loadToken=0,pauseCurrent=()=>{},updateFocus=()=>{};
const key=name=>name.toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'');
function avatarFor(d,cls){const v=avatars[d.key||key(d.name)];const asset=typeof v==='string'?v:v?.[cls]||v?.default||'';return asset?'../'+asset:'';}
function layout(race){
 const matched=$('layoutSelect').value!=='oval'?trackPlans[race.eventId]:null;
 const confirmed=matched?.routeStatus==='confirmed'?matched:null;
 renderPlan($('circuit'),null);
 const real=race.eventId==='518551'&&$('layoutSelect').value!=='oval';
 const oval='M100 500 V320 Q100 170 250 170 H1330 Q1480 170 1480 320 V680 Q1480 830 1330 830 H250 Q100 830 100 680 V500 Z';
 $('route').setAttribute('d',real?originalRoute:oval);document.querySelector('.centreline').setAttribute('d',real?originalRoute:oval);
 document.querySelector('.track>img').src=real?'track-plan.png':'oval-track.png';document.querySelector('.track>img').alt=real?'20 September 2026 COBRA circuit':'Illustrative plain grey perimeter oval';
 document.querySelector('.tag').textContent=real?'20 September circuit':'Illustrative perimeter oval';
 document.querySelector('.timing').setAttribute('d',real?'M97 725 H183':'M50 500 H150');document.querySelector('.loop-label').setAttribute('x',real?'200':'165');document.querySelector('.loop-label').setAttribute('y',real?'731':'506');
 $('circuit').setAttribute('aria-label',real?'Replay following the supplied September track':'Replay around an illustrative perimeter oval');
 if(race.eventId==='499054'&&$('layoutSelect').value!=='oval'){
 const route='M110 750 Q100 665 200 655 L250 650 Q400 740 470 710 Q575 650 570 520 L570 420 Q575 320 500 290 Q470 255 440 275 L350 380 Q295 495 250 490 Q175 480 120 400 Q100 365 110 320 Q90 185 190 180 H1410 Q1475 180 1475 240 V305 L1145 430 Q1080 450 1045 415 L920 310 Q860 260 815 270 Q725 270 760 345 Q800 390 940 480 Q1050 580 1095 665 Q1145 740 1220 700 Q1260 670 1260 600 L1260 550 Q1260 515 1300 498 Q1430 450 1470 585 V765 Q1470 845 1400 845 H1040 Q1000 845 930 790 L760 665 L535 810 Q460 850 340 850 H160 Q95 845 110 750 Z';
 $('route').setAttribute('d',route);document.querySelector('.centreline').setAttribute('d',route);
 document.querySelector('.track>img').src='march-2026-track-v2.png';document.querySelector('.track>img').alt='29 March 2026 SWORD hand-drawn layout inside the COBRA replay frame';
 document.querySelector('.tag').textContent='29 March circuit · hand-drawn plan';
 document.querySelector('.timing').setAttribute('d','M60 750 H163');document.querySelector('.loop-label').setAttribute('x','180');document.querySelector('.loop-label').setAttribute('y','737');
 $('circuit').setAttribute('aria-label','Replay following the dated March track plan, starting at the confirmed lower-left timing loop');
 }
 if(confirmed){
  const route=routePath(confirmed.points),loop=planPoint(confirmed.loop,confirmed);
  $('route').setAttribute('d',route);document.querySelector('.centreline').setAttribute('d',route);
  document.querySelector('.track>img').src='track-plan.png';document.querySelector('.track>img').alt=`${confirmed.date} COBRA circuit template`;
  renderPlan($('circuit'),confirmed);
  document.querySelector('.tag').textContent=confirmed.date+' · confirmed track plan';
  $('circuit').setAttribute('aria-label',`Replay following the confirmed route for ${confirmed.name}`);
  const next=confirmed.points[1],dx=next[0]-confirmed.points[0][0],dy=(next[1]-confirmed.points[0][1])*766/650/(1438/1000),length=Math.hypot(dx,dy)||1;
  const nx=-dy/length*43,ny=dx/length*43;
  document.querySelector('.timing').setAttribute('d',`M${loop.x-nx} ${loop.y-ny} L${loop.x+nx} ${loop.y+ny}`);
  document.querySelector('.loop-label').setAttribute('x',Math.min(1320,Math.max(100,loop.x+55)));
  document.querySelector('.loop-label').setAttribute('y',Math.min(840,Math.max(165,loop.y-15)));
 }
 document.querySelector('.explain').textContent=((confirmed||real||(race.eventId==='499054'&&$('layoutSelect').value!=='oval'))?'Route traced from the supplied track plan. ':matched?'The dated plan is matched; its driving route is awaiting confirmation. This replay uses the illustrative oval. ':'The oval is illustrative and does not represent this event’s original layout. ')+'Recorded lap times determine each crossing. Estimated speed changes gently through the infield, with stronger acceleration reserved for the main straight. Positions and gaps between crossings are estimates; slower laps move more slowly. Very short opening records use an estimated approach to the timing loop. Finals use a staggered grid on the main straight, with 2 m between cars on each side using the template scale. Each car reaches the loop at its recorded first-crossing time. Staggered qualifying starts and incident locations are not reconstructed. Practice and qualifying use each driver’s elapsed lap clock. Cars with no further laps are parked beside the timing-loop label. An upside-down car indicates its lap records ended early; this does not identify the cause.';
 return confirmed?{mainStraight:straightFor(confirmed.points),illustrative:false}:null;
}
function options(el,items,blank){el.replaceChildren();if(blank){const o=document.createElement('option');o.value='';o.textContent=blank;el.append(o);}for(const [value,text]of items){const o=document.createElement('option');o.value=value;o.textContent=text;el.append(o);}}
function listRaces(){return event.races.filter(r=>!selectedDriver||r.drivers.some(d=>d.key===selectedDriver));}
function raceOptions(preferred){const races=listRaces();options($('raceSelect'),races.map(r=>[r.id,`${r.round} · ${r.name}`]));$('raceSelect').value=races.some(r=>r.id===preferred)?preferred:races[0]?.id||'';$('dayPlay').disabled=!selectedDriver||!races.length;$('dayStatus').textContent=selectedDriver?`${races.length} available races for this driver, in session order.`:'Choose a driver to follow their day.';return races;}
function syncUrl(){const url=new URL(location.href);url.searchParams.set('event',event.id);url.searchParams.set('race',$('raceSelect').value);if(selectedDriver)url.searchParams.set('driver',selectedDriver);else url.searchParams.delete('driver');if($('layoutSelect').value==='oval')url.searchParams.set('layout','oval');else url.searchParams.delete('layout');history.replaceState(null,'',url);}
let eventToken=0;async function changeEvent(preferred){const token=++eventToken;pauseCurrent();dayMode=false;const selected=catalog.events.find(e=>e.id===$('eventSelect').value);$('play').disabled=true;$('message').textContent='Loading event…';try{const response=await fetch(`events/${selected.id}.json`);if(!response.ok)throw Error('Event unavailable');const loaded=await response.json();if(token!==eventToken)return;event=loaded;}catch(error){if(token===eventToken)$('message').textContent=error.message;return;}const drivers=new Map(event.races.flatMap(r=>r.drivers).map(d=>[d.key,d.name]));if(!drivers.has(selectedDriver))selectedDriver='';options($('focus'),[...drivers].sort((a,b)=>a[1].localeCompare(b[1])),'All drivers');$('focus').value=selectedDriver;raceOptions(preferred);dayMode=false;loadRace();}
function nextRace(auto=false){const races=listRaces(),idx=races.findIndex(r=>r.id===$('raceSelect').value);if(idx+1<races.length){$('raceSelect').value=races[idx+1].id;loadRace(auto);}else{dayMode=false;$('dayStatus').textContent='Driver day replay complete.';}}
async function loadRace(autoplay=false){
 pauseCurrent();cancelAnimationFrame(frame);const token=++loadToken;const id=$('raceSelect').value;syncUrl();$('message').textContent='Loading lap records…';$('play').disabled=true;
 try{if(!/^\d+$/.test(id))throw Error('No matching race.');const response=await fetch(`races/${id}.json`);if(!response.ok)throw Error('Lap records unavailable.');const race=await response.json();if(token!==loadToken)return;
 const drivers=race.drivers.sort((a,b)=>a.number-b.number).map((d,i)=>({...prepare(d),color:palette[i%palette.length]}));const fitted=layout(race);$('play').disabled=false;
 $('message').textContent=race.omitted?.length?`Not animated because lap records do not match the result: ${race.omitted.join(', ')}. See official results for the complete classification.`:'';
 const duration=Math.max(...drivers.map(d=>d.total));let time=0,playing=false,last=0,lastTable=-1,focus=drivers.find(d=>d.key===selectedDriver)?.id||'';
 $('raceDate').textContent=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(race.date+'T12:00:00Z'));$('raceName').textContent=`${race.event} · ${race.round} · ${race.name}`;$('source').href=race.source;$('timeline').max=duration;$('endTime').textContent=clock(duration);
 $('cars').replaceChildren();document.querySelectorAll('#circuit filter').forEach(n=>n.remove());const path=$('route'),length=path.getTotalLength(),cars=new Map();
 const planned=$('layoutSelect').value!=='oval';
 const mainStraight=fitted?.mainStraight||(planned&&race.eventId==='518551'?{from:{x:223,y:190},to:{x:1350,y:190}}:planned&&race.eventId==='499054'?{from:{x:190,y:180},to:{x:1410,y:180}}:{from:{x:250,y:170},to:{x:1330,y:170}});
 const samples=Array.from({length:601},(_,i)=>path.getPointAtLength(i*length/600));
 const illustrative=fitted?false:!planned||!['518551','499054'].includes(race.eventId);
 const pace=paceMap(samples,{mainStraight,straightSpeed:illustrative?2.5:1.65});
 document.getElementById('grid-reference')?.remove();
 {
  const marks=document.createElementNS(svgNS,'g');marks.id='grid-reference';
  const label=document.createElementNS(svgNS,'text');label.setAttribute('x','790');label.setAttribute('y','120');label.setAttribute('text-anchor','middle');label.setAttribute('fill','#edf5ee');label.setAttribute('font-size','22');label.textContent=illustrative?'MAIN STRAIGHT → · ILLUSTRATIVE FINALS GRID':'MAIN STRAIGHT → · FINALS GRID';marks.append(label);
  const grid=gridPositions(mainStraight,drivers.length);
  drivers.forEach((d,i)=>{
   // Equally staggered boxes show the starting
   // order, not surveyed positions from the event's original circuit.
   const {x,y,lane,heading}=grid[i];
   let nearest=0;for(let j=1;j<samples.length-1;j++)if(Math.hypot(samples[j].x-x,samples[j].y-y)<Math.hypot(samples[nearest].x-x,samples[nearest].y-y))nearest=j;
   if(race.isFinal)d.startFraction=nearest/600;
   if(race.isFinal){const box=document.createElementNS(svgNS,'path');box.setAttribute('d',`M-28 ${lane-12} H28 V${lane+12} H-28`);box.setAttribute('transform',`translate(${x} ${y}) rotate(${heading})`);box.setAttribute('stroke','#b4d9a6');box.setAttribute('stroke-width','2');box.setAttribute('fill','none');marks.append(box);}
  });
  $('cars').before(marks);
 }
 for(const d of drivers){let group=document.createElementNS(svgNS,'g');group.classList.add('car');group.dataset.driver=d.id;const shape=document.createElementNS(svgNS,'image');shape.setAttribute('href',avatarFor(d,race.className)||'avatars/plain-fallback.png');shape.setAttribute('x','-36');shape.setAttribute('y','-25');shape.setAttribute('width','72');shape.setAttribute('height','50');
 if(!avatarFor(d,race.className)){const filter=document.createElementNS(svgNS,'filter');filter.id=`tint-${d.id}`;filter.setAttribute('color-interpolation-filters','sRGB');const matrix=document.createElementNS(svgNS,'feColorMatrix');const rgb=[1,3,5].map(n=>parseInt(d.color.slice(n,n+2),16)/255);matrix.setAttribute('type','matrix');matrix.setAttribute('values',rgb.map(v=>`${v*.2126} ${v*.7152} ${v*.0722} 0 0`).join(' ')+' 0 0 0 1 0');filter.append(matrix);$('circuit').prepend(filter);shape.setAttribute('filter',`url(#${filter.id})`);}
 const fire=document.createElementNS(svgNS,'g');fire.classList.add('retirement-fire');fire.setAttribute('aria-hidden','true');for(const [d,fill] of [['M-15 -18 C-32 -42 -5 -43 -9 -67 C13 -55 3 -43 14 -49 C28 -27 19 -13 0 -12 Z','#ff7029'],['M-7 -17 C-18 -32 0 -33 -2 -48 C13 -35 13 -22 5 -15 Z','#ffd75e']]){const flame=document.createElementNS(svgNS,'path');flame.setAttribute('d',d);flame.setAttribute('fill',fill);fire.append(flame);}
 const num=document.createElementNS(svgNS,'text');num.textContent=d.number;num.classList.add('car-number');const title=document.createElementNS(svgNS,'title');title.textContent=`Car ${d.number}: ${d.name}${avatarFor(d,race.className)?'':' · coloured fallback car'}`;group.append(shape,fire,num,title);$('cars').append(group);cars.set(d.id,group);}
 function render(force=false){const standings=ordered(drivers,time),leader=standings[0];$('clock').textContent=clock(time);$('timeline').value=time;$('timeline').setAttribute('aria-valuetext',clock(time));$('raceStatus').textContent=time>=duration?'Race complete':playing?'Playing':time?'Paused':'Ready to replay';
 for(const s of standings){const d=s.driver,dist=visualFraction(d,time,pace)*length,p=path.getPointAtLength(dist),p2=path.getPointAtLength((dist+1)%length);const angle=Math.atan2(p2.y-p.y,p2.x-p.x)*180/Math.PI;const group=cars.get(d.id);const gridLane=Number.isFinite(d.startFraction)?(drivers.indexOf(d)%2?18:-18)*Math.max(0,1-time/Math.min(2,d.laps[0].seconds)):0;const lane=gridLane+(drivers.indexOf(d)%3-1)*4*Math.min(1,time/2);const x=p.x-Math.sin(angle*Math.PI/180)*lane,y=p.y+Math.cos(angle*Math.PI/180)*lane;// Stable bays keep stopped cars clear of the loop; seeking restores them.
 const slot=drivers.indexOf(d),label=document.querySelector('.loop-label');
 const parkedX=Math.min(Number(label.getAttribute('x'))+55,1160)+(slot%4)*110;
 const parkingBase=Math.min(Number(label.getAttribute('y'))+52,935-(Math.ceil(drivers.length/4)-1)*72);
 const parkedY=parkingBase+Math.floor(slot/4)*72;
 const endedEarly=d.total < duration-Math.max(30,d.typical*2);
 group.setAttribute('transform',s.finished?`translate(${parkedX},${parkedY}) scale(1.44)`:`translate(${x},${y}) rotate(${angle}) scale(1.44)`);
 group.querySelector('image').setAttribute('transform',s.finished&&endedEarly?'scale(1,-1)':'scale(1,1)');
 group.classList.toggle('retired',s.finished&&endedEarly);
 group.classList.toggle('dim',!!focus&&focus!==d.id);group.classList.toggle('selected',focus===d.id);
 group.querySelector('title').textContent=`Car ${d.number}: ${d.name}${s.finished?(endedEarly?' · lap records ended early':' · finished'):''}`;}
 if(!force&&Math.abs(time-lastTable)<.15)return;lastTable=time;$('rows').replaceChildren();
 standings.forEach((s,i)=>{const d=s.driver,tr=document.createElement('tr');if(focus===d.id)tr.className='chosen';let gap='Leader';if(i){if(time>=duration){const lapGap=leader.driver.laps.length-d.laps.length;gap=lapGap?`+${lapGap} lap${lapGap===1?'':'s'}`:`+${(d.officialTime-leader.driver.officialTime).toFixed(2)}s`;}else{const behind=leader.progress-s.progress;if(behind>=1)gap=`+${Math.floor(behind)} lap${Math.floor(behind)===1?'':'s'}`;else{const at=timeAtProgress(d,leader.progress);gap=at===null?'Finished':`~+${Math.max(0,at-time).toFixed(1)}s`;}}}
 const delta=s.lapTime-d.typical,slow=!s.finished&&s.lap>1&&s.lapTime>d.typical*1.1;
 for(const val of [i+1,d.name,s.finished?`Finished · ${s.completed}`:`${s.lap} / ${d.laps.length}`,gap,`${s.lapTime.toFixed(3)}s`,s.lap===1&&!s.finished?'Opening lap':`${delta>=0?'+':''}${delta.toFixed(2)}s${slow?' · slower lap':''}`]){const td=document.createElement('td');td.textContent=val;tr.append(td)}
 const chip=document.createElement('span');chip.className='chip';chip.style.background=d.color;chip.textContent=d.number;tr.children[1].prepend(chip);if(slow)tr.children[5].className='slow';if(s.finished)tr.children[2].className='finished';$('rows').append(tr);});}
 function setPlaying(value){playing=value;last=performance.now();$('play').textContent=playing?'Ⅱ Pause':'▶ Play';render(true);}
 function seek(value){time=Math.max(0,Math.min(duration,value));if(time>=duration)setPlaying(false);render(true);}
 $('play').onclick=()=>{if(time>=duration)time=0;setPlaying(!playing)};$('restart').onclick=()=>{setPlaying(false);seek(0)};$('back').onclick=()=>seek(time-10);$('forward').onclick=()=>seek(time+10);$('timeline').oninput=e=>seek(+e.target.value);updateFocus=()=>{focus=drivers.find(d=>d.key===selectedDriver)?.id||'';render(true)};
 document.onvisibilitychange=()=>{if(document.hidden)setPlaying(false)};pauseCurrent=()=>setPlaying(false);
 function tick(now){if(playing){time=Math.min(duration,time+Math.min((now-last)/1000,.1)*+$('speed').value);if(time>=duration){setPlaying(false);if(dayMode){nextRace(true);return;}}render()}last=now;frame=requestAnimationFrame(tick)}render(true);frame=requestAnimationFrame(tick);if(autoplay)setPlaying(true);

 }catch(error){if(token!==loadToken)return;$('message').textContent='The replay could not load. '+error.message;dayMode=false;$('play').disabled=true;}
}
try{
 const responses=await Promise.all([fetch('catalog.json'),fetch('../data/car-avatars.json'),fetch('track-plans.json')]);if(!responses[0].ok)throw Error('Race catalogue unavailable.');catalog=await responses[0].json();if(responses[1].ok)avatars=await responses[1].json();if(!responses[2].ok)throw Error('Track plan catalogue unavailable.');trackPlans=await responses[2].json();
 options($('eventSelect'),catalog.events.map(e=>[e.id,`${e.date} · ${e.name}`]));
 const initial=catalog.events.find(e=>e.id===catalog.raceEvents[params.get('race')])||catalog.events.find(e=>e.id===params.get('event'))||catalog.events[0];if(!initial)throw Error('No replay races available.');
 $('eventSelect').value=initial.id;$('layoutSelect').value=params.get('layout')==='oval'?'oval':'auto';
 $('eventSelect').onchange=()=>changeEvent(catalog.events.find(e=>e.id===$('eventSelect').value)?.defaultRace);$('raceSelect').onchange=()=>{dayMode=false;loadRace()};
 $('focus').onchange=()=>{selectedDriver=$('focus').value;const previous=$('raceSelect').value;raceOptions(previous);dayMode=false;if($('raceSelect').value===previous){updateFocus();syncUrl();}else loadRace();};
 $('layoutSelect').onchange=()=>{dayMode=false;loadRace()};
 $('dayPlay').onclick=()=>{dayMode=true;$('raceSelect').value=listRaces()[0].id;$('dayStatus').textContent='Playing this driver’s day. Pause and seek work within each race.';loadRace(true)};
 $('nextRace').onclick=()=>nextRace(dayMode);
 changeEvent(params.get('race')||initial.defaultRace);
}catch(error){$('message').textContent=error.message;$('play').disabled=true;}
