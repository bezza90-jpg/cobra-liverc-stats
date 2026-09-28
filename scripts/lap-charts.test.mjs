import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chartData,lapChartMarkup,positionChartMarkup,chartUrl,replayComparisonUrl} from '../public/assets/lap-charts.js';
const race=JSON.parse(readFileSync(new URL('../public/virtual-race-replay/races/7072625.json',import.meta.url)));
test('recorded laps and common scale preserve real race values',()=>{const d=chartData(race);assert.equal(d.drivers.length,9);assert.equal(d.lastLap,18);assert.ok(d.min<13.495&&d.max>25.604);const html=lapChartMarkup(race);assert.match(html,/13\.967/);assert.match(html,/MARK GIAQUINTO/);assert.equal((html.match(/class="lap-chart-row"/g)||[]).length,9);assert.match(html,/Share to Facebook/);});
test('missing and invalid laps do not become made-up connecting lines',()=>{const r={id:'1',drivers:[{name:'<unsafe>',laps:[{lap:1,seconds:10},{lap:2,seconds:null},{lap:3,seconds:12}]}]};const html=lapChartMarkup(r);assert.equal((html.match(/class="lap-chart-line"/g)||[]).length,2);assert.match(html,/&lt;unsafe&gt;/);assert.doesNotMatch(html,/NaN/);});
test('empty and single-lap data render without invalid coordinates',()=>{for(const r of [{drivers:[]},{drivers:[{name:'A',laps:[{lap:1,seconds:10,position:1}]}]}])assert.doesNotMatch(lapChartMarkup(r)+positionChartMarkup(r),/NaN|Infinity/);});
test('position and comparison graphs retain each racer and exact values',()=>{assert.match(positionChartMarkup(race),/position 2/);const html=positionChartMarkup({...race,drivers:race.drivers.slice(0,2)},true);assert.match(html,/Compare lap times/);assert.match(html,/Time \(seconds\)/);assert.match(html,/13\.967/);assert.doesNotMatch(html,/MATTHEW HODGES/);});
test('share pages have distinct stable race and driver addresses',()=>{assert.ok(chartUrl('7072625').endsWith('/7072625/'));assert.ok(chartUrl('7072625','MARK-GIAQUINTO').endsWith('/7072625/MARK-GIAQUINTO/'));});

test('replay comparison preserves the race and multiple selected drivers',()=>{const u=new URL(replayComparisonUrl('7072625',['MARK-GIAQUINTO','RUSSELL-THOMAS']));assert.ok(u.pathname.endsWith('/virtual-race-replay/'));assert.equal(u.searchParams.get('race'),'7072625');assert.deepEqual(u.searchParams.getAll('compare'),['MARK-GIAQUINTO','RUSSELL-THOMAS']);});
