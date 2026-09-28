import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('../public/website-guides/guides.js', import.meta.url), 'utf8');
function setup(saveData = false) {
  const observers=[];
  const videos=Array.from({length: 3},()=>({dataset:{}, preload:'none', paused:true, readyState:0, events:{}, messages:[],
    addEventListener(name,callback){(this.events[name] ||= []).push(callback);},
    fire(name){for(const fn of this.events[name] || [])fn();},
    after(node){this.messages.push(node);},querySelector(){return null;},pause(){this.paused=true;this.fire('pause');}
  }));
  vm.runInNewContext(source, {navigator:{connection:{saveData}}, window:{matchMedia:()=>({matches:false})},
    document:{querySelectorAll:()=>videos,createElement:()=>({setAttribute(){}})},
    IntersectionObserver:class {constructor(callback){this.callback=callback;this.observed=new Set();observers.push(this);}observe(v){this.observed.add(v);}unobserve(v){this.observed.delete(v);}}
  });
  return {videos,observers};
}
test('only a nearby video is prepared before playback',()=>{
  const {videos,observers}=setup();assert.ok(videos.every(v=>v.preload==='none'));
  observers[0].callback([{target:videos[0],isIntersecting:true},{target:videos[1],isIntersecting:false}]);
  assert.equal(videos[0].preload,'auto');assert.equal(videos[1].preload,'none');assert.equal(videos[2].preload,'none');
  assert.equal(videos[0].paused,true);assert.equal(observers[0].observed.has(videos[0]),false);
});
test('data saver avoids automatic buffering; deliberate focus requests metadata only',()=>{
  const {videos,observers}=setup(true);assert.equal(observers.length,0);assert.equal(videos[0].preload,'none');
  videos[0].fire('focusin');assert.equal(videos[0].preload,'metadata');
});
test('waiting status clears on playback and other soundtracks pause',()=>{
  const {videos}=setup();const loading=videos[0].messages.find(m=>m.className==='video-loading');
  videos[1].paused=false;videos[0].paused=false;videos[0].fire('play');assert.equal(loading.hidden,false);assert.equal(videos[1].paused,true);
  videos[0].fire('playing');assert.equal(loading.hidden,true);
  videos[0].fire('waiting');assert.equal(loading.hidden,false);videos[0].fire('pause');assert.equal(loading.hidden,true);
});
