import test from 'node:test';
import assert from 'node:assert/strict';
import {transponderHistory,usePreviousTransponders} from './lib/transponder-history.mjs';
test('past same-class history replaces invalid answers and preserves valid new numbers',()=>{
  const row={driverName:'TEST DRIVER',className:'2-Wheel Drive Buggy'};
  const history=transponderHistory([{...row,transponder:'2142002',eventDate:'2025-01-01'},
    {...row,transponder:'1234567',eventDate:'2025-02-01'},
    {...row,transponder:'5032515',eventDate:'2099-01-01'}],'2026-10-02');
  assert.equal(history.length,1);
  for(const number of ['', 'Same', '1234567', '123456', '１２３４５６７'])
    assert.equal(usePreviousTransponders([{...row,transponder:number}],history)[0].transponder,'2142002');
  assert.equal(usePreviousTransponders([{...row,transponder:'7654321'}],history)[0].transponder,'7654321');
  assert.equal(usePreviousTransponders([{...row,className:'4-Wheel Drive Buggy',transponder:''}],history)[0].transponder,'');
});
