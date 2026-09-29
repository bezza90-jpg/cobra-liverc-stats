import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {loadStatisticsData} from '../public/assets/statistics-data.js';

test('results become available while video catalogue is still pending', async () => {
  let resolveVideo;
  const waiting = new Promise(resolve => { resolveVideo = resolve; });
  const {data, videosReady} = await loadStatisticsData(url => url.includes('videos') ? waiting : Promise.resolve({ok:true,json:async()=>({events:[1]})}));
  assert.deepEqual(data.events,[1]);
  resolveVideo({ok:true,json:async()=>({videos:[{raceId:'1'}]})});
  assert.deepEqual(await videosReady,[{raceId:'1'}]);
});
test('video service failure does not stop statistics loading', async () => {
  const {data,videosReady} = await loadStatisticsData(url => url.includes('videos') ? Promise.reject(Error('offline')) : Promise.resolve({ok:true,json:async()=>({events:[1]})}));
  assert.deepEqual(data.events,[1]);
  assert.deepEqual(await videosReady,[]);
});
test('Current Event does not request unused schedule data', async () => {
  const source=(await readFile(new URL('../public/assets/event-info.js',import.meta.url),'utf8')).replace(/^import [^\n]*\n/gm,'');
  const calls=[];
  const nodes=Object.fromEntries(['eventTitle','eventType','eventDate','eventVenue','eventDirections','eventResults','eventPodium','eventBooking','scheduleLink'].map(id=>[id,{}]));
  const context=vm.createContext({document:{getElementById:id=>nodes[id]},fetch:async url=>{calls.push(url);return {ok:true,json:async()=>({events:[],venue:'Cardiff'})}},installCalendarButton:()=>{},nextMeeting:()=>({title:'Test meeting',type:'club'}),londonDate:()=>'',Date,URLSearchParams,location:{search:''},setInterval(){},encodeURIComponent});
  vm.runInContext(source,context);
  for(let i=0;i<10;i++) await Promise.resolve();
  assert.equal(nodes.eventTitle.textContent,'Test meeting');
  assert.equal(calls.length,2);
  assert.ok(!calls.some(url=>url.includes('schedules')));
});
