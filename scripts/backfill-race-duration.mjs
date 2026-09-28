import {readFile, writeFile, rename} from 'node:fs/promises';
import {fetchText, parseRace, pause} from './lib/liverc.mjs';
const file = new URL('../data/raw/races.json', import.meta.url);
const races = JSON.parse(await readFile(file, 'utf8'));
const pending = races.filter(r => !(r.durationSeconds > 0)).reverse();
let next = 0, completed = 0;
const failures = [];
let saving = Promise.resolve();
function save() {
  const snapshot = JSON.stringify(races) + '\n';
  saving = saving.then(async () => {
    await writeFile(new URL('../data/raw/races.json.tmp', import.meta.url), snapshot);
    await rename(new URL('../data/raw/races.json.tmp', import.meta.url), file);
  });
  return saving;
}
await Promise.all(Array.from({length: 3}, async () => {
  while (next < pending.length) {
    const race = pending[next++];
    try {
      const parsed = parseRace(await fetchText(race.sourceUrl));
      if (!(parsed.durationSeconds > 0)) throw Error('No timed duration in source: ' + parsed.title);
      race.durationSeconds = parsed.durationSeconds;
    } catch (error) { failures.push({id: race.liveRcRaceId, error: error.message}); }
    completed++;
    if (completed % 50 === 0) { await save(); console.log(`${completed}/${pending.length}; failures=${failures.length}`); }
    await pause(200);
  }
}));
await save();
console.log(JSON.stringify({checked: pending.length, failures}));
if (failures.length) process.exitCode = 1;
