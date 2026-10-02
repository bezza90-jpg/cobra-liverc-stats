import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeCurrentWixEntries} from '../public/assets/event-entry-merge.js';
import {eventSpaces} from '../public/assets/event-capacity.js';
const meeting={eventId:'518554',date:'2026-10-04',type:'sword'};
test('junior-price bookings cannot re-add senior drivers to the junior heat',()=>{
 const juniors=['MARCIA DAVIS','BEN EVANS','SEB FISHER','NOAH MCBRIDE','LEO SMITH'];
 const seniors=['HARRY DAVIS','NATHAN NOTLEY','HAIDEN HICKS'];
 const entries=[...juniors.map(driverName=>({driverName,className:'Junior Racers'})),...seniors.map(driverName=>({driverName,className:'2-Wheel Drive Buggy'}))];
 const result=mergeCurrentWixEntries({...meeting,entries},{eventDate:meeting.date,liveRcEventId:meeting.eventId,entries:[...juniors,...seniors].map(driverName=>({driverName,className:'Junior Racers'}))});
 assert.deepEqual(result.entries.filter(e=>e.className==='Junior Racers').map(e=>e.driverName),juniors);
 assert.equal(result.entries.filter(e=>e.className==='2-Wheel Drive Buggy').length,3);
 const space=eventSpaces(result,meeting,{types:{sword:{'Junior Racers':12}}})[0];
 assert.equal(space.entered,5); assert.equal(space.remaining,7);
});
test('new junior remains visible and a fresh senior assignment replaces their old junior row',()=>{
 const result=mergeCurrentWixEntries({...meeting,entries:[{driverName:'NATHAN NOTLEY NATHAN NOTLEY',className:'Junior Racers'}]}, {eventDate:meeting.date,entries:[{driverName:'NATHAN NOTLEY',className:'4-Wheel Drive Buggy'},{driverName:'NEW JUNIOR',className:'Junior Racers'}]});
 assert.deepEqual(result.entries.map(e=>e.driverName),['NATHAN NOTLEY','NEW JUNIOR']);
 assert.equal(result.entries[0].className,'4-Wheel Drive Buggy');
});
test('a booking feed from another event cannot change the current race classes',()=>{
 const data={...meeting,entries:[]};
 assert.equal(mergeCurrentWixEntries(data,{eventDate:meeting.date,liveRcEventId:'other',entries:[{driverName:'NEW JUNIOR',className:'Junior Racers'}]}),data);
});
