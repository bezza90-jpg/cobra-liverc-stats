import test from 'node:test';
import assert from 'node:assert/strict';
import {jumpProfile} from '../public/virtual-race-replay/jumps.js';
import {prepare,visualFraction} from '../public/virtual-race-replay/engine.js';
import {paceMap} from '../public/virtual-race-replay/pace.js';
import {trackPlanFromDesign} from '../public/virtual-race-replay/track-designs.js';
import {readFile} from 'node:fs/promises';
const samples=Array.from({length:101},(_,i)=>({x:i,y:0}));
const zones=[[[20,-5],[40,-5],[40,5],[20,5]]];
test('jump is bounded, smooth at entry/exit and absent on ordinary track',()=>{
 const lift=jumpProfile(samples,zones);
 assert.equal(lift(.1),0);assert.equal(lift(.5),0);assert.equal(lift(.2),0);
 assert(Math.abs(lift(.39))<1e-10);assert(lift(.3)>5.9);
 for(let i=0;i<=1000;i++)assert(lift(i/1000)>=0&&lift(i/1000)<=6);
 assert.equal(lift(.3),lift(1.3));assert.equal(jumpProfile(samples)(.3),0);
});
test('local lift rotates with car orientation and preserves recorded crossings',()=>{
 const lift=jumpProfile(samples,zones)(.3);
 const worldOffset=angle=>({x:lift*Math.sin(angle),y:-lift*Math.cos(angle)});
 assert(worldOffset(0).y<0);assert(worldOffset(Math.PI).y>0);
 assert(worldOffset(Math.PI/2).x>0);assert(worldOffset(-Math.PI/2).x<0);
 const driver=prepare({laps:[{seconds:12},{seconds:15},{seconds:16}]});
 const pace=paceMap(samples,{mainStraight:{from:{x:0,y:0},to:{x:100,y:0}},straightSpeed:1.65});
 for(const t of driver.crossings){const distance=visualFraction(driver,t,pace);jumpProfile(samples,zones)(distance);assert.equal(distance,0);}
});

test('kicker stays elevated through the gap and lowers only on the landing ramp',()=>{
 const box=(a,b)=>[[a,-5],[b,-5],[b,5],[a,5]];
 const lift=jumpProfile(samples,[],6,[{takeoff:box(20,26),landing:box(50,61),takeoffHeightMm:217,landingHeightMm:323}],{routeLengthMetres:100});
 assert.equal(lift(.2),0);assert(lift(.23)>0&&lift(.23)<6);
 assert(lift(.35,8)>lift(.26,8));assert(lift(.45,8)>lift(.26,8));
 assert(lift(.55)>0&&lift(.55)<6);assert(Math.abs(lift(.6))<1e-10);
 assert.equal(lift(.7),0);assert.equal(lift(.35),lift(1.35));
});

test('airborne arc accelerates downward at 9.81 metres per second squared',()=>{
 const box=(a,b)=>[[a,-5],[b,-5],[b,5],[a,5]],lift=jumpProfile(samples,[],323,[{takeoff:box(20,26),landing:box(50,61),takeoffHeightMm:217,landingHeightMm:323,gravity:9.81}],{routeLengthMetres:10,referenceHeightMm:323});
 const speed=5,dt=.1,at=x=>lift(.26+x/10,speed)/1000;
 const secondDifference=at(speed*dt*2)-2*at(speed*dt)+at(0);
 assert(Math.abs(secondDifference+9.81*dt*dt)<1e-6);
});

test('measured ramp surfaces use their own heights and direction',()=>{
 const box=(a,b)=>[[a,-5],[b,-5],[b,5],[a,5]],lift=jumpProfile(samples,[],323,[],{routeLengthMetres:10,referenceHeightMm:323,surfaces:[{polygon:box(20,40),direction:[[20,0],[40,0]],profile:'roller',heightMm:171}]});
 assert.equal(lift(.2),0);assert(lift(.3)>170);assert(Math.abs(lift(.39))<1e-10);
});

test('event design automatically supplies its measured ramp profiles',async()=>{
 const design=JSON.parse(await readFile(new URL('../public/virtual-race-replay/designs/518555.json',import.meta.url),'utf8'));
 const plan=trackPlanFromDesign(design,{date:'2026-10-11'});
 assert.equal(plan.date,'2026-10-11');assert.equal(plan.routeLengthMetres,151.5);assert.equal(plan.jumpFeatures.length,2);
 assert.deepEqual(plan.jumpFeatures.map(feature=>[feature.takeoffHeightMm,feature.landingHeightMm]),[[217,276],[217,323]]);
 assert.equal(plan.jumpSurfaces.filter(surface=>surface.profile==='roller').length,2);
 assert(plan.jumpSurfaces.some(surface=>surface.profile==='tabletop-up'&&surface.heightMm===463));
});

