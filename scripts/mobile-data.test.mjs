import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read = async name => JSON.parse(await readFile(new URL('../public/data/'+name,import.meta.url),'utf8'));
test('small gallery payloads preserve every driver and final podium',async()=>{
 const [all,directory,podium] = await Promise.all(['dashboard.json','driver-directory.json','podium-results.json'].map(read));
 assert.deepEqual(directory.drivers,all.drivers.map(({k,n})=>({k,n})));
 assert.deepEqual(podium.raceResults,all.raceResults.filter(row=>all.raceById[row[0]]?.f && Number(row[2])>=1 && Number(row[2])<=3));
 assert.deepEqual(podium.raceById,Object.fromEntries(Object.entries(all.raceById).filter(([,race])=>race.f)));
 assert.deepEqual(podium.events,all.events);
 assert.ok(JSON.stringify(directory).length < JSON.stringify(all).length/50);
 assert.ok(JSON.stringify(podium).length < JSON.stringify(all).length/5);
});
test('Wix routing updates plain links while preserving event and driver filters',async()=>{
 const source=(await readFile(new URL('../public/assets/external-links.js',import.meta.url),'utf8')).replace('import.meta.url',JSON.stringify('https://example.com/site/assets/external-links.js'));
 const route=new Function('window','document','location',source+';return prepareLink;')({self:{},top:{}},{querySelectorAll:()=>[],addEventListener(){}},{href:'https://example.com/site/',origin:'https://example.com'});
 const cases=[['sword/','https://www.cobracardiff.co.uk/sword-tables'],['podiums/','https://www.cobracardiff.co.uk/Podium-Gallery'],['schedule/?type=sword','https://www.cobracardiff.co.uk/sword-schedule'],['?tracker=1','https://www.cobracardiff.co.uk/driver-distance-tracker'],['podiums/?event=518551','https://example.com/site/podiums/?event=518551'],['?tracker=1&raceDrivers=TEST','https://example.com/site/?tracker=1&raceDrivers=TEST']];
 for(const [path,expected] of cases){const link={href:new URL(path,'https://example.com/site/').href,hasAttribute:()=>false,closest:()=>null};route(link);assert.equal(link.href,expected);}
});
