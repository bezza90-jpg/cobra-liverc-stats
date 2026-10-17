import {prepare,ordered,positionAt,visualFraction,finishFraction} from './engine.js?v=20261017-finish';
import {paceMap} from './pace.js?v=20261017-race';
import {jumpProfile} from './jumps.js?v=20261017-linear-trestle';
import {routePath,routePoint} from './track-layouts.js?v=20261004-presentation';
import {trackPlanFromDesign,designFromTrackPlan} from './track-designs.js?v=20261017-linear-trestle';
import {avatarThumbnailPath,loadAvatarColours,avatarColourOverride} from './avatar-colours.js?v=20261017-4';

const $=id=>document.getElementById(id);
const palette=['#85ed40','#56d7ff','#ffca53','#ff7eb1','#c0a2ff','#ff9868','#58e3bb','#e6ebed','#ddea62','#5a92ff','#ff5656','#cda47b'];
const clock=seconds=>`${Math.floor(seconds/60)}:${(seconds%60).toFixed(1).padStart(4,'0')}`;
const params=new URLSearchParams(location.search),eventId=params.get('event')||'518555';
let eventData,design,avatarManifest={},viewer,race,drivers=[],pace,lift,lifts={},retiredSlots=new Map(),time=0,duration=0,playing=false,last=0,frame=0;
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
function planSamples(plan){let path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',routePath(plan.points));let length=path.getTotalLength();return Array.from({length:901},(_,i)=>path.getPointAtLength(length*i/900));}
function routeFractionNear(target){let route=viewer.scene.route,best=0,score=Infinity;for(let i=0;i<route.length;i++){let value=(route[i].x-target.x)**2+(route[i].y-target.y)**2;if(value<score){score=value;best=i;}}return best/route.length;}
function carpetSize(){return viewer?.design?.carpet||viewer?.scene?.design?.carpet||design?.carpet||{width:30,height:18};}
function configurePhysics(){
  const plan=trackPlanFromDesign(design),samples=planSamples(plan);
  const features=plan.jumpFeatures.map(feature=>({...feature,minimumClearanceMetres:Number(feature.minimumClearanceMetres)||(String(feature.name).startsWith('jump_trestle_')?.7:0),takeoff:feature.takeoff.map(point=>{let p=routePoint(point,plan);return[p.x,p.y]}),landing:feature.landing.map(point=>{let p=routePoint(point,plan);return[p.x,p.y]})}));
  const surfaces=plan.jumpSurfaces.map(surface=>({...surface,polygon:surface.polygon.map(point=>{let p=routePoint(point,plan);return[p.x,p.y]}),direction:surface.direction?.map(point=>{let p=routePoint(point,plan);return[p.x,p.y]})}));
  const liftOptions={surfaces,routeLengthMetres:plan.routeLengthMetres,referenceHeightMm:323,gravity:9.81,kickerFlightTimeScale:1.55,tabletopFlightTimeScale:1.8,tabletopMinimumClearanceMetres:.65};
  lifts={
    1:jumpProfile(samples,[],.323,features,{...liftOptions,flightTimeScale:1}),
    2:jumpProfile(samples,[],.323,features,{...liftOptions,flightTimeScale:1.08}),
    3:jumpProfile(samples,[],.323,features,{...liftOptions,flightTimeScale:1.15})
  };
  lift=lifts[1];
  pace=paceMap(rawRoute(),{profile:'race',minimumSpeed:.56,maximumSpeed:1.75});
}
function configureGrid(){
  if(!race.isFinal)return;
  const route=viewer.scene.route,candidates=route.map((point,index)=>({point,index})).filter(({point})=>point.y>15&&point.tx>0);
  const right=candidates.sort((a,b)=>b.point.x-a.point.x)[Math.min(12,candidates.length-1)]||{index:Math.floor(route.length*.25),point:route[Math.floor(route.length*.25)]};
  const heading=Math.atan2(right.point.ty,right.point.tx),forward={x:Math.cos(heading),y:Math.sin(heading)},ahead=route[(right.index+Math.max(8,Math.round(route.length*.012)))%route.length],turnCross=forward.x*(ahead.y-right.point.y)-forward.y*(ahead.x-right.point.x),insideSign=Math.sign(turnCross)||-1;
  drivers.forEach(driver=>{let slot=Math.max(0,Number(driver.startPosition||driver.number||1)-1),target={x:right.point.x-forward.x*slot*2,y:right.point.y-forward.y*slot*2};driver.startFraction=routeFractionNear(target);driver.gridLane=(slot%2?-insideSign:insideSign)*.42;});
}
function carState(driver,index){
  const activeLift=lifts[viewer?.heightScale]||lift;
  let routeLength=Number(design.routeLengthMetres)||153.9,fraction=visualFraction(driver,time,pace),point=viewer.routeAt(fraction),ahead=viewer.routeAt(fraction+.001),position=positionAt(driver,time),speed=Math.max(2,Math.min(25,routeLength/Math.max(1,position.lapTime||driver.typical)*(pace.speedAtDistance?.(fraction)||1))),z=Math.max(0,activeLift(fraction,speed));
  // Read the ramp over roughly a buggy wheelbase rather than at a single
  // sample boundary.  The body follows real ramp angles but cannot flip
  // vertically when entering/leaving a surface or during a gravity arc.
  let pitchSample=.0015,beforeLift=Math.max(0,activeLift(fraction-pitchSample,speed)),afterLift=Math.max(0,activeLift(fraction+pitchSample,speed)),rawPitch=Math.atan2(afterLift-beforeLift,routeLength*pitchSample*2),pitch=Math.max(-.42,Math.min(.42,rawPitch)),yaw=Math.atan2(ahead.y-point.y,ahead.x-point.x),gridBlend=Number.isFinite(driver.startFraction)?Math.max(0,1-time/Math.min(2,driver.laps[0].seconds)):0,lane=(driver.gridLane||0)*gridBlend+(index%3-1)*.11*(1-gridBlend),normal={x:-Math.sin(yaw),y:Math.cos(yaw)},retired=position.finished&&retiredSlots.has(driver.id),roll=0;
  if(retired){
    const slot=retiredSlots.get(driver.id),carpet=carpetSize(),loop=design.loop||viewer.scene.route[0],parkingFraction=routeFractionNear(loop),anchor=viewer.routeAt(parkingFraction),next=viewer.routeAt(parkingFraction+.002),heading=Math.atan2(next.y-anchor.y,next.x-anchor.x),forward={x:Math.cos(heading),y:Math.sin(heading)},side={x:-forward.y,y:forward.x},edgeDistance=candidate=>Math.min(candidate.x,candidate.y,carpet.width-candidate.x,carpet.height-candidate.y),plus={x:anchor.x+side.x*1.8,y:anchor.y+side.y*1.8},minus={x:anchor.x-side.x*1.8,y:anchor.y-side.y*1.8},parkingSide=edgeDistance(plus)<edgeDistance(minus)?side:{x:-side.x,y:-side.y};
    fraction=parkingFraction;point={x:Math.max(.65,Math.min(carpet.width-.65,anchor.x+parkingSide.x*1.75-forward.x*slot*1.25)),y:Math.max(.65,Math.min(carpet.height-.65,anchor.y+parkingSide.y*1.75-forward.y*slot*1.25))};yaw=heading;lane=0;z=.38;pitch=0;roll=Math.PI;normal={x:0,y:0};
  }else if(time>=duration){fraction=finishFraction(driver,drivers);point=viewer.routeAt(fraction);ahead=viewer.routeAt(fraction+.001);yaw=Math.atan2(ahead.y-point.y,ahead.x-point.x);z=activeLift(fraction,speed);pitch=0;}
  return{id:driver.id,fraction,x:point.x+normal.x*lane,y:point.y+normal.y*lane,z,yaw,pitch,roll,onFire:retired,firePhase:time*7,length:1.02,width:.66,height:.33,color:driver.color,accentColor:driver.accentColor,secondaryColor:driver.secondaryColor,tertiaryColor:driver.tertiaryColor,wheelColor:driver.wheelColor,colorLayout:driver.colorLayout,label:surname(driver.name),number:driver.number};
}
function advanceFollowDriver(){
  const focus=String($('focus').value||''),current=drivers.find(driver=>String(driver.id)===focus);if(!playing||!current||time<current.total||time>=duration)return;
  const order=ordered(drivers,time),index=order.findIndex(entry=>String(entry.driver.id)===focus),below=index>=0?order.slice(index+1):[],above=index>0?order.slice(0,index):[],next=[...below,...above].find(entry=>!entry.finished);if(!next)return;
  const id=String(next.driver.id);$('focus').value=id;viewer.container.querySelector('[data-replay-focus]').value=id;viewer.setFollowCar(id);
}
function render(force=false){
  advanceFollowDriver();
  let cars=drivers.map(carState),focus=$('focus').value,follow=cars.find(car=>String(car.id)===focus),followDriver=drivers.find(driver=>String(driver.id)===focus),followStopped=followDriver&&time>=followDriver.total,followState=followStopped?(retiredSlots.has(followDriver.id)?`${surname(followDriver.name)} has retired`:`${surname(followDriver.name)} has finished`):'';viewer.setFollowCar(focus);if(follow)viewer.target={x:follow.x,y:follow.y,z:Math.max(0,follow.z)};viewer.setCars(cars);$('clock').textContent=clock(time);$('timeline').value=String(time);$('status').textContent=time>=duration?'Race complete':followState?`${followState} · race ${playing?'still playing':'paused'}`:playing?'Playing':'Paused';
  const controls=viewer.container.querySelector('[data-replay-controls]');if(controls){controls.querySelector('[data-replay-time]').value=String(time);controls.querySelector('[data-replay-clock]').textContent=clock(time);controls.querySelector('[data-replay-action="play"]').textContent=playing?'Ⅱ Pause':'▶ Play';}
  if(force||Math.floor(time*2)!==render.lastOrder){render.lastOrder=Math.floor(time*2);$('order').replaceChildren(...ordered(drivers,time).map((entry,index)=>{let li=document.createElement('li');li.textContent=`${entry.driver.name} · car ${entry.driver.number}`;if(index===0)li.className='leader';return li;}));}
}
function tick(timestamp){if(!playing){frame=0;return;}let delta=Math.min(.12,(timestamp-last)/1000||0);last=timestamp;time=Math.min(duration,time+delta*Number($('speed').value));if(time>=duration)playing=false;render();$('play').textContent=playing?'Ⅱ Pause':'▶ Play';frame=playing?requestAnimationFrame(tick):0;}
function setPlaying(next){cancelAnimationFrame(frame);frame=0;playing=Boolean(next);if(playing){if(time>=duration)time=0;last=performance.now();frame=requestAnimationFrame(tick);}render();$('play').textContent=playing?'Ⅱ Pause':'▶ Play';}
function setTime(value){time=Math.max(0,Math.min(duration,Number(value)||0));render(true);}
function addViewerReplayControls(){
  const toolbar=viewer.container.querySelector('.c3-toolbar'),controls=document.createElement('span');controls.className='c3-replay-controls';controls.dataset.replayControls='';controls.innerHTML='<button type="button" data-replay-action="restart">↺</button><button type="button" data-replay-action="back">−10s</button><button type="button" data-replay-action="play">▶ Play</button><button type="button" data-replay-action="forward">+10s</button><input type="range" min="0" max="1" step="0.01" value="0" aria-label="Race time" data-replay-time><output data-replay-clock>0:00.0</output><label>Speed <select data-replay-speed><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select></label><label>Driver <select data-replay-focus><option value="">All drivers</option></select></label>';
  toolbar.append(controls);controls.addEventListener('click',event=>{const action=event.target.closest('[data-replay-action]')?.dataset.replayAction;if(action==='restart')setTime(0);if(action==='back')setTime(time-10);if(action==='forward')setTime(time+10);if(action==='play')$('play').click();});controls.querySelector('[data-replay-time]').addEventListener('input',event=>setTime(event.target.value));controls.querySelector('[data-replay-speed]').addEventListener('change',event=>{$('speed').value=event.target.value;});controls.querySelector('[data-replay-focus]').addEventListener('change',event=>{$('focus').value=event.target.value;$('focus').dispatchEvent(new Event('change'));});$('speed').addEventListener('change',()=>{controls.querySelector('[data-replay-speed]').value=$('speed').value;});
}
function syncUrl(){let url=new URL(location.href);url.searchParams.set('event',eventId);url.searchParams.set('race',race.id);history.replaceState({},'',url);$('back2d').href=`./?event=${eventId}&race=${race.id}`;}
async function loadRace(id){
  cancelAnimationFrame(frame);playing=false;$('play').textContent='▶ Play';race=await json(`races/${id}.json`);drivers=race.drivers.slice().sort((a,b)=>a.number-b.number).map((driver,index)=>({...prepare(driver),color:palette[index%palette.length]}));
  await Promise.all(drivers.map(async driver=>{let url=avatarThumbnailPath(avatarManifest,driver.key,race.className);if(url){let profile=avatarColourCache.get(url);if(profile===undefined){try{profile=await loadAvatarColours(url);}catch{profile=null;}avatarColourCache.set(url,profile);}if(profile)Object.assign(driver,profile);}let override=avatarColourOverride(driver.key);if(override)Object.assign(driver,override);}));
  duration=Math.max(...drivers.map(driver=>driver.total));retiredSlots=new Map(drivers.filter(driver=>driver.total<duration-Math.max(30,driver.typical*2)).sort((a,b)=>a.total-b.total||a.number-b.number).map((driver,index)=>[driver.id,index]));$('timeline').max=String(duration);viewer.container.querySelector('[data-replay-time]').max=String(duration);$('endTime').textContent=clock(duration);$('raceTitle').textContent=`${race.name} · ${race.round}`;$('official').href=race.source;
  const focusOptions=()=>[new Option('All drivers',''),...drivers.map(driver=>new Option(`${driver.number}. ${driver.name}`,driver.id))];$('focus').replaceChildren(...focusOptions());viewer.container.querySelector('[data-replay-focus]').replaceChildren(...focusOptions());configureGrid();time=0;syncUrl();render(true);
}
async function start(){
  try{
    [eventData,avatarManifest]=await Promise.all([json(`events/${eventId}.json`),json('../data/car-avatars.json').catch(()=>({}))]);design=await loadDesign();
    $('eventTitle').textContent=`${eventData.name} in 3D`;document.title=`${eventData.name} in 3D | COBRA RC Racing Cardiff`;
    const measured=!design.flatReplay;$('physicsStatus').textContent=measured?'Measured ramps · gravity 9.81 m/s²':'Flat replay · no inferred jumps';
    $('replayMethod').innerHTML=measured?'Choose a driver above, then press <strong>Follow selected car</strong> in the 3D viewer. Cars use their recorded lap times. Their position between timing-loop crossings is estimated along the confirmed Track Designer centre line. Ramp heights are measured; airborne motion uses gravity at 9.81 m/s².':'Choose a driver above, then press <strong>Follow selected car</strong> in the 3D viewer. Cars use their recorded lap times and follow the confirmed event route. This plan does not contain measured ramp positions, so the replay deliberately keeps the cars on the flat circuit.';
    viewer=window.CobraTrack3D.mount($('viewer'),{design,heightScale:1,view:'3d',zoom:1.35,carLabels:true});addViewerReplayControls();configurePhysics();
    viewer.container.querySelector('[data-height]')?.addEventListener('change',()=>requestAnimationFrame(()=>render(true)));
    for(const item of eventData.races){let option=new Option(`${item.round} · ${item.name}`,item.id);$('raceSelect').append(option);}
    let requested=params.get('race'),initial=eventData.races.some(item=>item.id===requested)?requested:eventData.races[0]?.id;if(!initial)throw Error('No recorded races are available for this event.');$('raceSelect').value=initial;await loadRace(initial);
  }catch(error){$('status').textContent=error.message;$('status').className='error';console.error(error);}
}

$('raceSelect').addEventListener('change',()=>loadRace($('raceSelect').value));
$('focus').addEventListener('change',()=>{viewer.container.querySelector('[data-replay-focus]').value=$('focus').value;if(!$('focus').value){const carpet=carpetSize();viewer.target={x:carpet.width/2,y:carpet.height/2,z:0};}render(true);});
$('play').addEventListener('click',()=>setPlaying(!playing));
$('restart').addEventListener('click',()=>setTime(0));$('back').addEventListener('click',()=>setTime(time-10));$('forward').addEventListener('click',()=>setTime(time+10));$('timeline').addEventListener('input',event=>setTime(event.target.value));
start();
