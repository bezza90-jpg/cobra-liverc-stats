import test from 'node:test';
import assert from 'node:assert/strict';
import {jumpProfile} from '../public/virtual-race-replay/jumps.js';
import {prepare,visualFraction} from '../public/virtual-race-replay/engine.js';
import {paceMap} from '../public/virtual-race-replay/pace.js';
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
 const lift=jumpProfile(samples,[],6,[{takeoff:box(20,26),landing:box(50,61)}]);
 assert.equal(lift(.2),0);assert(lift(.23)>0&&lift(.23)<6);
 for(const f of [.26,.35,.45,.50])assert.equal(lift(f),6);
 assert(lift(.55)>0&&lift(.55)<6);assert(Math.abs(lift(.6))<1e-10);
 assert.equal(lift(.7),0);assert.equal(lift(.35),lift(1.35));
});
