import test from 'node:test';
import assert from 'node:assert/strict';
import {safeTicketLimits,ticketReadiness} from './check-wix-ticket-readiness.mjs';

const meeting={title:'SWORD Round 2',type:'sword',eventId:'518556'};
const capacities={
  types:{sword:{'Junior Racers':12,'4-Wheel Drive Buggy':30,'2-Wheel Drive Buggy':80}},
  reservedByType:{sword:{'2-Wheel Drive Buggy':['A','B','C','D'],'4-Wheel Drive Buggy':['A','B','C','D','E']}}
};
const definitions=[
  {name:'Junior Entry',actualLimit:12,salePeriod:{startDate:'2026-10-19T17:00:00Z'}},
  {name:'2WD SWORD Entry',actualLimit:76,salePeriod:{startDate:'2026-10-19T17:00:00Z'}},
  {name:'4WD SWORD Entry',actualLimit:25,salePeriod:{startDate:'2026-10-19T17:00:00Z'}}
];

test('safe public ticket ceilings keep configured club reservations available',()=>{
  assert.deepEqual(safeTicketLimits(meeting,capacities),{
    'Junior Racers':12,'4-Wheel Drive Buggy':25,'2-Wheel Drive Buggy':76
  });
  assert.equal(ticketReadiness(definitions,meeting,capacities).length,3);
});

test('ticket readiness rejects an over-capacity ticket limit',()=>{
  const wrong=structuredClone(definitions);
  wrong[1].actualLimit=77;
  assert.throws(()=>ticketReadiness(wrong,meeting,capacities),/is 77; the safe maximum is 76/);
});

test('an event override can disable the standard reservations',()=>{
  const custom={...capacities,events:{518556:{reserved:{}}}};
  assert.equal(safeTicketLimits(meeting,custom)['2-Wheel Drive Buggy'],80);
});

test('a lower ticket quantity is safe and can preserve discretionary places',()=>{
  const lower=structuredClone(definitions);
  lower[1].actualLimit=64;
  assert.equal(ticketReadiness(lower,meeting,capacities)[1].limit,64);
});
