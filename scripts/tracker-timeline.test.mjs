import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../public/assets/app.js',import.meta.url),'utf8');
const timeline=source.slice(source.indexOf('function buildJourneyTimeline('),source.indexOf('\nfunction journeyCutoffDate()'));
test('tracker skips empty rounds and idle starts, retaining recorded endpoints for followed drivers',()=>{
 const slot=(date)=>({start:Date.parse(date+'T09:00:00Z'),end:Date.parse(date+'T18:00:00Z'),name:'Final'});
 const slots=new Map([['empty',slot('2022-01-01')],['first',slot('2022-02-01')],['other',slot('2022-03-01')],['last',slot('2022-06-01')]]);
 const context=vm.createContext({state:{data:{raceResults:[['empty','A',0,'0/0'],['first','A',0,'10/300'],['other','B',0,'12/300'],['last','A',0,'20/300']]}},journeyRoundSlots:slots,journeyExcludedDrivers:new Set(),completedLaps:r=>parseInt(r[3]),keys:new Set(['A'])});
 const all=JSON.parse(vm.runInContext(timeline+";JSON.stringify(buildJourneyTimeline('2022-07-01'))",context));
 const followed=JSON.parse(vm.runInContext("JSON.stringify(buildJourneyTimeline('2022-07-01',keys))",context));
 assert.equal(all.length,4);assert.equal(followed.length,3);
 assert.deepEqual(followed.map(f=>f.time),[slots.get('first').start,slots.get('first').end,slots.get('last').end]);
 assert.equal(all.at(-1).time,slots.get('last').end);
});

test('simultaneous class runs interpolate together and preserve their combined endpoint mileage',()=>{
 const smooth=source.slice(source.indexOf('function journeyDriverDistancesSmoothed('),source.indexOf('\nfunction stopJourneyPlayback()'));
 const rows=[{start:0,time:10,total:1,race:{e:'event',c:'2WD',d:'2022-01-01'}},{start:0,time:10,total:3,race:{e:'event',c:'4WD',d:'2022-01-01'}},{start:10,time:20,total:8,race:{e:'event',c:'2WD',d:'2022-01-02'}}];
 const context=vm.createContext({journeySmoothTracks:new Map([['A',rows]]),state:{data:{driverByKey:{A:'Driver A'},eventById:{}}}});
 vm.runInContext(smooth,context);
 for(const [time,expected] of [[5,1.5],[10,3],[15,5.5],[20,8]]) assert.equal(vm.runInContext(`journeyDriverDistancesSmoothed(${time})[0].km`,context),expected);
});
