import test from 'node:test';
import assert from 'node:assert/strict';
import {compareEntryNames} from '../public/assets/event-entry-order.js';
test('surname order, then first name; compound surnames remain intact', () => {
  const names=['William Fisher','Steve Curtis-Rich','Jamie Davies','Simon Fisher','Ainsley Evans'];
  const rows=names.map(driverName=>({driverName}));
  assert.deepEqual(rows.sort(compareEntryNames).map(r=>r.driverName),['Steve Curtis-Rich','Jamie Davies','Ainsley Evans','Simon Fisher','William Fisher']);
});
test('single names, spacing and case are supported', () => {
  assert(compareEntryNames({driverName:'  BRUCE  '},{driverName:'Jamie Davies'})<0);
  assert.equal(compareEntryNames({driverName:'jamie davies'},{driverName:'Jamie Davies'}),0);
});
