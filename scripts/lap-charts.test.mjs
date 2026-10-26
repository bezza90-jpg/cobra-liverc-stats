import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chartData,focusedLapScale,fullLapScale,lapChartMarkup,lapLineColour,positionChartMarkup,chartUrl,chartShareUrl,replayComparisonUrl} from '../public/assets/lap-charts.js';
import {canUseNativeShare,facebookComposerUrl,nativeSharePayload} from '../public/assets/mobile-share.js';
const race=JSON.parse(readFileSync(new URL('../public/virtual-race-replay/races/7072625.json',import.meta.url)));
test('recorded laps and common scale preserve real race values',()=>{const d=chartData(race);assert.equal(d.drivers.length,9);assert.equal(d.lastLap,18);assert.ok(d.min<13.495&&d.max>25.604);const html=lapChartMarkup(race);assert.match(html,/13\.967/);assert.match(html,/MARK GIAQUINTO/);assert.equal((html.match(/class="lap-chart-row"/g)||[]).length,9);assert.match(html,/Share this result/);assert.match(html,/data-native-share-url=/);});

test('phone share buttons use the native composer while desktop retains Facebook fallback',()=>{
 const url='https://racehub.cobracardiff.co.uk/lap-charts/share/7072625/';
 assert.equal(facebookComposerUrl(url),'https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(url));
 assert.equal(canUseNativeShare({share(){},maxTouchPoints:1},{matchMedia:()=>({matches:false})}),true);
 assert.equal(canUseNativeShare({share(){},maxTouchPoints:0},{matchMedia:()=>({matches:false})}),false);
 assert.equal(canUseNativeShare({maxTouchPoints:1},{matchMedia:()=>({matches:true})}),false);
 assert.deepEqual(nativeSharePayload(url),{title:'COBRA RaceHub',text:'COBRA RaceHub race result',url});
});
test('embedded individual charts keep the complete heat scale',()=>{const first={...race,drivers:[race.drivers[0]]},second={...race,drivers:[race.drivers[1]]},heatScale=focusedLapScale({laps:race.drivers.flatMap(d=>d.laps)}),firstScale=focusedLapScale(race.drivers[0]),firstHtml=lapChartMarkup(first,race),secondHtml=lapChartMarkup(second,race);assert.notDeepEqual([firstScale.min,firstScale.max],[heatScale.min,heatScale.max]);for(const value of [heatScale.min,heatScale.max]){assert.match(firstHtml,new RegExp('>'+value.toFixed(1)+'<'));assert.match(secondHtml,new RegExp('>'+value.toFixed(1)+'<'));}assert.match(firstHtml,/Every driver chart in this heat uses the same focused scale/);});
test('opened driver chart fits every racing lap including the slowest',()=>{const driver={key:'ROGER-MILLS',name:'ROGER MILLS',laps:[{lap:1,seconds:9},{lap:2,seconds:18},{lap:3,seconds:18.2},{lap:4,seconds:31.5}]},scale=fullLapScale(driver),html=lapChartMarkup({id:'roger',name:'A Final',drivers:[driver]},{id:'roger',drivers:[driver]},{fitFullRange:true});assert.ok(scale.min<18);assert.ok(scale.max>31.5);assert.match(html,new RegExp('>'+scale.max.toFixed(1)+'<'));assert.match(html,/scaled to show the selected driver’s full recorded lap-time range/);assert.match(html,/data-chart-lap="4"[^>]*cy="(?!25(?:\.0)?")/);});
test('linked single-driver charts open their exact lap-time table',()=>{const selected={...race,drivers:[race.drivers[0]]};assert.match(lapChartMarkup(selected,race,{showExactLaps:true}),/<details class="lap-chart-values" open>/);assert.doesNotMatch(lapChartMarkup(selected,race),/<details class="lap-chart-values" open>/);});
test('individual lap charts force the complete SVG to fit narrow in-app browsers',()=>{const driver=race.drivers.find(item=>item.laps.some(lap=>lap.lap===18)),selected={...race,drivers:[driver]},html=lapChartMarkup(selected,race,{fitFullRange:true}),css=readFileSync(new URL('../public/assets/lap-charts.css',import.meta.url),'utf8');assert.match(html,/<svg class="lap-chart-svg"[^>]*preserveAspectRatio="xMidYMid meet"[^>]*style="display:block;width:100%;min-width:0;max-width:100%;height:auto"/);assert.match(css,/\.lap-chart-scroll>\.lap-chart-svg\{[^}]*width:100%!important;min-width:0!important;max-width:100%!important/);assert.match(html,/data-chart-lap="18"/);});
test('exact lap tables colour the text without filling highlighted rows',()=>{const css=readFileSync(new URL('../public/assets/lap-charts.css',import.meta.url),'utf8');for(const className of ['lap-fastest','lap-near-fastest','lap-slow'])assert.match(css,new RegExp(`\\.lap-chart-values tr\\.${className}>\\*\\{background:transparent;color:`));});
test('missing and invalid laps do not become made-up connecting lines',()=>{const r={id:'1',drivers:[{name:'<unsafe>',laps:[{lap:1,seconds:10},{lap:2,seconds:null},{lap:3,seconds:12}]}]};const html=lapChartMarkup(r);assert.equal((html.match(/class="lap-chart-line"/g)||[]).length,0);assert.match(html,/&lt;unsafe&gt;/);assert.doesNotMatch(html,/NaN/);});
test('empty and single-lap data render without invalid coordinates',()=>{for(const r of [{drivers:[]},{drivers:[{name:'A',laps:[{lap:1,seconds:10,position:1}]}]}])assert.doesNotMatch(lapChartMarkup(r)+positionChartMarkup(r),/NaN|Infinity/);});
test('position and comparison graphs retain each racer and exact values',()=>{assert.match(positionChartMarkup(race),/position 2/);const html=positionChartMarkup({...race,drivers:race.drivers.slice(0,2)},true);assert.match(html,/Compare lap times/);assert.match(html,/Time \(seconds\)/);assert.match(html,/13\.967/);assert.doesNotMatch(html,/MATTHEW HODGES/);});
test('position graph begins at lap zero using the supplied start grid',()=>{const html=positionChartMarkup({id:'grid',drivers:[{name:'Grid driver',startPosition:3,laps:[{lap:1,position:1,seconds:20},{lap:2,position:2,seconds:20}]}]});assert.match(html,/Lap 0 shows the qualifying or recorded start position/);assert.match(html,/Grid driver · Start · P3/);assert.match(html,/>0<\/text>/);assert.match(html,/<td>Start<\/td><td>3<\/td>/);});
test('chart links use the interactive view while shares use preview-card pages',()=>{const raceUrl=new URL(chartUrl('7072625'));assert.ok(raceUrl.pathname.endsWith('/lap-charts/'));assert.equal(raceUrl.searchParams.get('race'),'7072625');const driverUrl=new URL(chartUrl('7072625','MARK-GIAQUINTO'));assert.equal(driverUrl.searchParams.get('race'),'7072625');assert.equal(driverUrl.searchParams.get('driver'),'MARK-GIAQUINTO');assert.match(chartShareUrl('7072625'),/\/lap-charts\/share\/7072625\/$/);assert.match(chartShareUrl('7072625','MARK-GIAQUINTO'),/\/lap-charts\/share\/7072625\/MARK-GIAQUINTO\/$/);});

test('every Facebook chart link targets a page with preview metadata',()=>{
 const source=readFileSync(new URL('../public/assets/lap-charts.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/facebookComposerUrl\(url\.href\)/);
 assert.match(source,/facebookComposerUrl\(shareUrl\)/);
});

test('driver Facebook previews use the same green-to-red lap colours as the interactive chart',()=>{
 const source=readFileSync(new URL('./build-chart-shares.mjs',import.meta.url),'utf8');
 assert.match(source,/focusedLapScale, lapLineColour/);
 assert.match(source,/createLinearGradient\(x\(previous\.lap\),y\(previous\.seconds\),x\(lap\.lap\),y\(lap\.seconds\)\)/);
 assert.match(source,/gradient\.addColorStop\(0,lapLineColour\(previous\.seconds,best\)\)/);
 assert.match(source,/gradient\.addColorStop\(1,lapLineColour\(lap\.seconds,best\)\)/);
});

test('replay comparison preserves the race and multiple selected drivers',()=>{const u=new URL(replayComparisonUrl('7072625',['MARK-GIAQUINTO','RUSSELL-THOMAS']));assert.ok(u.pathname.endsWith('/virtual-race-replay/'));assert.equal(u.searchParams.get('race'),'7072625');assert.deepEqual(u.searchParams.getAll('compare'),['MARK-GIAQUINTO','RUSSELL-THOMAS']);});

test('focused final-lap scale ignores lap one and trims isolated outliers',()=>{const scale=focusedLapScale({laps:[{lap:1,seconds:7},...Array.from({length:16},(_,i)=>({lap:i+2,seconds:17+(i%4)*.08})),{lap:18,seconds:30}]});assert.ok(scale.min>16);assert.ok(scale.max<20);assert.equal(scale.plottedLaps[0].lap,2);});
test('driver charts show lap one separately without using it for scale',()=>{const html=lapChartMarkup({name:'Scale test',drivers:[{name:'Driver',laps:[{lap:1,seconds:7},{lap:2,seconds:17},{lap:3,seconds:17.2}]}]});assert.match(html,/Lap 1 is shown as a separate/);assert.match(html,/aria-label="Lap 1: 7\.000 seconds"/);assert.match(html,/<th scope="row">1<\/th><td>7\.000<\/td>/);assert.match(html,/data-chart-lap="1" data-chart-time="7\.000"/);assert.match(html,/class="lap-point-readout" aria-live="polite"/);});
test('lap lines blend from bright green to red using the same thresholds as the markers',()=>{assert.equal(lapLineColour(17.3,17),'#1fe05b');assert.equal(lapLineColour(18.5,17),'#e32636');assert.match(lapLineColour(17.9,17),/^hsl\(/);const html=lapChartMarkup({id:'gradient',name:'Gradient',drivers:[{key:'D',name:'Driver',laps:[{lap:2,seconds:17},{lap:3,seconds:17.2},{lap:4,seconds:18.6}]}]});assert.match(html,/<linearGradient/);assert.match(html,/style="stroke:url\(#lap-gradient-D-/);});

test('full driver chart connects lap one to lap two while keeping its timing scale',()=>{
 const driver={key:'TEST',name:'Test',laps:[{lap:1,seconds:8},{lap:2,seconds:17},{lap:3,seconds:17.2}]};
 const race={id:'123',name:'Qualifier',drivers:[driver]};
 const full=lapChartMarkup(race,race,{fitFullRange:true});
 const compact=lapChartMarkup(race);
 assert.match(full,/Lap 1 is connected to Lap 2/);
 assert.equal((full.match(/class="lap-chart-line"/g)||[]).length,2);
 assert.equal((compact.match(/class="lap-chart-line"/g)||[]).length,1);
 assert.ok(fullLapScale(driver).min>16);
});

test('non-final rounds include lap one in chart scales and line segments',()=>{
 const driver={key:'QUAL',name:'Qualifier',laps:[{lap:1,seconds:24},{lap:2,seconds:18},{lap:3,seconds:18.2}]};
 const race={id:'qual',name:'Qualifier',isFinal:false,drivers:[driver]};
 const html=lapChartMarkup(race,race,{fitFullRange:true});
 assert.match(html,/Lap 1 is a full timed lap/);
 assert.equal((html.match(/class="lap-chart-line"/g)||[]).length,2);
 assert.ok(fullLapScale(driver,true).max>24);
 const finalHtml=lapChartMarkup({...race,isFinal:true},{...race,isFinal:true},{fitFullRange:true});
 assert.match(finalHtml,/opening crossing does not set the time scale/);
 assert.ok(fullLapScale(driver,false).max<24);
});
