import test from 'node:test';
import assert from 'node:assert/strict';
import {publicEntryData,publicEntryFeed} from './lib/public-entry-data.mjs';

test('public entry data omits private transponder fields',()=>{
  const source={driverName:'EXAMPLE DRIVER',className:'2-Wheel Drive Buggy',transponder:'2345678',transponderSource:'wix',chassis:'Example'};
  assert.deepEqual(publicEntryData(source),{driverName:'EXAMPLE DRIVER',className:'2-Wheel Drive Buggy',chassis:'Example'});
  assert.equal(source.transponder,'2345678');
});

test('public entry feed preserves event metadata and sanitises every entry',()=>{
  const result=publicEntryFeed({eventDate:'2026-10-11',ticketLimits:{Example:12},entries:[{driverName:'ONE',transponder:'2345678'},{driverName:'TWO'}]});
  assert.equal(result.eventDate,'2026-10-11');
  assert.deepEqual(result.ticketLimits,{Example:12});
  assert.deepEqual(result.entries,[{driverName:'ONE'},{driverName:'TWO'}]);
});
