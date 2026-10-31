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

test('Twisted Bashers booking maps to Caeron Jenkins and retains the booking name',()=>{
 const row={driverKey:'TWISTED-BASHER-S',driverName:"TWISTED BASHER'S",className:'2-Wheel Drive Buggy'};
 const result=entryIdentity(row,{'TWISTED-BASHER-S':{driverKey:'CAERON-JENKINS',profileName:'Caeron Jenkins'}});
 assert.equal(result.driverKey,'CAERON-JENKINS');assert.equal(result.driverName,'Caeron Jenkins');
 assert.equal(result.bookingName,"TWISTED BASHER'S");
});
