import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
const publicRoot=new URL('../public/',import.meta.url);
const readJson=path=>JSON.parse(readFileSync(new URL(path,publicRoot),'utf8'));

test('track gallery flyovers follow the measured 3D design files',()=>{
  const gallery=readJson('data/track-gallery.json');
  const designs=readdirSync(new URL('virtual-race-replay/designs/',publicRoot)).filter(name=>name.endsWith('.json')).map(name=>name.replace('.json','')).sort();
  assert.deepEqual([...gallery.flyoverEvents].sort(),designs);
  const source=readFileSync(new URL('assets/track-gallery.js',publicRoot),'utf8');
  assert.match(source,/flyover=track/);
  assert.match(source,/explore=track/);
  const replay=readFileSync(new URL('virtual-race-replay/replay-3d.js',publicRoot),'utf8');
  assert.match(replay,/params\.get\('flyover'\)===\s*'track'/);
  assert.match(replay,/params\.get\('explore'\)===\s*'track'/);
  assert.match(replay,/trackOnlyMode\?\[\]:drivers\.map\(carState\)/);
});

test('every archived track photograph exists locally and keeps its Facebook source',()=>{
  const gallery=readJson('data/track-gallery.json');
  for(const [eventId,event] of Object.entries(gallery.events)){
    assert.match(event.sourcePost,new RegExp(`facebook\\.com/groups/cobracardiff/posts/`),eventId);
    assert.ok(event.photos.length,eventId);
    for(const photo of event.photos)assert.ok(existsSync(new URL(`track-gallery/${photo.image}`,publicRoot)),`${eventId}: ${photo.image}`);
  }
});

test('track gallery offers results and 2D replay for every event',()=>{
  const html=readFileSync(new URL('track-gallery/index.html',publicRoot),'utf8');
  const source=readFileSync(new URL('assets/track-gallery.js',publicRoot),'utf8');
  assert.match(html,/id="eventActions"/);
  assert.match(source,/view_event&id=/);
  assert.match(source,/2D replay/);
  assert.match(source,/3D replay/);
  assert.match(source,/Track flyover/);
  assert.match(source,/Explore track in 3D/);
});

test('track gallery uses shared COBRA branding and a viewport-fitted fullscreen viewer',()=>{
  const html=readFileSync(new URL('track-gallery/index.html',publicRoot),'utf8');
  const css=readFileSync(new URL('assets/track-gallery.css',publicRoot),'utf8');
  assert.match(html,/class="hero track-hero"/);
  assert.match(html,/class="brand-logo"/);
  assert.match(html,/class="results-nav"/);
  assert.match(css,/height:100dvh/);
  assert.match(css,/object-fit:contain/);
});
