import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRace} from './lib/liverc.mjs';
const page = length => `<table><tr><td>2-Wheel Drive Buggy A-Main Round: Main Events Length: ${length}</td></tr><tr><th>Pos</th><th>Driver</th><th>Laps/Time</th><th>Consistency</th></tr><tr><td>1</td><td>Test Driver</td><td>18/5:04.000</td><td>96.1%</td></tr></table>`;
test('reads scheduled duration rather than completed driver time', () => {
  assert.equal(parseRace(page('5:00 Timed')).durationSeconds, 300);
  assert.equal(parseRace(page('3:00 Timed')).durationSeconds, 180);
  assert.equal(parseRace(page('10:30 Timed')).durationSeconds, 630);
});
test('does not invent duration for missing or lap-limited races', () => {
  assert.equal(parseRace(page('20 Laps')).durationSeconds, null);
  assert.equal(parseRace(page('Unknown')).durationSeconds, null);
});
