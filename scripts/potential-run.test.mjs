import test from 'node:test';
import assert from 'node:assert/strict';
import {potentialRun} from '../public/assets/potential-run.js';
const driver=times=>({laps:times.map((seconds,i)=>({lap:i+1,seconds}))});
test('uses opening crossing plus seven fastest complete laps and ignores slower laps',()=>{
  assert.equal(potentialRun(driver([1,17,17,17,17,17,17,17,40,80]),300),'19/5:07.000');
});
test('does not invent a run from insufficient laps, missing opening lap or unknown duration',()=>{
  assert.equal(potentialRun(driver([1,17,17,17,17,17,17]),300),'—');
  assert.equal(potentialRun({laps:Array(7).fill(0).map((_,i)=>({lap:i+2,seconds:17}))},300),'—');
  assert.equal(potentialRun(driver([1,17,17,17,17,17,17,17]),NaN),'—');
});
test('exact duration and millisecond rollover format correctly',()=>{
  assert.equal(potentialRun(driver([20,...Array(7).fill(20)]),300),'15/5:00.000');
  assert.equal(potentialRun(driver([1,...Array(7).fill(19.99999)]),299),'16/5:01.000');
});
