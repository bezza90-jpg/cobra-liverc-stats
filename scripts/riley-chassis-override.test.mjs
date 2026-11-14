import test from 'node:test';
import assert from 'node:assert/strict';
import {enrichNextEventEntries} from './update-event-calendar.mjs';
import {mergeOverrides} from './chassis-choice.mjs';

test('Riley Butler 2WD remains Schumacher without changing his other classes',()=>{
  const meeting={eventId:'123'};
  const rows=[
    {driverName:'RILEY BUTLER',className:'2-Wheel Drive Buggy',chassis:'XRay',chassisSource:'wix'},
    {driverName:'RILEY BUTLER',className:'4-Wheel Drive Buggy',chassis:'XRay',chassisSource:'wix'}
  ];
  const manual={drivers:{'RILEY-BUTLER':{classes:{
    '2-Wheel Drive Buggy':{chassis:'Schumacher',mode:'persistent',overridesWix:true}
  }}}};
  const published=enrichNextEventEntries(meeting,rows,{},mergeOverrides({},manual));
  assert.equal(published.entries.find(row=>row.className==='2-Wheel Drive Buggy').chassis,'Schumacher');
  assert.equal(published.entries.find(row=>row.className==='4-Wheel Drive Buggy').chassis,'XRay');
});
