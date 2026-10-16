import {prepare,ordered,positionAt,visualFraction} from './engine.js';
import {paceMap} from './pace.js?v=20261017-race';
import {jumpProfile} from './jumps.js?v=20261017-tabletop';
import {routePath,routePoint} from './track-layouts.js?v=20261004-presentation';
import {trackPlanFromDesign} from './track-designs.js?v=20261016-3d';

const $=id=>document.getElementById(id);
const palette=['#85ed40','#56d7ff','#ffca53','#ff7eb1','#c0a2ff','#ff9868','#58e3bb','#e6ebed','#ddea62','#5a92ff','#ff5656','#cda47b'];
const clock=seconds=>`${Math.floor(seconds/60)}:${(seconds%60).toFixed(1).padStart(4,'0')}`;
const params=new URLSearchParams(location.search),eventId=params.get('event')||'518555';
let eventData,design,viewer,race,drivers=[],pace,lift,lifts={},time=0,duration=0,playing=false,last=0,frame=0;

async function json(url){const response=await fetch(url);if(!response.ok)throw Error(`Could not load ${url}`);return response.json();}
function surname(name){let clean=String(name||'').replace(/["“”]/g,'').trim().split(/\s+/);return clean.at(-1)||name;}
function rawRoute(){let route=viewer.scene.route.map(({x,y})=>({x,y}));return [...route,route[0]];}
function planSamples(plan){let path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',routePath(plan.points));let length=path.getTotalLength();return Array.from({length:901},(_,i)=>path.getPointAtLength(length*i/900));}
function routeFractionNear(target){let route=viewer.scene.route,best=0,score=Infinity;for(let i=0;i<route.length;i++){let value=(route[i].x-target.x)**2+(route[i].y-target.y)**2;if(value<score){score=value;best=i;}}return best/route.length;}
function configurePhysics(){
  const plan=trackPlanFromDesign(design),samples=planSamples(plan);
  const features=plan.jumpFeatures.map(feature=>({...feature,takeoff:feature.takeoff.map(point=>{let p=routePoint(point,plan);return[p.x,p.y]}),landing:feature.landing.map(point=>{let p=routePoint(point,plan);return[p.x,p.y]})}));
  const surfaces=plan.jumpSurfaces.map(surface=>({...surface,polygon:surface.polygon.map(point=>{let p=routePoint(point,plan);return[p.x,p.y]}),direction:surface.direction?.map(point=>{let p=routePoint(point,plan);return[p.x,p.y]})}));
  const liftOptions={surfaces,routeLengthMetres:plan.routeLengthMetres,referenceHeightMm:323,gravity:9.81,kickerFlightTimeScale:1.55,tabletopFlightTimeScale:1.45};
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
  drivers.forEach(driver=>{let target={x:right.point.x-(Math.max(1,driver.startPosition||driver.number)-1)*.62,y:right.point.y};driver.startFraction=routeFractionNear(target);});
}
function carState(driver,index){
  const activeLift=lifts[viewer?.heightScale]||lift;
  let routeLength=Number(design.routeLengthMetres)||153.9,fraction=visualFraction(driver,time,pace),point=viewer.routeAt(fraction),ahead=viewer.routeAt(fraction+.001),position=positionAt(driver,time),speed=Math.max(2,Math.min(25,routeLength/Math.max(1,position.lapTime||driver.typical)*(pace.speedAtDistance?.(fraction)||1))),z=Math.max(0,activeLift(fraction,speed));
  // Read the ramp over roughly a buggy wheelbase rather than at a single
  // sample boundary.  The body follows real ramp angles but cannot flip
  // vertically when entering/leaving a surface or during a gravity arc.
  let pitchSample=.0015,beforeLift=Math.max(0,activeLift(fraction-pitchSample,speed)),afterLift=Math.max(0,activeLift(fraction+pitchSample,speed)),rawPitch=Math.atan2(afterLift-beforeLift,routeLength*pitchSample*2),pitch=Math.max(-.42,Math.min(.42,rawPitch)),yaw=Math.atan2(ahead.y-point.y,ahead.x-point.x),lane=(index%3-1)*.11*Math.min(1,time/2),normal={x:-Math.sin(yaw),y:Math.cos(yaw)};
  if(time>=duration){fraction=((drivers.slice().sort((a,b)=>a.finalPosition-b.finalPosition).findIndex(item=>item.id===driver.id)+1)*.006)%1;point=viewer.routeAt(fraction);ahead=viewer.routeAt(fraction+.001);yaw=Math.atan2(ahead.y-point.y,ahead.x-point.x);z=activeLift(fraction,speed);pitch=0;}
  return{id:driver.id,fraction,x:point.x+normal.x*lane,y:point.y+normal.y*lane,z,yaw,pitch,length:.68,width:.44,height:.22,color:driver.color,label:surname(driver.name),number:driver.number};
}
function render(force=false){
  let cars=drivers.map(carState),focus=$('focus').value,follow=cars.find(car=>String(car.id)===focus);viewer.setFollowCar(focus);if(follow)viewer.target={x:follow.x,y:follow.y,z:Math.max(0,follow.z)};viewer.setCars(cars);$('clock').textContent=clock(time);$('timeline').value=String(time);$('status').textContent=time>=duration?'Race complete':playing?'Playing':'Paused';
  if(force||Math.floor(time*2)!==render.lastOrder){render.lastOrder=Math.floor(time*2);$('order').replaceChildren(...ordered(drivers,time).map((entry,index)=>{let li=document.createElement('li');li.textContent=`${entry.driver.name} · car ${entry.driver.number}`;if(index===0)li.className='leader';return li;}));}
}
function tick(timestamp){if(!playing)return;let delta=Math.min(.12,(timestamp-last)/1000||0);last=timestamp;time=Math.min(duration,time+delta*Number($('speed').value));if(time>=duration)playing=false;render();$('play').textContent=playing?'Ⅱ Pause':'▶ Play';if(playing)frame=requestAnimationFrame(tick);}
function setTime(value){time=Math.max(0,Math.min(duration,Number(value)||0));render(true);}
function syncUrl(){let url=new URL(location.href);url.searchParams.set('event',eventId);url.searchParams.set('race',race.id);history.replaceState({},'',url);$('back2d').href=`./?event=${eventId}&race=${race.id}`;}
async function loadRace(id){
  cancelAnimationFrame(frame);playing=false;$('play').textContent='▶ Play';race=await json(`races/${id}.json`);drivers=race.drivers.slice().sort((a,b)=>a.number-b.number).map((driver,index)=>({...prepare(driver),color:palette[index%palette.length]}));duration=Math.max(...drivers.map(driver=>driver.total));$('timeline').max=String(duration);$('endTime').textContent=clock(duration);$('raceTitle').textContent=`${race.name} · ${race.round}`;$('official').href=race.source;
  $('focus').replaceChildren(new Option('All drivers',''),...drivers.map(driver=>new Option(`${driver.number}. ${driver.name}`,driver.id)));configureGrid();time=0;syncUrl();render(true);
}
async function start(){
  try{
    [eventData,design]=await Promise.all([json(`events/${eventId}.json`),json(`designs/${eventId}.json`)]);
    viewer=window.CobraTrack3D.mount($('viewer'),{design,heightScale:1,view:'3d',zoom:1.35,carLabels:true});configurePhysics();
    viewer.container.querySelector('[data-height]')?.addEventListener('change',()=>requestAnimationFrame(()=>render(true)));
    for(const item of eventData.races){let option=new Option(`${item.round} · ${item.name}`,item.id);$('raceSelect').append(option);}
    let requested=params.get('race'),initial=eventData.races.some(item=>item.id===requested)?requested:'7121723';$('raceSelect').value=initial;await loadRace(initial);
  }catch(error){$('status').textContent=error.message;$('status').className='error';console.error(error);}
}

$('raceSelect').addEventListener('change',()=>loadRace($('raceSelect').value));
$('focus').addEventListener('change',()=>{if(!$('focus').value)viewer.target={x:design.carpet.width/2,y:design.carpet.height/2,z:0};render(true);});
$('play').addEventListener('click',()=>{playing=!playing;$('play').textContent=playing?'Ⅱ Pause':'▶ Play';if(playing){if(time>=duration)time=0;last=performance.now();frame=requestAnimationFrame(tick);}});
$('restart').addEventListener('click',()=>setTime(0));$('back').addEventListener('click',()=>setTime(time-10));$('forward').addEventListener('click',()=>setTime(time+10));$('timeline').addEventListener('input',event=>setTime(event.target.value));
start();
