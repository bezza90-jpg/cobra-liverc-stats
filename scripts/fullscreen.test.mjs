import {test} from 'node:test';
import assert from 'node:assert/strict';
import {swipeView} from '../public/virtual-race-replay/fullscreen-gesture.js';
test('horizontal swipes select the adjacent replay panel',()=>{assert.equal(swipeView(-120,8),'timings');assert.equal(swipeView(120,-8),'track');});
test('vertical table scrolling and small taps do not switch panels',()=>{for(const [x,y] of [[4,120],[-30,4],[59,0],[80,100],[-60,40]])assert.equal(swipeView(x,y),null);});
