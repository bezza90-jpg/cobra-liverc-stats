import test from 'node:test';
import assert from 'node:assert/strict';
import {juniorPublicName,publicAvatarReference,publicEntryData,publicEntryFeed} from './lib/public-entry-data.mjs';

test('public entry data omits private transponder fields',()=>{
  const source={driverName:'EXAMPLE DRIVER',className:'2-Wheel Drive Buggy',transponder:'2345678',transponderSource:'wix',chassis:'Example'};
  assert.deepEqual(publicEntryData(source),{driverName:'EXAMPLE DRIVER',className:'2-Wheel Drive Buggy',chassis:'Example'});
  assert.equal(source.transponder,'2345678');
});

test('junior public names use first name and surname initial only',()=>{
  assert.equal(juniorPublicName('Ben Evans'),'Ben E.');
  assert.equal(juniorPublicName('  Noah   McBride  '),'Noah M.');
  assert.equal(juniorPublicName('Cher'),'Cher');
});

test('junior public entries remove full-name identity fields',()=>{
  const source={driverKey:'BEN-EVANS',driverName:'Ben Evans',bookingName:'Benjamin Evans',className:'Junior Racers',countryCode:'GB',chassis:'Team Associated'};
  assert.deepEqual(publicEntryData(source),{driverName:'Ben E.',className:'Junior Racers',countryCode:'GB',chassis:'Team Associated',avatarRef:publicAvatarReference('BEN-EVANS')});
  assert.match(publicAvatarReference('BEN-EVANS'),/^[0-9a-f]{20}$/);
  assert.doesNotMatch(publicAvatarReference('BEN-EVANS'),/BEN|EVANS/i);
});

test('public entry feed preserves event metadata and sanitises every entry',()=>{
  const result=publicEntryFeed({eventDate:'2026-10-11',ticketLimits:{Example:12},entries:[{driverName:'ONE',transponder:'2345678'},{driverName:'TWO'}]});
  assert.equal(result.eventDate,'2026-10-11');
  assert.deepEqual(result.ticketLimits,{Example:12});
  assert.deepEqual(result.entries,[{driverName:'ONE'},{driverName:'TWO'}]);
});
