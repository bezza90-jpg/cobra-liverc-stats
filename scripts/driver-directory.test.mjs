import test from 'node:test';
import assert from 'node:assert/strict';
import {addCurrentEntrants} from './driver-directory.mjs';
test('entrants without race results become selectable; repeated classes remain one driver',()=>{
 const names=new Map([['OLD','Existing Driver']]);
 const entries=[{driverKey:'NEW',driverName:'New Driver'},{driverKey:'NEW',driverName:'New Driver',className:'4WD'},{driverKey:'OLD',driverName:'Alternate spelling'}];
 const before=JSON.stringify(entries);
 addCurrentEntrants(names,entries);
 assert.deepEqual([...names],[['OLD','Existing Driver'],['NEW','New Driver']]);
 assert.equal(JSON.stringify(entries),before);
});
test('known aliases are canonical and invalid identities are omitted',()=>{
 const names=new Map();
 addCurrentEntrants(names,[{driverKey:'PAUL-CURTIS',driverName:'Paul Curtis'},{driverKey:'BRUCE',driverName:'Bruce'},{driverKey:'../bad',driverName:'Invalid'},{driverKey:'EMPTY',driverName:''}]);
 assert.deepEqual([...names],[['BRUCE','Paul "Bruce" Curtis']]);
});
test('no entry file keeps the existing directory',()=>{const names=new Map([['OLD','Old']]);assert.deepEqual([...addCurrentEntrants(names)],[['OLD','Old']]);});
