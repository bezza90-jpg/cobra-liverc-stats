import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
const publicRoot=new URL('../public/',import.meta.url);
const readJson=path=>JSON.parse(readFileSync(new URL(path,publicRoot),'utf8'));

test('track gallery flyovers follow the measured 3D design files',()=>{
  const gallery=readJson('data/track-gallery.json');
  const designs=readdirSync(new URL('virtual-race-replay/designs/',publicRoot)).filter(name=>name.endsWith('.json')).filter(name=>!readJson(`virtual-race-replay/designs/${name}`).flatReplay).map(name=>name.replace('.json','')).sort();
  assert.deepEqual([...gallery.flyoverEvents].sort(),designs);
  const source=readFileSync(new URL('assets/track-gallery.js',publicRoot),'utf8');
  assert.match(source,/const threeDAvailable=event=>designAvailable\(event\)/);
  assert.match(source,/flyover=race&autoplay=1/);
  assert.match(source,/flyover=track/);
  assert.match(source,/explore=track/);
  const replay=readFileSync(new URL('virtual-race-replay/replay-3d.js',publicRoot),'utf8');
  assert.match(replay,/params\.get\('flyover'\)===\s*'track'/);
  assert.match(replay,/params\.get\('flyover'\)===\s*'race'/);
  assert.match(replay,/params\.get\('autoplay'\)===\s*'1'/);
  assert.match(replay,/raceFlyoverMode&&!trackOnlyMode\)viewer\.startFlyover\(true\)/);
  assert.match(replay,/autoPlay&&!trackOnlyMode\)setPlaying\(true\)/);
  assert.match(replay,/params\.get\('explore'\)===\s*'track'/);
  assert.match(replay,/trackOnlyMode\?\[\]:drivers\.map\(carState\)/);
});

test('flyover camera gives heightless route points a valid ground height',()=>{
  const source=readFileSync(new URL('virtual-race-replay/track-3d-viewer.js',publicRoot),'utf8');
  assert.match(source,/target=vec\(point\.x,point\.y,Number\(point\.z\)\|\|0\)/);
  assert.doesNotMatch(source,/forward=norm\(sub\(point,position\)\)/);
});

test('every archived track photograph exists locally and keeps its Facebook source',()=>{
  const gallery=readJson('data/track-gallery.json');
  for(const [eventId,event] of Object.entries(gallery.events)){
    const photos=event.photos||[];
    if(event.sourcePost)assert.match(event.sourcePost,new RegExp(`facebook\\.com/groups/cobracardiff/posts/`),eventId);
    assert.ok(photos.length||event.designImage,eventId);
    if(event.designImage)assert.ok(existsSync(new URL(`track-gallery/${event.designImage}`,publicRoot)),`${eventId}: ${event.designImage}`);
    for(const photo of photos){
      assert.ok(existsSync(new URL(`track-gallery/${photo.image}`,publicRoot)),`${eventId}: ${photo.image}`);
      if(!event.sourcePost)assert.equal(photo.location,'House of Sport',eventId);
    }
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
  assert.match(source,/photoSource'\)\.hidden=!photos\.length/);
  assert.match(source,/3D track model available/);
  assert.match(source,/design=track/);
  assert.match(source,/cache:'no-store'/);
});

test('events without a separate plan preview the same track used by the 2D replay',()=>{
  const html=readFileSync(new URL('track-gallery/index.html',publicRoot),'utf8');
  const replay=readFileSync(new URL('virtual-race-replay/replay.js',publicRoot),'utf8');
  const replayCss=readFileSync(new URL('virtual-race-replay/style.css',publicRoot),'utf8');
  assert.match(html,/id="designReplayFrame"/);
  assert.match(replay,/track-design-preview/);
  assert.match(replayCss,/\.track-design-preview #cars\{display:none\}/);
});

test('verified event playlists appear as red YouTube actions',()=>{
  const gallery=readJson('data/track-gallery.json');
  const catalog=readJson('virtual-race-replay/catalog.json');
  const eventIds=new Set(catalog.events.map(event=>String(event.id)));
  const source=readFileSync(new URL('assets/track-gallery.js',publicRoot),'utf8');
  const css=readFileSync(new URL('assets/track-gallery.css',publicRoot),'utf8');
  for(const [eventId,playlists] of Object.entries(gallery.youtubePlaylists||{})){
    assert.ok(eventIds.has(eventId),eventId);
    assert.ok(playlists.length,eventId);
    for(const playlist of playlists){
      assert.match(playlist.url,/^https:\/\/www\.youtube\.com\/playlist\?list=[\w-]+$/);
      assert.match(playlist.label,/playlist$/);
    }
  }
  assert.equal(gallery.youtubePlaylists['518555'].length,2);
  assert.match(source,/YouTube \$\{playlist\.label\}/);
  assert.match(css,/\.track-actions \.youtube\{/);
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
