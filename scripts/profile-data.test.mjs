import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app = readFileSync(new URL('../public/assets/app.js', import.meta.url), 'utf8');
function functionSource(name) {
  const start = app.indexOf(`function ${name}(`);
  const next = app.indexOf('\nfunction ', start + 1);
  return app.slice(start, next);
}
const durationFunctions = ['completedLaps','lapTimeSeconds','runTimeSeconds','isCompleteConsistencyRun'].map(functionSource).join('\n');
test('default tracker retains every recent racer and excludes older attendance without sampling', () => {
 const context=vm.createContext({}); vm.runInContext(functionSource('recentJourneyDrivers'),context);
 const keys=context.recentJourneyDrivers([{driverKey:'OLD',lastDate:'2024-09-28'},{driverKey:'BOUNDARY',lastDate:'2024-09-29'},{driverKey:'NEW',lastDate:'2026-09-20'}],new Date('2026-09-29T12:00:00Z'));
 assert.deepEqual([...keys],['BOUNDARY','NEW']);
});
test('minute-formatted lap times retain their full seconds', () => {
  const context = vm.createContext({});
  vm.runInContext(durationFunctions, context);
  assert.ok(Math.abs(context.lapTimeSeconds('1:42.341') - 102.341) < 0.000001);
  assert.equal(context.lapTimeSeconds('16.205 (lap 11)'), 16.205);
  assert.ok(Number.isNaN(context.lapTimeSeconds('')));
});
test('consistency excludes early retirements, short runs and unknown durations', () => {
  const context = vm.createContext({});
  vm.runInContext(durationFunctions, context);
  const data = {raceById:{r:{l:300}}};
  const run = time => ['r','DRIVER',1,time];
  assert.equal(context.isCompleteConsistencyRun(run('18/5:04.090'), data), true);
  assert.equal(context.isCompleteConsistencyRun(run('17/4:59.999'), data), false);
  assert.equal(context.isCompleteConsistencyRun(run('4/5:04.090'), data), false);
  assert.equal(context.isCompleteConsistencyRun(run('18/5:04.090'), {raceById:{r:{}}}), false);
});
test('driver class and consistency breakdowns include qualifying-only activity', () => {
  const nodes = {};
  const data = {drivers:[{k:'TEST',n:'Test Racer'}],events:[{i:'e',d:'2026-09-20',t:'club'}],eventById:{e:{t:'club'}},entries:[['e','2026-09-20','Trucks','TEST']],eventResults:[],raceById:{r:{e:'e',d:'2026-09-20',c:'Trucks',l:300}},raceResults:[['r','TEST',1,'18/5:04.090','','16.000','16.894','96.2%']],videos:[]};
  const context = vm.createContext({state:{data},$:id=>nodes[id] ||= {open:true},filters:()=>({from:'',to:'',eventType:'',className:''}),renderProfileAvatar(){},sharedRaceVideo:()=>null,profileStat:()=>'',distanceJourneyStat:()=>'',classLabels:{},dateFmt:new Intl.DateTimeFormat('en-GB'),fmt:new Intl.NumberFormat('en-GB'),kmToMiles:n=>n,escapeHtml:String});
  vm.runInContext(['inRange','isPublishedFinal','eventMatches','classMatches','attendanceAdjustedResults','countAndRate','average','completedLaps','lapTimeSeconds','runTimeSeconds','isCompleteConsistencyRun','totalLaps','distanceRaced','trackTime','driverProfile'].map(functionSource).join('\n'),context);
  context.driverProfile('TEST');
  assert.match(nodes.driverClassDetails.innerHTML, /Trucks/);
  assert.doesNotMatch(nodes.driverClassDetails.innerHTML, /Infinity|NaN/);
  assert.match(nodes.driverConsistencyDetails.innerHTML, /96\.2%/);
});

test('every archived driver profile renders without broken numbers or missing consistency', () => {
  const data = JSON.parse(readFileSync(new URL('../public/data/dashboard.json',import.meta.url),'utf8'));
  data.eventById = Object.fromEntries(data.events.map(e=>[e.i,e]));
  data.videos = [];
  const nodes = {};
  const context = vm.createContext({state:{data},$:id=>nodes[id] ||= {open:true},filters:()=>({from:'',to:'',eventType:'',className:''}),renderProfileAvatar(){},sharedRaceVideo:()=>null,profileStat:(value)=>String(value),distanceJourneyStat:()=>'',classLabels:{},dateFmt:new Intl.DateTimeFormat('en-GB'),fmt:new Intl.NumberFormat('en-GB'),kmToMiles:n=>n,escapeHtml:String});
  vm.runInContext(['inRange','isPublishedFinal','eventMatches','classMatches','attendanceAdjustedResults','countAndRate','average','completedLaps','lapTimeSeconds','runTimeSeconds','isCompleteConsistencyRun','totalLaps','distanceRaced','trackTime','driverProfile'].map(functionSource).join('\n'),context);
  for (const driver of data.drivers) {
    context.driverProfile(driver.k);
    for (const id of ['driverProfileStats','driverClassDetails','driverConsistencyDetails','driverEventDetails']) {
      assert.doesNotMatch(nodes[id].innerHTML, /NaN|Infinity|undefined/, `${driver.k}: ${id}`);
    }
    const eligible = data.raceResults.some(r=>r[1]===driver.k && context.isCompleteConsistencyRun(r,data) && Number.isFinite(parseFloat(r[7])));
    if (eligible) assert.doesNotMatch(nodes.driverConsistencyDetails.innerHTML, /No consistency data/, driver.k);
  }
});
