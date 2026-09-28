import test from 'node:test';
import assert from 'node:assert/strict';
import {createAvatarLoader} from '../public/assets/avatar-loader.js';
function fixture(manifest = {A:'assets/car-avatars/A.png', B:'assets/car-avatars/B.png'}) {
  const requests=[], images=[];
  const loader=createAvatarLoader({base:'https://example.test/assets/avatar-loader.js',fetcher:async url=>{requests.push(String(url));return {ok:true,json:async()=>String(url).includes('revisions')?{'A|default':'approved-2'}:manifest};},createImage:()=>{const image={};images.push(image);return image;}});
  return {loader,requests,images};
}
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
test('startup loads nothing; each profile loads only its own car and reuses it',async()=>{
  const {loader,requests,images}=fixture();assert.equal(requests.length,0);assert.equal(images.length,0);
  const a=loader.load('A');assert.equal(loader.load('A'),a);await settle();
  assert.equal(requests.length,2);assert.equal(images.length,1);assert.match(images[0].src,/A.png\?v=approved-2$/);
  images[0].onload();assert.equal(await a,images[0]);assert.equal(await loader.load('A'),images[0]);assert.equal(images.length,1);
  const b=loader.load('B');await settle();assert.equal(requests.length,2);assert.equal(images.length,2);images[1].onload();await b;
});
test('missing cars and untrusted paths do not trigger image requests',async()=>{
  const {loader,images}=fixture({A:'https://elsewhere.test/private.png'});assert.equal(await loader.load('A'),null);assert.equal(await loader.load('NONE'),null);assert.equal(images.length,0);
});
test('failed image does not cause request storms during map animation',async()=>{
  const {loader,images}=fixture();const a=loader.load('A');await settle();images[0].onerror();assert.equal(await a,null);for(let i=0;i<20;i++)await loader.load('A');assert.equal(images.length,1);
});
test('profiles load all class cars without adding the fallback as an extra car',async()=>{
 const {loader,images,requests}=fixture({A:{default:'assets/car-avatars/A.png','2-Wheel Drive Buggy':'assets/car-avatars/A-2WD.png','4-Wheel Drive Buggy':'assets/car-avatars/A-4WD.png'}});
 const all=loader.loadAll('A'); await settle();
 assert.equal(images.length,2); images.forEach(image=>image.onload());
 assert.deepEqual((await all).map(car=>car.className),['2-Wheel Drive Buggy','4-Wheel Drive Buggy']);
 assert.equal(await loader.loadAll('A'),await all); assert.equal(requests.length,2);
});
test('profile omits failed images and supports a single legacy car',async()=>{
 const {loader,images}=fixture();const all=loader.loadAll('A');await settle();images[0].onload();
 assert.equal((await all).length,1);
 const missing=loader.loadAll('B');await settle();images[1].onerror();assert.deepEqual(await missing,[]);
});
