import {test} from 'node:test';
import assert from 'node:assert/strict';
import {trackerDrivers} from '../public/assets/tracker-priority.js';
test('keeps all avatars including older drivers, keeps followed driver, reduces ordinary pins',()=>{
 const rows=Array.from({length:100},(_,i)=>({driverKey:`D${i}`,lastDate:'2026-09-01'}));
 rows.push({driverKey:'OLDER',lastDate:'2022-01-01'});
 const recent=new Set(rows.slice(0,100).map(d=>d.driverKey));
 const avatars=new Map([['OLDER',{}],['D99',{}]]);
 const result=trackerDrivers(rows,recent,avatars,'D98');
 assert.equal(result.length,3+Math.ceil(98*.95));
 for(const key of ['OLDER','D99','D98']) assert.ok(result.some(d=>d.driverKey===key));
 assert.equal(new Set(result.map(d=>d.driverKey)).size,result.length);
});
