import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeCurrentWixEntries,applyConfirmedChassis} from '../public/assets/event-entry-merge.js';
import {mergeWixEntries,enrichNextEventEntries} from './update-event-calendar.mjs';
const meeting={date:'2026-10-11',eventId:'518555'};
const driver={driverName:'CHRISTOPHER BAKER',className:'2-Wheel Drive Buggy'};
const data={...meeting,entries:[{...driver,chassis:'Team Associated',transponder:'7654321'}]};
const feed=entries=>({eventDate:meeting.date,liveRcEventId:meeting.eventId,entries});

test('event Wix chassis and valid number win over LiveRC and confirmed chassis',()=>{
  const booking={...driver,chassis:'R1 Wurks',transponder:'9194873'};
  const merged=mergeCurrentWixEntries(data,feed([booking]));
  const result=applyConfirmedChassis(merged,{...meeting,entries:[{...driver,chassis:'SWorkz'}]});
  assert.equal(result.entries[0].chassis,'R1 Wurks');
  assert.equal(result.entries[0].transponder,'9194873');
  assert.equal(data.entries[0].chassis,'Team Associated');
  const backend=mergeWixEntries(meeting,data.entries,feed([booking]));
  const enriched=enrichNextEventEntries(meeting,backend,{}, {drivers:{'CHRISTOPHER-BAKER':{classes:{[driver.className]:{chassis:'SWorkz'}}}}});
  assert.equal(enriched.entries[0].chassis,'R1 Wurks');
});

test('invalid Wix values retain valid current LiveRC number; history cannot replace it',()=>{
  for(const transponder of ['', '1234567','123456','12345678','other']) {
    assert.equal(mergeCurrentWixEntries(data,feed([{...driver,transponder}])).entries[0].transponder,'7654321');
    assert.equal(mergeWixEntries(meeting,data.entries,feed([{...driver,transponder}]))[0].transponder,'7654321');
  }
  const historical={...driver,transponder:'2142002',transponderSource:'history'};
  assert.equal(mergeCurrentWixEntries(data,feed([historical])).entries[0].transponder,'7654321');
  assert.equal(mergeWixEntries(meeting,data.entries,feed([historical]))[0].transponder,'7654321');
});

test('missing numbers use latest valid past number in the same class, including aliases',()=>{
  const row={driverName:'Paul Curtis',className:'Trucks',transponder:'1234567'};
  const history=[{...row,driverName:'BRUCE',transponder:'2142002',eventDate:'2026-09-01'},
    {...row,driverName:'BRUCE',transponder:'7654321',eventDate:'2026-10-04'},
    {...row,driverName:'BRUCE',transponder:'5555555',eventDate:'2026-10-12'},
    {...row,className:'Vintage',transponder:'6666666',eventDate:'2026-10-04'}];
  const result=mergeCurrentWixEntries({...meeting,entries:[]},feed([row]),history);
  assert.equal(result.entries[0].transponder,'7654321');
  assert.equal(mergeCurrentWixEntries({...meeting,entries:[]},feed([{...row,driverName:'NEW DRIVER'}]),history).entries[0].transponder,'');
});

test('conflicting event identifiers never apply Wix details',()=>{
  assert.deepEqual(mergeWixEntries(meeting,data.entries,{...feed([{...driver,chassis:'XRay'}]),liveRcEventId:'old'}),data.entries);
});
