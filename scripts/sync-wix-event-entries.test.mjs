import test from 'node:test';
import assert from 'node:assert/strict';
import {bookingSlug,formMapping,publicEntry,londonDate} from './sync-wix-event-entries.mjs';

test('Wix booking page slug and exact transponder form mapping',()=>{
  assert.equal(bookingSlug('https://www.cobracardiff.co.uk/event-details-1/cobra-sword-round-1'),'cobra-sword-round-1');
  assert.deepEqual(formMapping({form:{controls:[{inputs:[{label:'2WD Transponder Number',name:'field-2wd'}]}]}}),{'2WD Transponder Number':'field-2wd'});
});
test('only an exact seven digit number can update the public entry',()=>{
  const guest={attendanceStatus:'ATTENDING',ticketNumber:'T1',guestDetails:{firstName:'Test',lastName:'Driver',formResponse:{inputValues:[{inputName:'field-2wd',value:'1234567'}]}}};
  const order={status:'PAID',tickets:[{ticketNumber:'T1',name:'2WD Entry'}]};
  assert.equal(publicEntry(guest,order,{'2WD Transponder Number':'field-2wd'}).transponder,'1234567');
  guest.guestDetails.formResponse.inputValues[0].value='ABC123';
  assert.equal(publicEntry(guest,order,{'2WD Transponder Number':'field-2wd'}).transponder,'');
});
test('automatic Wix event rolls at UK midnight',()=>{
  assert.equal(londonDate(new Date('2026-10-04T22:59:59Z')),'2026-10-04');
  assert.equal(londonDate(new Date('2026-10-04T23:00:00Z')),'2026-10-05');
});
