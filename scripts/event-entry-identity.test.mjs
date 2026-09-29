import {test} from 'node:test';
import assert from 'node:assert/strict';
import {entryIdentity} from '../public/assets/event-entry-identity.js';
test('Bruce uses the correct profile, preserving booking name and event details',()=>{
 const row={driverKey:'PAUL-CURTIS',driverName:'PAUL CURTIS',className:'4-Wheel Drive Buggy',transponder:'4950687'};
 const result=entryIdentity(row,{'PAUL-CURTIS':{driverKey:'BRUCE',profileName:'Bruce'}});
 assert.equal(result.driverKey,'BRUCE');assert.equal(result.driverName,'Bruce');
 assert.equal(result.bookingName,'PAUL CURTIS');assert.equal(result.transponder,'4950687');
 assert.equal(row.driverKey,'PAUL-CURTIS');
 const other={driverKey:'BRUCE-LEE',driverName:'BRUCE LEE'};
 assert.deepEqual(entryIdentity(other,{'PAUL-CURTIS':{driverKey:'BRUCE',profileName:'Bruce'}}),other);
});
