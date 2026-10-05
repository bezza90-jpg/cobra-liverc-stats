import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {readFileSync} from 'node:fs';
import {createDistanceRoute} from '../public/assets/journey-route-geometry.js';
import {journeyRoadRoute,journeyRoadDistanceKm,journeyRoadMilestones} from '../public/assets/journey-route.js';
test('saved road route remains compact and milestones follow the routed distance',()=>{
 assert(journeyRoadRoute.length>1000 && journeyRoadRoute.length<10000);
 assert(journeyRoadDistanceKm>3300 && journeyRoadDistanceKm<3700);
 assert(gzipSync(readFileSync(new URL('../public/assets/journey-route.js',import.meta.url))).length<60000);
 assert(Math.abs(journeyRoadRoute[0][0]-51.47098)<.001);assert(Math.abs(journeyRoadRoute[0][1]+3.19984)<.001);
 assert(Math.abs(journeyRoadRoute.at(-1)[0]-41.015)<.01);assert(Math.abs(journeyRoadRoute.at(-1)[1]-28.98)<.01);
 assert.equal(journeyRoadMilestones[0][1],0);assert.equal(journeyRoadMilestones.at(-1)[1],journeyRoadDistanceKm);
 for(let i=1;i<journeyRoadMilestones.length;i++)assert(journeyRoadMilestones[i][1]>journeyRoadMilestones[i-1][1]);
});
test('cached lookup follows segments, caps endpoints and omits travelled-line allocation for moving cars',()=>{
 const lookup=createDistanceRoute([[0,0],[0,1],[1,1]],200);
 assert.deepEqual(lookup(-10).point,[0,0]);assert.deepEqual(lookup(200).point,[1,1]);assert.deepEqual(lookup(300).point,[1,1]);
 assert(Math.abs(lookup(50).point[1]-.5)<.001);assert(Math.abs(lookup(150).point[0]-.5)<.001);
 assert.equal(lookup(50,false).travelled,undefined);assert.deepEqual(lookup(150).travelled.slice(0,2),[[0,0],[0,1]]);
 const full=createDistanceRoute(journeyRoadRoute,journeyRoadDistanceKm);
 for(let km=0;km<journeyRoadDistanceKm;km+=7){const p=full(km,false).point;assert(p.every(Number.isFinite));}
});
