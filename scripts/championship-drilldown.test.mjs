import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { racesForDriver } from '../public/assets/championship-drilldown.js';

test('championship drilldown finds every race for the selected driver and class', async () => {
  const eventData = JSON.parse(await readFile(new URL('../public/virtual-race-replay/events/518555.json', import.meta.url), 'utf8'));
  const races = racesForDriver(eventData, '2-Wheel Drive Buggy', 'MATTHEW-HODGES');

  assert.equal(races.length, 6);
  assert.deepEqual(races.map(race => race.round), [
    'Practice Round 1',
    'Qualifier Round 1',
    'Qualifier Round 2',
    'Qualifier Round 3',
    'Qualifier Round 4',
    'Main Events'
  ]);
  assert.ok(races.every(race => race.className === '2-Wheel Drive Buggy'));
  assert.ok(races.every(race => race.drivers.some(driver => driver.key === 'MATTHEW-HODGES')));
});

test('championship rows include an accessible lazy drilldown', async () => {
  const source = await readFile(new URL('../public/assets/championship.js', import.meta.url), 'utf8');
  assert.match(source, /championship-round-count/);
  assert.doesNotMatch(source, /<button type="button" class="championship-driver-toggle"/);
  assert.match(source, /tabindex="0" role="button" aria-expanded="false"/);
  assert.match(source, /aria-expanded="false"/);
  assert.match(source, /championship-driver-detail-row/);
  assert.match(source, /championship-drilldown\.js/);
});

test('round and race data are fetched only after expansion', async () => {
  const source = await readFile(new URL('../public/assets/championship-drilldown.js', import.meta.url), 'utf8');
  assert.match(source, /virtual-race-replay\/events/);
  assert.match(source, /virtual-race-replay\/races/);
  assert.match(source, /driverDetail\(race, driver\)/);
  assert.match(source, /cache: 'force-cache'/);
  assert.match(source, /preloadRaces\(races\)/);
  assert.match(source, /championship-race-retry/);
  assert.match(source, /event\.target\.closest\('\.championship-driver-row'\)/);
});
