import test from 'node:test';
import assert from 'node:assert/strict';
import {bookingSlug,formMapping,publicDriverName,publicEntry,londonDate,entrySnapshot,sync,assertRosterContinuity,publicEntries,entriesFromOrders} from './sync-wix-event-entries.mjs';

test('unchanged entries do not require publishing just because the check time changed',()=>{
  const data={eventDate:'2026-10-11',entries:[{driverName:'TEST DRIVER',className:'Trucks'}]};
  assert.equal(entrySnapshot({...data,updatedAt:'old'}),entrySnapshot({...data,updatedAt:'new'}));
  assert.notEqual(entrySnapshot(data),entrySnapshot({...data,entries:[]}));
  assert.notEqual(entrySnapshot(data),entrySnapshot({...data,eventDate:'2026-10-18'}));
});
test('missing credentials fail instead of silently reporting success',async()=>{
  await assert.rejects(sync({}),/credentials are missing/);
});

test('Wix booking page slug and exact transponder form mapping',()=>{
  assert.equal(bookingSlug('https://www.cobracardiff.co.uk/event-details-1/cobra-sword-round-1'),'cobra-sword-round-1');
  assert.deepEqual(formMapping({form:{controls:[{inputs:[{label:'2WD Transponder Number',name:'field-2wd'},{label:'2WD Chassis',name:'chassis-2wd'}]}]}}),{'2WD Transponder Number':'field-2wd','2WD Chassis':'chassis-2wd'});
});
test('only an exact seven digit number can update the public entry',()=>{
  const guest={attendanceStatus:'ATTENDING',ticketNumber:'T1',guestDetails:{firstName:'Test',lastName:'Driver',formResponse:{inputValues:[{inputName:'field-2wd',value:'2345678'},{inputName:'chassis-2wd',value:'R1 Wurks'}]}}};
  const order={status:'PAID',tickets:[{ticketNumber:'T1',name:'2WD Entry'}]};
  const entry=publicEntry(guest,order,{'2WD Transponder Number':'field-2wd','2WD Chassis':'chassis-2wd'});
  assert.equal(entry.transponder,'2345678');
  assert.equal(entry.chassis,'R1 Wurks');
  guest.guestDetails.formResponse.inputValues[0].value='ABC123';
  assert.equal(publicEntry(guest,order,{'2WD Transponder Number':'field-2wd'}).transponder,'');
});
test('automatic Wix event rolls at UK midnight',()=>{
  assert.equal(londonDate(new Date('2026-10-04T22:59:59Z')),'2026-10-04');
  assert.equal(londonDate(new Date('2026-10-04T23:00:00Z')),'2026-10-05');
});
test('duplicated Wix guest names are published once',()=>{
  assert.equal(publicDriverName('Nathan Notley','Nathan Notley'),'NATHAN NOTLEY');
  assert.equal(publicDriverName('Royston Stewart','Stewart'),'ROYSTON STEWART');
});

const attendingGuest={attendanceStatus:'ATTENDING',ticketNumber:'T1',guestDetails:{firstName:'Matthew',lastName:'Hodges'}};
const ticket={ticketNumber:'T1',name:'2WD Entry'};
test('paid and free entries remain valid while unpaid bookings stay excluded',()=>{
  for (const status of ['PAID','FREE']) assert.equal(publicEntry(attendingGuest,{status,tickets:[ticket]},{}).driverName,'MATTHEW HODGES');
  for (const status of ['PENDING','INITIATED','OFFLINE_PENDING']) assert.equal(publicEntry(attendingGuest,{status,tickets:[ticket]},{}),null);
});
test('same-event data loss is blocked before overwriting the published roster',()=>{
  const previous={wixEventId:'event',eventDate:'2026-10-11',entries:[{driverName:'Matthew Hodges',className:'2-Wheel Drive Buggy'},{driverName:'Matthew Hodges',className:'4-Wheel Drive Buggy'}]};
  assert.throws(()=>assertRosterContinuity(previous,{...previous,entries:previous.entries.slice(0,1)}),/would remove 1/);
  assert.throws(()=>assertRosterContinuity(previous,{...previous,entries:[]}),/would remove 2/);
  assert.doesNotThrow(()=>assertRosterContinuity(previous,{...previous,entries:previous.entries.map(row=>({...row,driverName:row.driverName.toUpperCase()}))}));
  assert.doesNotThrow(()=>assertRosterContinuity(previous,{...previous,entries:[...previous.entries,{driverName:'New Driver',className:'Trucks'}]}));
});
test('new-event rollover and an already-empty roster are valid',()=>{
  const previous={wixEventId:'old',eventDate:'2026-10-11',entries:[{driverName:'Old Driver',className:'Trucks'}]};
  assert.doesNotThrow(()=>assertRosterContinuity(previous,{wixEventId:'new',eventDate:'2026-10-18',entries:[]}));
  assert.doesNotThrow(()=>assertRosterContinuity({...previous,entries:[]},{...previous,entries:[]}));
});

test('a paid double-class ticket expands both selected classes and their own car details',()=>{
  const guest={...attendingGuest,guestDetails:{...attendingGuest.guestDetails,formResponse:{inputValues:[{inputName:'classes',value:'',values:['2WD','4WD']},{inputName:'2wd-number',value:'2345678'},{inputName:'4wd-number',value:'3456789'}]}}};
  const entries=publicEntries(guest,{status:'PAID',tickets:[{...ticket,name:'Adult Double Class'}]},{'Classes to enter':'classes','2WD Transponder Number':'2wd-number','4WD Transponder Number':'4wd-number'});
  assert.deepEqual(entries.map(row=>[row.driverName,row.className,row.transponder]),[['MATTHEW HODGES','2-Wheel Drive Buggy','2345678'],['MATTHEW HODGES','4-Wheel Drive Buggy','3456789']]);
});
test('paid admin orders are read from tickets even when missing from the guest query',()=>{
  const orders=[{status:'PAID',tickets:[{...ticket,guestDetails:attendingGuest.guestDetails}]},{status:'PENDING',tickets:[{...ticket,ticketNumber:'T2',guestDetails:{firstName:'Martin',lastName:'Owen'}}]}];
  assert.deepEqual(entriesFromOrders(orders,[],{}).map(row=>row.driverName),['MATTHEW HODGES']);
});
test('double-class selections can come from the matching buyer checkout form',()=>{
  const order={status:'PAID',firstName:'Matthew',lastName:'Hodges',checkoutForm:{inputValues:[{inputName:'classes',values:['2WD','Vintage']}]},tickets:[{...ticket,name:'Adult Double Class'}]};
  assert.deepEqual(publicEntries(attendingGuest,order,{'Classes to enter':'classes'}).map(row=>row.className),['2-Wheel Drive Buggy','Vintage']);
  assert.throws(()=>publicEntries(attendingGuest,{...order,firstName:'Another'}, {'Classes to enter':'classes'}),/incomplete or unrecognised/);
});
test('unrecognised paid ticket or missing class selection blocks partial publication',()=>{
  assert.throws(()=>publicEntries(attendingGuest,{status:'PAID',tickets:[{...ticket,name:'New Racing Ticket'}]},{}),/Unrecognised attending paid/);
  assert.throws(()=>publicEntries(attendingGuest,{status:'PAID',tickets:[{...ticket,name:'Adult Double Class'}]},{}),/incomplete or unrecognised/);
});
