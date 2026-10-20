import {prepare,ordered,positionAt,visualFraction,finishFraction,timeAtProgress,raceTimingAtPosition,lapPerformanceAtPosition} from './engine.js?v=20261018-timing-columns-1';
import {paceMap} from './pace.js?v=20261020-legacy-motion-1';
import {jumpProfile} from './jumps.js?v=20261017-trestle-hop-1';
import {trackPlanFromDesign,designFromTrackPlan} from './track-designs.js?v=20261017-trestle-hop-1';
import {avatarThumbnailPath,loadAvatarColours,avatarColourOverride} from './avatar-colours.js?v=20261017-6';
import {sharedRaceVideo} from '../assets/shared-race-video.js?v=20260929-shared-races';

const $=id=>document.getElementById(id);
const palette=['#85ed40','#56d7ff','#ffca53','#ff7eb1','#c0a2ff','#ff9868','#58e3bb','#e6ebed','#ddea62','#5a92ff','#ff5656','#cda47b'];
const clock=seconds=>`${Math.floor(seconds/60)}:${(seconds%60).toFixed(1).padStart(4,'0')}`;
const params=new URLSearchParams(location.search);
const trackFlyoverMode=params.get('flyover')==='track',raceFlyoverMode=params.get('flyover')==='race',trackExploreMode=params.get('explore')==='track',trackOnlyMode=trackFlyoverMode||trackExploreMode,autoPlay=params.get('autoplay')==='1';
const galleryFlyoverMode=trackFlyoverMode||raceFlyoverMode;
const currentMotionEvents=new Set(['518554','518555']);
const resetFlyoverViewport=()=>{if(!galleryFlyoverMode)return;document.documentElement.scrollTop=0;document.body.scrollTop=0;window.scrollTo(0,0);};
if(galleryFlyoverMode){
  document.body.classList.add('race-flyover-mode');
  if('scrollRestoration'in history)history.scrollRestoration='manual';
  resetFlyoverViewport();
  addEventListener('pageshow',resetFlyoverViewport);
  addEventListener('load',()=>requestAnimationFrame(resetFlyoverViewport),{once:true});
}
let eventId=params.get('event')||'',catalogEvents=[],eventData,design,avatarManifest={},raceVideos=[],viewer,race,drivers=[],pace,lift,lifts={},surfaceLifts={},retiredSlots=new Map(),time=0,duration=0,playing=false,last=0,frame=0;
const avatarColourCache=new Map();

async function json(url){const response=await fetch(url);if(!response.ok)throw Error(`Could not load ${url}`);return response.json();}
async function loadDesign(){
  const response=await fetch(`designs/${eventId}.json`);
  if(response.ok)return response.json();
  if(response.status!==404)throw Error(`Could not load the 3D track design (${response.status})`);
  const plans=await json('track-plans.json'),plan=plans[eventId]||plans[`date:${eventData.date}`];
  if(!plan||plan.routeStatus!=='confirmed')throw Error('A confirmed track plan is not available for this event.');
  return designFromTrackPlan(plan);
}
function surname(name){let clean=String(name||'').replace(/["“”]/g,'').trim().split(/\s+/);return clean.at(-1)||name;}
function rawRoute(){let route=viewer.scene.route.map(({x,y})=>({x,y}));return [...route,route[0]];}
function routeFractionNear(target){let route=viewer.scene.route,best=0,score=Infinity;for(let i=0;i<route.length;i++){let value=(route[i].x-target.x)**2+(route[i].y-target.y)**2;if(value<score){score=value;best=i;}}return best/route.length;}
function carpetSize(){return viewer?.design?.carpet||viewer?.scene?.design?.carpet||design?.carpet||{width:30,height:18};}
function configurePhysics(){
  const plan=trackPlanFromDesign(design),carpet=carpetSize(),toScene=point=>[Number(point[0])/1000*carpet.width,carpet.height-Number(point[1])/650*carpet.height],route=viewer.scene.route,samples=[...route.map(({x,y})=>({x,y})),{x:route[0].x,y:route[0].y}];
  // The visible 3D route uses the viewer's smooth centre line. Build ramp
  // intervals against that exact route so lift begins and ends on the drawn
  // boards rather than on the separately rounded 2D SVG approximation.
  const features=plan.jumpFeatures.map(feature=>({...feature,minimumClearanceMetres:Number(feature.minimumClearanceMetres)||(String(feature.name).startsWith('jump_trestle_')?.7:0),takeoff:feature.takeoff.map(toScene),landing:feature.landing.map(toScene)}));
  const surfaces=plan.jumpSurfaces.map(surface=>({...surface,polygon:surface.polygon.map(toScene),direction:surface.direction?.map(toScene)}));
  const liftOptions={surfaces,routeLengthMetres:viewer.scene.routeLength||plan.routeLengthMetres,referenceHeightMm:323,gravity:9.81,kickerFlightTimeScale:1.55,tabletopFlightTimeScale:1.8,tabletopMinimumClearanceMetres:.65};
  lifts={
    1:jumpProfile(samples,[],.323,features,{...liftOptions,flightTimeScale:1}),
    2:jumpProfile(samples,[],.323,features,{...liftOptions,flightTimeScale:1.08}),
    3:jumpProfile(samples,[],.323,features,{...liftOptions,flightTimeScale:1.15})
  };
  surfaceLifts={
    1:jumpProfile(samples,[],.323,[],{...liftOptions,flightTimeScale:1}),
    2:jumpProfile(samples,[],.323,[],{...liftOptions,flightTimeScale:1.08}),
    3:jumpProfile(samples,[],.323,[],{...liftOptions,flightTimeScale:1.15})
  };
  lift=lifts[1];
  pace=currentMotionEvents.has(String(eventId))
    ?paceMap(rawRoute(),{profile:'race',minimumSpeed:.56,maximumSpeed:1.75})
    :paceMap(rawRoute(),{profile:'legacy-smooth',minimumSpeed:.62,maximumSpeed:1.7});
}
function configureGrid(){
  if(!race.isFinal)return;
  const route=viewer.scene.route,candidates=route.map((point,index)=>({point,index})).filter(({point})=>point.y>15&&point.tx>0);
  const right=candidates.sort((a,b)=>b.point.x-a.point.x)[Math.min(12,candidates.length-1)]||{index:Math.floor(route.length*.25),point:route[Math.floor(route.length*.25)]};
  const heading=Math.atan2(right.point.ty,right.point.tx),forward={x:Math.cos(heading),y:Math.sin(heading)},ahead=route[(right.index+Math.max(8,Math.round(route.length*.012)))%route.length],turnCross=forward.x*(ahead.y-right.point.y)-forward.y*(ahead.x-right.point.x),insideSign=Math.sign(turnCross)||-1;
  drivers.forEach(driver=>{let slot=Math.max(0,Number(driver.startPosition||driver.number||1)-1),target={x:right.point.x-forward.x*slot*2,y:right.point.y-forward.y*slot*2};driver.startFraction=routeFractionNear(target);driver.gridLane=(slot%2?-insideSign:insideSign)*.42;driver.openingSurfaceOnly=Math.abs(lifts[1](driver.startFraction,8)-surfaceLifts[1](driver.startFraction,8))>.035;});
}
function carState(driver,index){
  const scale=viewer?.heightScale||1,airborneLift=lifts[scale]||lift,surfaceLift=surfaceLifts[scale]||airborneLift,activeLift=driver.openingSurfaceOnly&&time<driver.laps[0].seconds?surfaceLift:airborneLift;
  const trackSurface=.035;
  let routeLength=Number(design.routeLengthMetres)||153.9,fraction=visualFraction(driver,time,pace),point=viewer.routeAt(fraction),ahead=viewer.routeAt(fraction+.001),position=positionAt(driver,time),speed=Math.max(2,Math.min(25,routeLength/Math.max(1,position.lapTime||driver.typical)*(pace.speedAtDistance?.(fraction)||1))),heightAt=value=>Math.max(0,activeLift(value,speed),surfaceLift(value,speed)),z=heightAt(fraction)+trackSurface;
  // Read the ramp over roughly a buggy wheelbase rather than at a single
  // sample boundary.  The body follows real ramp angles but cannot flip
  // vertically when entering/leaving a surface or during a gravity arc.
  // The physical COBRA takeoff boards rise about 217-396 mm over
  // 0.667-1.2 m (roughly 18 degrees).  Keep the visible buggy attitude on
  // that real ramp angle while the gravity arc controls its height.  While
  // airborne the car stays nearly level, then blends onto the actual landing
  // slope during its final 100 mm instead of diving over the tabletop early.
  let pitchSample=.0025,beforeLift=heightAt(fraction-pitchSample),afterLift=heightAt(fraction+pitchSample),rawPitch=Math.atan2(afterLift-beforeLift,routeLength*pitchSample*2),surfaceBefore=Math.max(0,surfaceLift(fraction-pitchSample,speed)),surfaceAfter=Math.max(0,surfaceLift(fraction+pitchSample,speed)),surfacePitch=Math.max(-.165,Math.min(.32,Math.atan2(surfaceAfter-surfaceBefore,routeLength*pitchSample*2))),clearance=Math.max(0,heightAt(fraction)-surfaceLift(fraction,speed)),pitch=Math.max(-.165,Math.min(.32,rawPitch));
  if(clearance>.008){let flightPitch=Math.max(-.02,Math.min(.32,rawPitch)),landingBlend=rawPitch<0?Math.max(0,Math.min(1,(.10-clearance)/.092)):0;pitch=flightPitch*(1-landingBlend)+surfacePitch*landingBlend;}
  let yaw=Math.atan2(ahead.y-point.y,ahead.x-point.x),gridBlend=Number.isFinite(driver.startFraction)?Math.max(0,1-time/Math.min(2,driver.laps[0].seconds)):0,lane=(driver.gridLane||0)*gridBlend+(index%3-1)*.11*(1-gridBlend),normal={x:-Math.sin(yaw),y:Math.cos(yaw)},retired=position.finished&&retiredSlots.has(driver.id),roll=0;
  if(retired){
    const slot=retiredSlots.get(driver.id),carpet=carpetSize(),loop=design.loop||viewer.scene.route[0],parkingFraction=routeFractionNear(loop),anchor=viewer.routeAt(parkingFraction),next=viewer.routeAt(parkingFraction+.002),heading=Math.atan2(next.y-anchor.y,next.x-anchor.x),forward={x:Math.cos(heading),y:Math.sin(heading)},side={x:-forward.y,y:forward.x},edgeDistance=candidate=>Math.min(candidate.x,candidate.y,carpet.width-candidate.x,carpet.height-candidate.y),plus={x:anchor.x+side.x*2.25,y:anchor.y+side.y*2.25},minus={x:anchor.x-side.x*2.25,y:anchor.y-side.y*2.25},parkingSide=edgeDistance(plus)>edgeDistance(minus)?side:{x:-side.x,y:-side.y};
    fraction=parkingFraction;point={x:Math.max(.65,Math.min(carpet.width-.65,anchor.x+parkingSide.x*2.25-forward.x*slot*1.25)),y:Math.max(.65,Math.min(carpet.height-.65,anchor.y+parkingSide.y*2.25-forward.y*slot*1.25))};yaw=heading;lane=0;z=.38;pitch=0;roll=Math.PI;normal={x:0,y:0};
  }else if(time>=duration){fraction=finishFraction(driver,drivers);point=viewer.routeAt(fraction);ahead=viewer.routeAt(fraction+.001);yaw=Math.atan2(ahead.y-point.y,ahead.x-point.x);z=activeLift(fraction,speed)+trackSurface;pitch=0;}
  return{id:driver.id,fraction,x:point.x+normal.x*lane,y:point.y+normal.y*lane,z,yaw,pitch,roll,onFire:retired,firePhase:time*7,length:1.02,width:.66,height:.33,color:driver.color,accentColor:driver.accentColor,secondaryColor:driver.secondaryColor,tertiaryColor:driver.tertiaryColor,wheelColor:driver.wheelColor,colorLayout:driver.colorLayout,label:surname(driver.name),number:driver.number};
}
function advanceFollowDriver(){
  const focus=String($('focus').value||''),current=drivers.find(driver=>String(driver.id)===focus);if(!playing||!current||time<current.total||time>=duration)return;
  const order=ordered(drivers,time),index=order.findIndex(entry=>String(entry.driver.id)===focus),below=index>=0?order.slice(index+1):[],above=index>0?order.slice(0,index):[],next=[...below,...above].find(entry=>!entry.finished);if(!next)return;
  const id=String(next.driver.id);$('focus').value=id;viewer.container.querySelector('[data-replay-focus]').value=id;viewer.setFollowCar(id);
}
function timingFor(entry){return raceTimingAtPosition(entry);}
function timeToLeader(entry,leader,index){
  if(index===0)return'LEADER';
  const leaderAtProgress=timeAtProgress(leader.driver,entry.progress),reference=entry.finished?entry.driver.total:time;
  return`+${Math.max(0,reference-(leaderAtProgress??reference)).toFixed(2)} s`;
}
function timingRow(entry,index,compact=false,leader=null){
  const row=document.createElement(compact?'tr':'li');
  if(index===0)row.className='leader';
  if(compact){
    const position=document.createElement('td'),name=document.createElement('td'),result=document.createElement('td'),gap=document.createElement('td'),lapTime=document.createElement('td'),comparison=document.createElement('td'),performance=lapPerformanceAtPosition(entry);
    position.textContent=String(index+1);name.textContent=entry.driver.name;result.textContent=timingFor(entry);gap.textContent=timeToLeader(entry,leader,index);lapTime.textContent=performance.lapTime;comparison.textContent=performance.comparison;comparison.classList.toggle('slow',performance.slow);row.append(position,name,result,gap,lapTime,comparison);
  }else{
    const name=document.createElement('span'),result=document.createElement('strong');
    name.textContent=`${entry.driver.name} · car ${entry.driver.number}`;result.textContent=`${timingFor(entry)} · ${timeToLeader(entry,leader,index)}`;row.append(name,result);
  }
  return row;
}
function addLiveTiming(){
  const wrap=viewer.container.querySelector('.c3-canvas-wrap'),panel=document.createElement('aside'),toolbar=viewer.container.querySelector('.c3-toolbar'),button=document.createElement('button');
  viewer.container.classList.add('c3-timing-behind');
  panel.className='c3-timing-overlay';panel.dataset.liveTiming='';panel.tabIndex=0;panel.setAttribute('role','button');panel.setAttribute('aria-pressed','false');panel.setAttribute('aria-label','Live race timing. Activate to bring the timing screen in front of the track.');panel.title='Click or tap to move the timing screen in front of or behind the track';panel.innerHTML='<header><strong data-live-timing-title>Live timing</strong><span>Laps / seconds · gap · lap performance</span></header><table><thead><tr><th>Pos</th><th>Driver</th><th>Laps / seconds</th><th>To leader</th><th>Lap time</th><th><span class="c3-full-heading">Compared with typical lap</span><span class="c3-short-heading">Vs typical</span></th></tr></thead><tbody data-live-timing-body></tbody></table>';
  const ghost=panel.cloneNode(true);ghost.classList.add('c3-timing-ghost');ghost.removeAttribute('data-live-timing');ghost.dataset.liveTimingGhost='';ghost.tabIndex=-1;ghost.removeAttribute('role');ghost.removeAttribute('aria-pressed');ghost.setAttribute('aria-hidden','true');ghost.removeAttribute('title');
  const setTimingFront=front=>{viewer.container.classList.toggle('c3-timing-front',front);panel.setAttribute('aria-pressed',String(front));panel.setAttribute('aria-label',`Live race timing. Activate to move the timing screen ${front?'behind':'in front of'} the track.`);};
  setTimingFront(true);
  let timingPress=null;
  viewer.container.addEventListener('pointerdown',event=>{const rect=panel.getBoundingClientRect();if(panel.hidden||event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)return;timingPress={id:event.pointerId,x:event.clientX,y:event.clientY,wasFront:viewer.container.classList.contains('c3-timing-front')};},true);
  viewer.container.addEventListener('pointerup',event=>{if(!timingPress||event.pointerId!==timingPress.id)return;const press=timingPress;timingPress=null;if(Math.hypot(event.clientX-press.x,event.clientY-press.y)>10)return;setTimingFront(!press.wasFront);},true);
  panel.addEventListener('keydown',event=>{if(event.key!=='Enter'&&event.key!==' ')return;event.preventDefault();setTimingFront(!viewer.container.classList.contains('c3-timing-front'));});
  button.type='button';button.dataset.timingToggle='';button.className='active';button.textContent='Race timings';button.setAttribute('aria-pressed','true');
  button.addEventListener('click',()=>{const visible=panel.hidden;panel.hidden=!visible;ghost.hidden=!visible;button.classList.toggle('active',visible);button.setAttribute('aria-pressed',String(visible));});
  toolbar.insertBefore(button,toolbar.querySelector('.c3-grow'));wrap.append(panel,ghost);
}
function render(force=false){
  advanceFollowDriver();
  let cars=trackOnlyMode?[]:drivers.map(carState),focus=trackOnlyMode?'':$('focus').value,follow=cars.find(car=>String(car.id)===focus),followDriver=drivers.find(driver=>String(driver.id)===focus),followStopped=followDriver&&time>=followDriver.total,followState=followStopped?(retiredSlots.has(followDriver.id)?`${surname(followDriver.name)} has retired`:`${surname(followDriver.name)} has finished`):'';viewer.setFollowCar(focus);if(follow)viewer.target={x:follow.x,y:follow.y,z:Math.max(0,follow.z)};viewer.setCars(cars);$('clock').textContent=clock(time);$('timeline').value=String(time);$('status').textContent=time>=duration?'Race complete':followState?`${followState} · race ${playing?'still playing':'paused'}`:playing?'Playing':'Paused';
  const controls=viewer.container.querySelector('[data-replay-controls]');if(controls){controls.querySelector('[data-replay-time]').value=String(time);controls.querySelector('[data-replay-clock]').textContent=clock(time);controls.querySelector('[data-replay-action="play"]').textContent=playing?'Ⅱ Pause':'▶ Play';}const mobilePlay=viewer.container.querySelector('[data-mobile-replay-play]');if(mobilePlay)mobilePlay.textContent=playing?'Ⅱ Pause':'▶ Play';
  if(force||Math.floor(time*2)!==render.lastOrder){render.lastOrder=Math.floor(time*2);const currentOrder=ordered(drivers,time),leader=currentOrder[0];$('order').replaceChildren(...currentOrder.map((entry,index)=>timingRow(entry,index,false,leader)));for(const body of viewer.container.querySelectorAll('[data-live-timing-body]'))body.replaceChildren(...currentOrder.map((entry,index)=>timingRow(entry,index,true,leader)));}
}
function tick(timestamp){if(!playing){frame=0;return;}let delta=Math.min(.12,(timestamp-last)/1000||0);last=timestamp;time=Math.min(duration,time+delta*Number($('speed').value));if(time>=duration)playing=false;render();$('play').textContent=playing?'Ⅱ Pause':'▶ Play';frame=playing?requestAnimationFrame(tick):0;}
function setPlaying(next){cancelAnimationFrame(frame);frame=0;playing=Boolean(next);if(playing){if(time>=duration)time=0;last=performance.now();frame=requestAnimationFrame(tick);}render();$('play').textContent=playing?'Ⅱ Pause':'▶ Play';}
function setTime(value){time=Math.max(0,Math.min(duration,Number(value)||0));render(true);}
function addViewerReplayControls(){
  const toolbar=viewer.container.querySelector('.c3-toolbar'),controls=document.createElement('span'),mobileBar=document.createElement('div');controls.className='c3-replay-controls';controls.dataset.replayControls='';controls.innerHTML='<button type="button" data-replay-action="restart">↺</button><button type="button" data-replay-action="back">−10s</button><button type="button" data-replay-action="play">▶ Play</button><button type="button" data-replay-action="forward">+10s</button><input type="range" min="0" max="1" step="0.01" value="0" aria-label="Race time" data-replay-time><output data-replay-clock>0:00.0</output><label>Speed <select data-replay-speed><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select></label><label>Driver <select data-replay-focus><option value="">All drivers</option></select></label>';mobileBar.className='c3-mobile-replay-bar';mobileBar.innerHTML='<button type="button" data-mobile-replay-play>▶ Play</button><button type="button" data-action="mobile-controls" aria-expanded="false">☰ Controls</button>';
  viewer.container.insertBefore(mobileBar,toolbar);toolbar.append(controls);mobileBar.querySelector('[data-mobile-replay-play]').addEventListener('click',()=>$('play').click());controls.addEventListener('click',event=>{const action=event.target.closest('[data-replay-action]')?.dataset.replayAction;if(action==='restart')setTime(0);if(action==='back')setTime(time-10);if(action==='forward')setTime(time+10);if(action==='play')$('play').click();});controls.querySelector('[data-replay-time]').addEventListener('input',event=>setTime(event.target.value));controls.querySelector('[data-replay-speed]').addEventListener('change',event=>{$('speed').value=event.target.value;});controls.querySelector('[data-replay-focus]').addEventListener('change',event=>{$('focus').value=event.target.value;$('focus').dispatchEvent(new Event('change'));});$('speed').addEventListener('change',()=>{controls.querySelector('[data-replay-speed]').value=$('speed').value;});
}
function placeYouTubeLink(){const link=$('youtube'),toolbar=viewer.container.querySelector('.c3-toolbar');if(link&&toolbar)toolbar.insertBefore(link,toolbar.querySelector('.c3-grow'));}
function syncUrl(){let url=new URL(location.href);url.searchParams.set('event',eventId);url.searchParams.set('race',race.id);history.replaceState({},'',url);$('back2d').href=`./?event=${eventId}&race=${race.id}`;}
function updateYouTubeLink(){
  const link=$('youtube');if(!link||!race)return;
  const raceResults=race.drivers.map(driver=>[String(race.id),driver.key]),video=sharedRaceVideo(raceResults,raceVideos,race.id);
  link.hidden=!video;
  if(!video){link.removeAttribute('href');link.removeAttribute('title');link.removeAttribute('aria-label');return;}
  link.href=video.url;link.title=video.title||'Watch this race on YouTube';link.setAttribute('aria-label',`${link.title} (opens in a new tab)`);
}
async function loadRace(id){
  cancelAnimationFrame(frame);playing=false;$('play').textContent='▶ Play';$('status').textContent='Loading race…';race=await json(`races/${id}.json`);drivers=race.drivers.slice().sort((a,b)=>a.number-b.number).map((driver,index)=>({...prepare(driver),color:palette[index%palette.length],...(avatarColourOverride(driver.key)||{})}));
  const currentDrivers=drivers,currentRaceId=String(race.id);
  duration=Math.max(...drivers.map(driver=>driver.total));retiredSlots=new Map(drivers.filter(driver=>driver.total<duration-Math.max(30,driver.typical*2)).sort((a,b)=>a.total-b.total||a.number-b.number).map((driver,index)=>[driver.id,index]));$('timeline').max=String(duration);viewer.container.querySelector('[data-replay-time]').max=String(duration);$('endTime').textContent=clock(duration);$('raceTitle').textContent=`${race.name} · ${race.round}`;for(const title of viewer.container.querySelectorAll('[data-live-timing-title]'))title.textContent=race.name;$('official').href=race.source;updateYouTubeLink();
  const focusOptions=()=>[new Option('All drivers',''),...drivers.map(driver=>new Option(`${driver.number}. ${driver.name}`,driver.id))];$('focus').replaceChildren(...focusOptions());viewer.container.querySelector('[data-replay-focus]').replaceChildren(...focusOptions());configureGrid();time=0;syncUrl();render(true);
  Promise.all(currentDrivers.map(async driver=>{if(avatarColourOverride(driver.key))return;let url=avatarThumbnailPath(avatarManifest,driver.key,race.className);if(url){let profile=avatarColourCache.get(url);if(profile===undefined){try{profile=await loadAvatarColours(url);}catch{profile=null;}avatarColourCache.set(url,profile);}if(profile)Object.assign(driver,profile);}})).then(()=>{if(drivers===currentDrivers&&String(race?.id)===currentRaceId)render(true);});
}
async function start(){
  try{
    const [catalog,manifest]=await Promise.all([json('catalog.json'),json('../data/car-avatars.json').catch(()=>({}))]);avatarManifest=manifest;catalogEvents=Array.isArray(catalog.events)?catalog.events:[];
    const requestedRace=params.get('race'),selectedEvent=catalogEvents.find(item=>String(item.id)===String(eventId))||catalogEvents.find(item=>String(item.id)===String(catalog.raceEvents?.[requestedRace]))||catalogEvents[0];if(!selectedEvent)throw Error('No 3D replay events are available.');eventId=String(selectedEvent.id);
    $('eventSelect').replaceChildren(...catalogEvents.map(item=>new Option(item.name,item.id)));$('eventSelect').value=eventId;
    const eventPromise=json(`events/${eventId}.json`);eventData=await eventPromise;
    const viewTitle=trackFlyoverMode?`${eventData.name} Track Flyover`:trackExploreMode?`${eventData.name} 3D Track Explorer`:`${eventData.name} in 3D`;$('eventTitle').textContent=viewTitle;document.title=`${viewTitle} | COBRA RC Racing Cardiff`;
    $('raceSelect').replaceChildren(...eventData.races.map(item=>new Option(`${item.round} · ${item.name}`,item.id)));
    const initial=eventData.races.some(item=>String(item.id)===String(requestedRace))?String(requestedRace):eventData.races.some(item=>String(item.id)===String(selectedEvent.defaultRace))?String(selectedEvent.defaultRace):String(eventData.races[0]?.id||'');if(!initial)throw Error('No recorded races are available for this event.');$('raceSelect').value=initial;$('status').textContent='Loading the 3D track…';
    json('../data/videos.json?v=20261017-current-races').then(data=>{raceVideos=data.videos||[];updateYouTubeLink();}).catch(()=>{});design=await loadDesign();design.motionProfile=currentMotionEvents.has(String(eventId))?'current':'legacy-smooth';
    const measured=!design.flatReplay;$('physicsStatus').textContent=measured?'Measured ramps · gravity 9.81 m/s²':'Flat replay · no inferred jumps';
    $('replayMethod').innerHTML=measured?'Choose a driver above, then press <strong>Follow selected car</strong> in the 3D viewer. Cars use their recorded lap times. Their position between timing-loop crossings is estimated along the confirmed Track Designer centre line. Ramp heights are measured; airborne motion uses gravity at 9.81 m/s².':'Choose a driver above, then press <strong>Follow selected car</strong> in the 3D viewer. Cars use their recorded lap times and follow the confirmed event route. This plan does not contain measured ramp positions, so the replay deliberately keeps the cars on the flat circuit.';
    viewer=window.CobraTrack3D.mount($('viewer'),{design,heightScale:1,view:'3d',zoom:1.35,carLabels:!trackOnlyMode,flyover:trackFlyoverMode,trackOnly:trackOnlyMode});addViewerReplayControls();if(!trackOnlyMode){addLiveTiming();placeYouTubeLink();}configurePhysics();
    if(trackOnlyMode){document.body.classList.add('track-only-mode');viewer.container.classList.add('c3-track-only');$('raceSelect').closest('label').hidden=true;$('focus').closest('label').hidden=true;$('official').hidden=true;$('youtube').hidden=true;document.querySelector('.replay-controls').hidden=true;document.querySelector('.race-order').hidden=true;$('replayMethod').hidden=true;viewer.container.querySelector('[data-replay-controls]').hidden=true;const mobileReplayBar=viewer.container.querySelector('.c3-mobile-replay-bar');if(trackExploreMode)mobileReplayBar.hidden=true;else{mobileReplayBar.classList.add('c3-flyover-menu-only');mobileReplayBar.querySelector('[data-mobile-replay-play]').hidden=true;}viewer.container.querySelector('[data-action="car-labels"]').hidden=true;const flyoverButton=viewer.container.querySelector('[data-action="flyover"]');if(trackExploreMode)flyoverButton.hidden=true;else flyoverButton.textContent='Track flyover';}
    $('raceSelect').disabled=false;await loadRace(initial);if(trackFlyoverMode){resetFlyoverViewport();requestAnimationFrame(()=>requestAnimationFrame(resetFlyoverViewport));}if(raceFlyoverMode&&!trackOnlyMode){viewer.startFlyover(true);resetFlyoverViewport();requestAnimationFrame(()=>requestAnimationFrame(resetFlyoverViewport));}if(autoPlay&&!trackOnlyMode)setPlaying(true);if(trackOnlyMode){$('raceTitle').textContent=trackFlyoverMode?'Automatic flyover of the measured track · no cars shown':'Drag to rotate · right-drag to pan · scroll to zoom · no cars shown';$('status').textContent=trackFlyoverMode?'Track flyover running':'Explore the track from any angle';}
  }catch(error){$('status').textContent=error.message;$('status').className='error';console.error(error);}
}

$('eventSelect').addEventListener('change',()=>{const next=catalogEvents.find(item=>String(item.id)===$('eventSelect').value);if(!next)return;const url=new URL(location.href);url.searchParams.set('event',next.id);if(next.defaultRace)url.searchParams.set('race',next.defaultRace);else url.searchParams.delete('race');url.searchParams.delete('v');location.assign(url);});
$('raceSelect').addEventListener('change',()=>loadRace($('raceSelect').value));
$('focus').addEventListener('change',()=>{const id=$('focus').value;viewer.container.querySelector('[data-replay-focus]').value=id;viewer.setFollowCar(id);if(id)viewer.startFlyover(true);else{const carpet=carpetSize();viewer.target={x:carpet.width/2,y:carpet.height/2,z:0};}render(true);});
$('play').addEventListener('click',()=>setPlaying(!playing));
$('restart').addEventListener('click',()=>setTime(0));$('back').addEventListener('click',()=>setTime(time-10));$('forward').addEventListener('click',()=>setTime(time+10));$('timeline').addEventListener('input',event=>setTime(event.target.value));
start();
