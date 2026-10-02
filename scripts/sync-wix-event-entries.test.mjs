import test from 'node:test';
import assert from 'node:assert/strict';
import {bookingSlug,formMapping,publicDriverName,publicEntry,londonDate} from './sync-wix-event-entries.mjs';

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
