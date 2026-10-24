import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bestLapAverage,
  lapPerformanceClass,
  orderedPublishedRaces,
  timedLapsFor
} from '../public/assets/current-event-feed.js';
import { readFile } from 'node:fs/promises';

test('current event races are shown newest first', () => {
  const races = orderedPublishedRaces({ races: [{ id: '1' }, { id: '2' }, { id: '3' }] });
  assert.deepEqual(races.map(race => race.id), ['3', '2', '1']);
});

test('the opening crossing is excluded from lap averages', () => {
  const timed = timedLapsFor({ laps: [
    { lap: 1, seconds: 8.2 },
    { lap: 2, seconds: 17.1 },
    { lap: 3, seconds: 16.9 }
  ] });
  assert.deepEqual(timed.map(lap => lap.lap), [2, 3]);
});

test('long averages only appear when enough laps exist', () => {
  const laps = Array.from({ length: 10 }, (_, index) => ({ seconds: 17 + index / 10 }));
  assert.equal(bestLapAverage(laps, 10), 17.45);
  assert.equal(bestLapAverage(laps, 15), null);
});

test('lap thresholds match the published legend', () => {
  assert.equal(lapPerformanceClass(16.7, 16.7), 'lap-fastest');
  assert.equal(lapPerformanceClass(16.99, 16.7), 'lap-near-fastest');
  assert.equal(lapPerformanceClass(18.2, 16.7), 'lap-slow');
  assert.equal(lapPerformanceClass(17.4, 16.7), '');
});

test('current event lap points publish an exact selected-lap readout', async () => {
  const source = await readFile(new URL('../public/assets/current-event-feed.js', import.meta.url), 'utf8');
  assert.match(source, /data-lap-number=/);
  assert.match(source, /data-lap-time=/);
  assert.match(source, /lap-point-readout/);
  assert.match(source, /lapPoint\.dataset\.lapTime/);
});

test('current event and championship charts scale inside their detail panel', async () => {
  const source = await readFile(new URL('../public/assets/current-event-feed.js', import.meta.url), 'utf8');
  assert.match(source, /<div class="run-lap-chart-scroll">\$\{lapChart\(allLaps, best, prefix\)\}<\/div>/);
});

test('lap detail tables place the coloured lap time before the neutral position', async () => {
  const source = await readFile(new URL('../public/assets/current-event-feed.js', import.meta.url), 'utf8');
  assert.match(source, /<th>Lap<\/th><th>Time<\/th><th>Pos<\/th>/);
  assert.match(source, /<td>\$\{lap\.lap\}<\/td><td>\$\{Number\(lap\.seconds\)\.toFixed\(3\)\}s<\/td><td>\$\{lap\.position/);
});

test('lap one appears on charts but is not included in timed averages', async () => {
  const source = await readFile(new URL('../public/assets/current-event-feed.js', import.meta.url), 'utf8');
  assert.match(source, /lapChart\(allLaps, best, prefix\)/);
  assert.match(source, /Number\(lap\.lap\) === 1 \? 'lap-opening'/);
  assert.match(source, /const timedLaps = timedLapsFor\(driver\)/);
});
