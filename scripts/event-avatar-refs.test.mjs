import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {buildEventAvatarReferences} from './build-event-avatar-refs.mjs';

const data = async name => JSON.parse(await readFile(new URL(`../public/data/${name}`, import.meta.url), 'utf8'));

test('junior entry avatar links use anonymous references with existing display assets', async () => {
  const [next, wix, refs] = await Promise.all([
    data('next-event-entries.json'), data('wix-current-event-entries.json'), data('event-avatar-refs.json')
  ]);
  const linked = [...next.entries, ...wix.entries].filter(entry => entry.className === 'Junior Racers' && entry.avatarRef);
  assert.deepEqual(new Set(Object.keys(refs)), new Set(linked.map(entry=>entry.avatarRef)), 'references must match the current event, including an event with no junior avatars');
  for (const entry of linked) {
    assert.match(entry.driverName, /^[^ ]+ [A-Z]\.$/);
    assert.match(entry.avatarRef, /^[0-9a-f]{20}$/);
    assert.ok(refs[entry.avatarRef], `missing anonymous avatar ${entry.avatarRef}`);
    for (const source of Object.values(refs[entry.avatarRef])) {
      assert.match(source, /^assets\/event-avatar-refs\/[a-z0-9-]+\.webp$/);
      await assert.doesNotReject(readFile(new URL(`../public/${source}`, import.meta.url)));
    }
  }
});

test('the published next-event feed contains each junior only once', async () => {
  const next = await data('next-event-entries.json');
  const juniors = next.entries.filter(entry => entry.className === 'Junior Racers');
  const identities = juniors.map(entry => entry.avatarRef || entry.driverName.trim().toUpperCase());
  assert.equal(new Set(identities).size, juniors.length);
});

test('junior avatar publishing works independently of whoever booked the next event',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'cobra-avatar-'));
 t.after(async()=>{assert.ok(path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'cobra-avatar-'));await rm(dir,{recursive:true,force:true});});
 await mkdir(path.join(dir,'data'),{recursive:true});await mkdir(path.join(dir,'assets','car-avatar-thumbnails'),{recursive:true});
 const put=(name,data)=>writeFile(path.join(dir,'data',name),JSON.stringify(data));
 await put('car-avatars.json',{'EXAMPLE-JUNIOR':{default:'assets/car-avatars/EXAMPLE-JUNIOR.png'}});
 await put('driver-directory.json',{drivers:[{k:'EXAMPLE-JUNIOR',n:'Example Junior'}]});
 await put('next-event-entries.json',{entries:[{driverName:'Example J.',className:'Junior Racers'}]});
 await put('wix-current-event-entries.json',{entries:[]});
 await writeFile(path.join(dir,'assets','car-avatar-thumbnails','EXAMPLE-JUNIOR.webp'),'synthetic test bytes');
 await buildEventAvatarReferences({publicRoot:dir});
 const feed=JSON.parse(await readFile(path.join(dir,'data','next-event-entries.json'),'utf8')),refs=JSON.parse(await readFile(path.join(dir,'data','event-avatar-refs.json'),'utf8')),ref=feed.entries[0].avatarRef;
 assert.match(ref,/^[0-9a-f]{20}$/);assert.equal(feed.entries[0].driverName,'Example J.');assert.ok(refs[ref]);
 assert.equal((await readFile(path.join(dir,refs[ref].default))).toString(),'synthetic test bytes');
 await put('next-event-entries.json',{entries:[]});await buildEventAvatarReferences({publicRoot:dir});
 assert.deepEqual(JSON.parse(await readFile(path.join(dir,'data','event-avatar-refs.json'),'utf8')),{});
});
