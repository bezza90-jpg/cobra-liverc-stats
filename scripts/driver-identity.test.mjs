import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canonicalDriverKey,canonicalDriverName,mergeDriverRows} from '../public/assets/driver-identity.js';
test('only confirmed identities merge',()=>{
 for(const key of ['BRUCE','PAUL-CURTIS','PAUL-BRUCE-CURTIS']){assert.equal(canonicalDriverKey(key),'BRUCE');assert.equal(canonicalDriverName(key,key),'Bruce');}
 assert.equal(canonicalDriverKey('BRUCE-LEE'),'BRUCE-LEE');
});
test('merge retains different races and classes without double counting duplicate source identities',()=>{
 const rows=[{driverKey:'PAUL-CURTIS',driverName:'Paul Curtis',race:'1',laps:10},{driverKey:'BRUCE',driverName:'BRUCE',race:'1',laps:11},{driverKey:'PAUL-CURTIS',driverName:'Paul Curtis',race:'2',laps:15},{driverKey:'BRUCE-LEE',driverName:'Bruce Lee',race:'1',laps:8}];
 const result=mergeDriverRows(rows,r=>r.race+'|'+r.driverKey);
 assert.equal(result.length,3);assert.equal(result.filter(r=>r.driverKey==='BRUCE').reduce((n,r)=>n+r.laps,0),26);
 assert.equal(rows[0].driverKey,'PAUL-CURTIS');
});

test('Bob Gelstharp uses BobTech master without changing unrelated drivers',()=>{
 assert.equal(canonicalDriverKey('BOB-GELSTHARP'),'BOBTECH');
 assert.equal(canonicalDriverName('BOBTECH','BOBTECH'),'BobTech');
 assert.equal(canonicalDriverKey('BOB-OTHER'),'BOB-OTHER');
 const rows=[{driverKey:'BOB-GELSTHARP',race:1},{driverKey:'BOBTECH',race:2}];
 assert.equal(mergeDriverRows(rows,r=>r.race+'|'+r.driverKey).length,2);
});
