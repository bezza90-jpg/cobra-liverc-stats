import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeCurrentWixEntries,applyConfirmedChassis} from '../public/assets/event-entry-merge.js';
import {mergeWixEntries,enrichNextEventEntries} from './update-event-calendar.mjs';
const meeting={date:'2026-10-11',eventId:'518555'};
const driver={driverName:'CHRISTOPHER BAKER',className:'2-Wheel Drive Buggy'};
const data={...meeting,entries:[{...driver,chassis:'Team Associated',transponder:'7654321'}]};
const feed=entries=>({eventDate:meeting.date,liveRcEventId:meeting.eventId,entries});

test('event Wix chassis wins while private numbers are omitted from public data',()=>{
  const booking={...driver,chassis:'R1 Wurks',transponder:'9194873'};
  const merged=mergeCurrentWixEntries(data,feed([booking]));
  const result=applyConfirmedChassis(merged,{...meeting,entries:[{...driver,chassis:'SWorkz'}]});
  assert.equal(result.entries[0].chassis,'R1 Wurks');
  assert.equal(Object.hasOwn(result.entries[0],'transponder'),false);
  assert.equal(data.entries[0].chassis,'Team Associated');
  const backend=mergeWixEntries(meeting,data.entries,feed([booking]));
  const enriched=enrichNextEventEntries(meeting,backend,{}, {drivers:{'CHRISTOPHER-BAKER':{classes:{[driver.className]:{chassis:'SWorkz'}}}}});
  assert.equal(enriched.entries[0].chassis,'R1 Wurks');
  assert.equal(Object.hasOwn(enriched.entries[0],'transponder'),false);
});

test('public merging never exposes Wix or LiveRC numbers',()=>{
  for(const transponder of ['', '1234567','123456','12345678','other']) {
    assert.equal(Object.hasOwn(mergeCurrentWixEntries(data,feed([{...driver,transponder}])).entries[0],'transponder'),false);
    assert.equal(mergeWixEntries(meeting,data.entries,feed([{...driver,transponder}]))[0].transponder,'7654321');
  }
  const historical={...driver,transponder:'2142002',transponderSource:'history'};
  assert.equal(Object.hasOwn(mergeCurrentWixEntries(data,feed([historical])).entries[0],'transponder'),false);
  assert.equal(mergeWixEntries(meeting,data.entries,feed([historical]))[0].transponder,'7654321');
});

test('public merging ignores private history even when supplied',()=>{
  const row={driverName:'Paul Curtis',className:'Trucks',transponder:'1234567'};
  const history=[{...row,driverName:'BRUCE',transponder:'2142002',eventDate:'2026-09-01'},
    {...row,driverName:'BRUCE',transponder:'7654321',eventDate:'2026-10-04'},
    {...row,driverName:'BRUCE',transponder:'5555555',eventDate:'2026-10-12'},
    {...row,className:'Vintage',transponder:'6666666',eventDate:'2026-10-04'}];
  const result=mergeCurrentWixEntries({...meeting,entries:[]},feed([row]),history);
  assert.equal(Object.hasOwn(result.entries[0],'transponder'),false);
  assert.equal(Object.hasOwn(mergeCurrentWixEntries({...meeting,entries:[]},feed([{...row,driverName:'NEW DRIVER'}]),history).entries[0],'transponder'),false);
});

test('conflicting event identifiers never apply Wix details',()=>{
  assert.deepEqual(mergeWixEntries(meeting,data.entries,{...feed([{...driver,chassis:'XRay'}]),liveRcEventId:'old'}),data.entries);
});
