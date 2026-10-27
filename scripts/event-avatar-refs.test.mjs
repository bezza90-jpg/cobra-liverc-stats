import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const data = async name => JSON.parse(await readFile(new URL(`../public/data/${name}`, import.meta.url), 'utf8'));

test('junior entry avatar links use anonymous references with existing display assets', async () => {
  const [next, wix, refs] = await Promise.all([
    data('next-event-entries.json'), data('wix-current-event-entries.json'), data('event-avatar-refs.json')
  ]);
  const linked = [...next.entries, ...wix.entries].filter(entry => entry.className === 'Junior Racers' && entry.avatarRef);
  assert.ok(linked.length >= 2, 'expected approved junior avatars to be linked');
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
