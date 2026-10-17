import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {paceMap} from '../public/virtual-race-replay/pace.js';
import {planPoint,routePath,straightFor,routePoint,gridPositions,planBorder} from '../public/virtual-race-replay/track-layouts.js';
import {prepare,positionAt,visualFraction,finishFraction,raceTimeAtPosition,raceTimingAtPosition} from '../public/virtual-race-replay/engine.js';
const base=new URL('../public/virtual-race-replay/',import.meta.url);
{
 const driver=prepare({officialTime:47.1,laps:[{seconds:14.5},{seconds:16.25},{seconds:16.37}]}),running={driver,...positionAt(driver,20)},finished={driver,...positionAt(driver,driver.total)};
 assert.equal(raceTimeAtPosition(running),14.5,'running timing uses the latest completed crossing');
 assert.equal(raceTimingAtPosition(running),'1 / 14.50','running timing matches the 3D laps / seconds format');
 assert.equal(raceTimeAtPosition(finished),47.1,'finished timing uses official total race seconds');
 assert.equal(raceTimingAtPosition(finished),'3 / 47.10','finished timing matches the 3D laps / seconds format');
}
// Sample the actual SVG routes without a browser dependency (quadratic curves
// are densely flattened before equal-distance resampling).
function sample(d){
 const t=d.match(/[MLHVQZ]|-?\d+(?:\.\d+)?/g),raw=[];let i=0,x=0,y=0,start;
 const add=(a,b)=>{x=a;y=b;raw.push({x,y});};
 while(i<t.length){const c=t[i++];
  if(c==='M'||c==='L'){add(+t[i++],+t[i++]);if(c==='M')start={x,y};}
  else if(c==='H')add(+t[i++],y);
  else if(c==='V')add(x,+t[i++]);
  else if(c==='Q'){const ax=x,ay=y,bx=+t[i++],by=+t[i++],cx=+t[i++],cy=+t[i++];for(let j=1;j<=100;j++){const u=j/100,v=1-u;add(v*v*ax+2*v*u*bx+u*u*cx,v*v*ay+2*v*u*by+u*u*cy);}}
  else if(c==='Z')add(start.x,start.y);else throw Error('Unsupported route command '+c);
 }
 const cumulative=[0];for(let j=1;j<raw.length;j++)cumulative.push(cumulative[j-1]+Math.hypot(raw[j].x-raw[j-1].x,raw[j].y-raw[j-1].y));
 const length=cumulative.at(-1);let segment=1;
 const points=Array.from({length:601},(_,j)=>{const target=j/600*length;while(segment<cumulative.length-1&&cumulative[segment]<target)segment++;const f=(target-cumulative[segment-1])/(cumulative[segment]-cumulative[segment-1]);return{x:raw[segment-1].x+(raw[segment].x-raw[segment-1].x)*f,y:raw[segment-1].y+(raw[segment].y-raw[segment-1].y)*f};});
 return {points,length};
}
const html=readFileSync(new URL('index.html',base),'utf8'),js=readFileSync(new URL('replay.js',base),'utf8');
const routes=[
 {name:'September',d:html.match(/id="route" d="([^"]+)"/)[1],from:{x:223,y:190},to:{x:1350,y:190}},
 {name:'March',d:js.match(/const route='([^']+)'/)[1],from:{x:190,y:180},to:{x:1410,y:180}},
 {name:'Oval',d:js.match(/const oval='([^']+)'/)[1],from:{x:250,y:170},to:{x:1330,y:170}}
];
const plans=JSON.parse(readFileSync(new URL('track-plans.json',base),'utf8'));
const catalog=JSON.parse(readFileSync(new URL('catalog.json',base),'utf8'));
{
 const finishers=[{id:'winner',finalPosition:1,number:2},{id:'second',finalPosition:2,number:1},{id:'third',finalPosition:3,number:3}];
 assert(finishFraction(finishers[0],finishers)>finishFraction(finishers[1],finishers),'winner must park furthest beyond the finish line');
 assert(finishFraction(finishers[1],finishers)>finishFraction(finishers[2],finishers),'finishing order must run from front to back');
}
assert.equal(Object.keys(plans).length,27);
for(const [id,plan] of Object.entries(plans)){
 if(id.startsWith('date:'))assert.equal(id,`date:${plan.date}`,`${id}: date template match`);
 else assert.equal(catalog.events.find(e=>e.id===id)?.date,plan.date,`${id}: event date match`);
 assert(existsSync(new URL(plan.image,base)),`${id}: missing image`);
 const loop=planPoint(plan.loop,plan);
 assert(loop.x>=87&&loop.x<=1525&&loop.y>=125&&loop.y<=891,`${id}: cropped loop outside template`);
 const points=plan.routeStatus==='confirmed'?plan.points:plan.draftPoints;
 if(!points)continue;
 const start=routePoint(points[0],plan);assert(Math.hypot(start.x-loop.x,start.y-loop.y)<.02,`${id}: route must begin at the marked loop`);
 routes.push({name:`${plan.date} ${plan.routeStatus==='confirmed'?'confirmed':'draft'}`,d:routePath(points,plan),...straightFor(points,plan)});
}
const maps=routes.map(r=>{
 const straightLength=Math.hypot(r.to.x-r.from.x,r.to.y-r.from.y),metre=(r.scaleWidth||planBorder.width)/30,gridCount=Math.max(2,Math.min(12,Math.floor((straightLength/metre-.25)/2)+1)),grid=gridPositions(r,gridCount);
 for(let i=0;i<grid.length;i++){
  assert(Math.hypot(grid[i].x-r.to.x,grid[i].y-r.to.y)<straightLength,`${r.name}: grid must fit the straight`);
  assert.equal(Math.sign(grid[i].lane),i%2?-1:1,`${r.name}: pole must be inside and sides alternate`);
  if(i)assert(Math.abs(Math.hypot(grid[i].x-grid[i-1].x,grid[i].y-grid[i-1].y)-2*metre)<1e-8,`${r.name}: consecutive grid positions must be two metres apart`);
 }
 const {points,length}=sample(r.d),straightSpeed=r.name==='Oval'?2.5:1.65,pace=paceMap(points,{mainStraight:r,straightSpeed});
 assert.equal(pace(0),0);assert.equal(pace(1),1);for(let k=0;k<=100;k++)assert(Math.abs(pace(pace.timeAtDistance(k/100))-k/100)<1e-10);
 let previous=0,min=Infinity,max=0,technicalMax=0;
 for(let j=1;j<=30000;j++){
  const d=pace(j/30000),speed=(d-previous)*30000,p=points[Math.min(600,Math.round(d*600))];
  assert(speed>=.75-1e-6&&speed<=straightSpeed+1e-6,`${r.name}: speed ${speed}`);
  const dx=r.to.x-r.from.x,dy=r.to.y-r.from.y,offset=Math.abs((p.x-r.from.x)*dy-(p.y-r.from.y)*dx)/Math.hypot(dx,dy);
  if(offset>12){technicalMax=Math.max(technicalMax,speed);assert(speed<=1.1001,`${r.name}: infield speed ${speed}`);}
  min=Math.min(min,speed);max=Math.max(max,speed);previous=d;
 }
 console.log(`${r.name}: speed ${min.toFixed(3)}–${max.toFixed(3)}x lap average; infield max ${technicalMax.toFixed(3)}x; route ${Math.round(length)} units`);
 return pace;
});
{
 const {points}=sample(routes[0].d),pace=paceMap(points,{profile:'race',minimumSpeed:.56,maximumSpeed:1.75});
 let previous=0,min=Infinity,max=0;
 for(let j=1;j<=30000;j++){
  const distance=pace(j/30000),speed=(distance-previous)*30000;
  assert(speed>=.56-1e-5&&speed<=1.75+1e-5,`race pace speed ${speed}`);
  assert(Math.abs(speed-pace.speedAtDistance(distance))<.012,`race pace local speed ${speed}`);
  min=Math.min(min,speed);max=Math.max(max,speed);previous=distance;
 }
 assert(min<.7&&max>1.5,`race pace should visibly accelerate and brake (${min}-${max})`);
 console.log(`Race-day video pace: speed ${min.toFixed(3)}-${max.toFixed(3)}x lap average`);
}
let races=0,drivers=0,crossings=0,shortOpenings=0;
for(const file of readdirSync(new URL('races/',base))){
 if(!file.endsWith('.json'))continue;
 const race=JSON.parse(readFileSync(new URL('races/'+file,base)));races++;
 for(const raw of race.drivers){
  const d=prepare(raw);drivers++;if(race.isFinal){d.startFraction=.2+.03*(raw.number-1);for(const pace of maps){assert(Math.abs(visualFraction(d,0,pace)-d.startFraction)<1e-10);assert(visualFraction(d,.01,pace)>d.startFraction);}}
  else for(const pace of maps){assert.equal(visualFraction(d,0,pace),0,`${file}: heat must start at the loop`);assert(visualFraction(d,.001,pace)>0,`${file}: all heat cars must move immediately`);assert(Math.abs(visualFraction(d,d.laps[0].seconds/2,pace)-pace(.5))<1e-10,`${file}: first lap uses the driver's recorded time`);}
  assert(Math.abs(d.total-d.officialTime)<=.02,`${file}: result total mismatch`);
  let sum=0;
  for(let i=0;i<d.laps.length;i++){
   const lap=d.laps[i];assert(Number.isFinite(lap.seconds)&&lap.seconds>0);sum+=lap.seconds;crossings++;
   const at=positionAt(d,sum);assert.equal(at.completed,i+1);assert.equal(at.progress,i+1);
   assert(positionAt(d,sum-1e-6).progress<i+1);
   for(const pace of maps){assert.equal(visualFraction(d,sum,pace),0);assert(visualFraction(d,sum-1e-6,pace)>.9999);}
  }
  if(!race.isFinal&&d.laps[0].seconds<d.typical*.5){shortOpenings++;for(const pace of maps)assert.equal(visualFraction(d,0,pace),0,'Seeking back restores the simultaneous loop start');}
 }
}
console.log(`Verified ${crossings} recorded crossings in ${races} replays / ${drivers} driver records, on all ${maps.length} route variants. All heat cars start together, including ${shortOpenings} short opening records.`);



