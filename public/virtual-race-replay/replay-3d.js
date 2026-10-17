import {prepare,ordered,positionAt,visualFraction,finishFraction} from './engine.js?v=20261017-finish';
import {paceMap} from './pace.js?v=20261017-race';
import {jumpProfile} from './jumps.js?v=20261017-tabletop-flight';
import {routePath,routePoint} from './track-layouts.js?v=20261004-presentation';
import {trackPlanFromDesign,designFromTrackPlan} from './track-designs.js?v=20261017-season-3d';
import {avatarThumbnailPath,loadAvatarColours} from './avatar-colours.js?v=20261017-1';

const $=id=>document.getElementById(id);
const palette=['#85ed40','#56d7ff','#ffca53','#ff7eb1','#c0a2ff','#ff9868','#58e3bb','#e6ebed','#ddea62','#5a92ff','#ff5656','#cda47b'];
const clock=seconds=>`${Math.floor(seconds/60)}:${(seconds%60).toFixed(1).padStart(4,'0')}`;
const params=new URLSearchParams(location.search),eventId=params.get('event')||'518555';
let eventData,design,avatarManifest={},viewer,race,drivers=[],pace,lift,lifts={},time=0,duration=0,playing=false,last=0,frame=0;
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
function configurePhysics(){
  const plan=trackPlanFromDesign(design),samples=planSamples(plan);
  const features=plan.jumpFeatures.map(feature=>({...feature,takeoff:feature.takeoff.map(point=>{let p=routePoint(point,plan);return[p.x,p.y]}),landing:feature.landing.map(point=>{let p=routePoint(point,plan);return[p.x,p.y]})}));
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
  let pitchSample=.0015,beforeLift=Math.max(0,activeLift(fraction-pitchSample,speed)),afterLift=Math.max(0,activeLift(fraction+pitchSample,speed)),rawPitch=Math.atan2(afterLift-beforeLift,routeLength*pitchSample*2),pitch=Math.max(-.42,Math.min(.42,rawPitch)),yaw=Math.atan2(ahead.y-point.y,ahead.x-point.x),gridBlend=Number.isFinite(driver.startFraction)?Math.max(0,1-time/Math.min(2,driver.laps[0].seconds)):0,lane=(driver.gridLane||0)*gridBlend+(index%3-1)*.11*(1-gridBlend),normal={x:-Math.sin(yaw),y:Math.cos(yaw)};
  if(time>=duration){fraction=finishFraction(driver,drivers);point=viewer.routeAt(fraction);ahead=viewer.routeAt(fraction+.001);yaw=Math.atan2(ahead.y-point.y,ahead.x-point.x);z=activeLift(fraction,speed);pitch=0;}
  return{id:driver.id,fraction,x:point.x+normal.x*lane,y:point.y+normal.y*lane,z,yaw,pitch,length:1.02,width:.66,height:.33,color:driver.color,accentColor:driver.accentColor,wheelColor:driver.wheelColor,label:surname(driver.name),number:driver.number};
}
function render(force=false){
  let cars=drivers.map(carState),focus=$('focus').value,follow=cars.find(car=>String(car.id)===focus);viewer.setFollowCar(focus);if(follow)viewer.target={x:follow.x,y:follow.y,z:Math.max(0,follow.z)};viewer.setCars(cars);$('clock').textContent=clock(time);$('timeline').value=String(time);$('status').textContent=time>=duration?'Race complete':playing?'Playing':'Paused';
  if(force||Math.floor(time*2)!==render.lastOrder){render.lastOrder=Math.floor(time*2);$('order').replaceChildren(...ordered(drivers,time).map((entry,index)=>{let li=document.createElement('li');li.textContent=`${entry.driver.name} · car ${entry.driver.number}`;if(index===0)li.className='leader';return li;}));}
}
function tick(timestamp){if(!playing)return;let delta=Math.min(.12,(timestamp-last)/1000||0);last=timestamp;time=Math.min(duration,time+delta*Number($('speed').value));if(time>=duration)playing=false;render();$('play').textContent=playing?'Ⅱ Pause':'▶ Play';if(playing)frame=requestAnimationFrame(tick);}
function setTime(value){time=Math.max(0,Math.min(duration,Number(value)||0));render(true);}
function syncUrl(){let url=new URL(location.href);url.searchParams.set('event',eventId);url.searchParams.set('race',race.id);history.replaceState({},'',url);$('back2d').href=`./?event=${eventId}&race=${race.id}`;}
async function loadRace(id){
  cancelAnimationFrame(frame);playing=false;$('play').textContent='▶ Play';race=await json(`races/${id}.json`);drivers=race.drivers.slice().sort((a,b)=>a.number-b.number).map((driver,index)=>({...prepare(driver),color:palette[index%palette.length]}));
  await Promise.all(drivers.map(async driver=>{let url=avatarThumbnailPath(avatarManifest,driver.key,race.className);if(!url)return;let profile=avatarColourCache.get(url);if(profile===undefined){try{profile=await loadAvatarColours(url);}catch{profile=null;}avatarColourCache.set(url,profile);}if(profile)Object.assign(driver,profile);}));
  duration=Math.max(...drivers.map(driver=>driver.total));$('timeline').max=String(duration);$('endTime').textContent=clock(duration);$('raceTitle').textContent=`${race.name} · ${race.round}`;$('official').href=race.source;
  $('focus').replaceChildren(new Option('All drivers',''),...drivers.map(driver=>new Option(`${driver.number}. ${driver.name}`,driver.id)));configureGrid();time=0;syncUrl();render(true);
}
async function start(){
  try{
    [eventData,avatarManifest]=await Promise.all([json(`events/${eventId}.json`),json('../data/car-avatars.json').catch(()=>({}))]);design=await loadDesign();
    $('eventTitle').textContent=`${eventData.name} in 3D`;document.title=`${eventData.name} in 3D | COBRA RC Racing Cardiff`;
    const measured=!design.flatReplay;$('physicsStatus').textContent=measured?'Measured ramps · gravity 9.81 m/s²':'Flat replay · no inferred jumps';
    $('replayMethod').innerHTML=measured?'Choose a driver above, then press <strong>Follow selected car</strong> in the 3D viewer. Cars use their recorded lap times. Their position between timing-loop crossings is estimated along the confirmed Track Designer centre line. Ramp heights are measured; airborne motion uses gravity at 9.81 m/s².':'Choose a driver above, then press <strong>Follow selected car</strong> in the 3D viewer. Cars use their recorded lap times and follow the confirmed event route. This plan does not contain measured ramp positions, so the replay deliberately keeps the cars on the flat circuit.';
    viewer=window.CobraTrack3D.mount($('viewer'),{design,heightScale:1,view:'3d',zoom:1.35,carLabels:true});configurePhysics();
    viewer.container.querySelector('[data-height]')?.addEventListener('change',()=>requestAnimationFrame(()=>render(true)));
    for(const item of eventData.races){let option=new Option(`${item.round} · ${item.name}`,item.id);$('raceSelect').append(option);}
    let requested=params.get('race'),initial=eventData.races.some(item=>item.id===requested)?requested:eventData.races[0]?.id;if(!initial)throw Error('No recorded races are available for this event.');$('raceSelect').value=initial;await loadRace(initial);
  }catch(error){$('status').textContent=error.message;$('status').className='error';console.error(error);}
}

$('raceSelect').addEventListener('change',()=>loadRace($('raceSelect').value));
$('focus').addEventListener('change',()=>{if(!$('focus').value)viewer.target={x:design.carpet.width/2,y:design.carpet.height/2,z:0};render(true);});
$('play').addEventListener('click',()=>{playing=!playing;$('play').textContent=playing?'Ⅱ Pause':'▶ Play';if(playing){if(time>=duration)time=0;last=performance.now();frame=requestAnimationFrame(tick);}});
$('restart').addEventListener('click',()=>setTime(0));$('back').addEventListener('click',()=>setTime(time-10));$('forward').addEventListener('click',()=>setTime(time+10));$('timeline').addEventListener('input',event=>setTime(event.target.value));
start();
