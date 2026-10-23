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
 const cases=[['sword/','https://www.cobracardiff.co.uk/sword-tables'],['podiums/','https://www.cobracardiff.co.uk/Podium-Gallery'],['track-gallery/','https://www.cobracardiff.co.uk/track-gallery'],['schedule/?type=sword','https://www.cobracardiff.co.uk/sword-schedule'],['?tracker=1','https://www.cobracardiff.co.uk/driver-distance-tracker'],['podiums/?event=518551','https://example.com/site/podiums/?event=518551'],['?tracker=1&raceDrivers=TEST','https://example.com/site/?tracker=1&raceDrivers=TEST']];
 for(const [path,expected] of cases){const link={href:new URL(path,'https://example.com/site/').href,hasAttribute:()=>false,classList:{contains:()=>false},closest:()=>null};route(link);assert.equal(link.href,expected);}
 const eventLink={href:'https://cobracardiff.liverc.com/results/?p=view_event&id=518554',target:'_top',hasAttribute:name=>name==='data-open-new-tab'};route(eventLink);assert.equal(eventLink.target,'_blank');assert.equal(eventLink.rel,'noopener');
 const share={href:'https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fexample.com',target:'_blank',hasAttribute:()=>false,classList:{contains:c=>c==='lap-chart-open'}};route(share);assert.equal(share.target,'_blank');
});
test('statistics drill-down tables use the phone card layout',async()=>{
 const [html,app,css,styles]=await Promise.all([
  readFile(new URL('../public/index.html',import.meta.url),'utf8'),
  readFile(new URL('../public/assets/app.js',import.meta.url),'utf8'),
  readFile(new URL('../public/assets/statistics-mobile.css',import.meta.url),'utf8'),
  readFile(new URL('../public/assets/styles.css',import.meta.url),'utf8')
 ]);
 assert.match(html,/class="[^"]*profile-events-table/);
 for(const className of ['profile-runs-table','run-laps-table','metric-rating-table','metric-events-table','metric-runs-table']) assert.match(app,new RegExp(`class="${className}"`));
 for(const className of ['leaderboard-event-results','profile-events-table','profile-runs-table','metric-rating-table','metric-events-table','metric-runs-table']) assert.ok(css.includes(`.${className}`),`${className} has a mobile layout`);
 assert.ok(!css.includes('.race-results-table'),'the main race results keep their compact table layout');
  assert.match(css,/#raceLapCharts \.lap-chart-scroll svg\{width:100%;min-width:0;height:auto\}/);
  assert.match(css,/#raceLapCharts \.lap-chart-row\{grid-template-columns:1fr/);
  assert.match(css,/\.race-results-wrap\{max-height:none;/);
  assert.match(css,/\.race-result-driver-detail \.run-detail-summary\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(css,/\.driver-run-detail \.run-detail-summary\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(css,/small\[data-mobile-label\]::after\{content:attr\(data-mobile-label\)/);
  assert.match(css,/\.run-laps-table\{font-size:\.72rem\}/);
  assert.match(css,/\.run-laps-table th:nth-child\(3\).*\{width:60%;text-align:right\}/);
  assert.match(css,/\.race-result-driver-detail \.run-detail-summary>span\{min-height:38px;padding:4px 2px/);
  assert.match(css,/:is\(\.run-summary-average-10,\.run-summary-average-15\)\{display:none\}/);
  assert.match(app,/race-result-driver-row/);
  assert.match(app,/race-result-driver-detail/);
  assert.match(app,/class="leaderboard-event-results"/);
  assert.match(app,/sourcePanel.*handleProfileDrilldownClick/);
  assert.match(styles,/\.race-results-wrap\{max-height:500px\}/);
  assert.match(styles,/\.race-results-table\{min-width:0;table-layout:auto;font-size:\.72rem\}/);
  assert.match(styles,/\.fastest-lap\{background:transparent!important;color:#7b2fa3!important;font-weight:900\}/);
  assert.match(styles,/\.driver-races-toggle\[aria-expanded="true"\]::after\{content:' ↓ shown below'/);
  assert.match(styles,/\.table-wrap\.drilldown-expanded \{ max-height:none !important; overflow-y:visible; \}/);
  assert.match(styles,/\.statistics-page \.table-wrap:has\(\[aria-expanded="true"\]\) \{ max-height:none !important; overflow-y:visible; \}/);
  assert.match(app,/syncDrilldownHeight\(container\)/);
  assert.match(app,/container\.closest\('\.table-wrap'\)/);
  assert.match(app,/lapPoint\.dataset\.lapTime/);
  assert.match(app,/data-mobile-label="Fastest"/);
  assert.match(html,/id="raceFacebookShare"/);
  assert.match(app,/facebookShareLink\(raceId, driverKey\)/);
  assert.match(styles,/\.facebook-share\{/);
  assert.match(styles,/\.leaderboard-source-panel details \.table-wrap \{ max-height:none;/);
  assert.match(styles,/\.leaderboard-source-collapse \{ position:sticky;/);
  assert.match(app,/data-collapse-leaderboard/);
  assert.match(app,/driverRow\.scrollIntoView\(\{ block: 'center' \}\)/);
 assert.match(css,/driver-races-detail-row[^}]*\[hidden\][^{]*\{display:none!important\}/);
 assert.match(css,/run-lap-list \.table-wrap\{max-height:none;overflow-x:hidden;overflow-y:visible\}/);
  assert.match(css,/\.driver-run-detail\{position:sticky;left:0;box-sizing:border-box;width:calc\(100vw - 40px\);max-width:calc\(100vw - 40px\)/);
  assert.match(css,/\.run-detail-chart\{position:relative;top:auto;box-sizing:border-box;width:100%;min-width:0;max-width:100%/);
});
