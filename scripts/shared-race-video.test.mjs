import test from 'node:test';
import assert from 'node:assert/strict';
import {sharedRaceVideo} from '../public/assets/shared-race-video.js';

const results = [
  ['race-together', 'MATTHEW-HODGES'],
  ['race-together', 'SIMON-FISHER'],
  ['race-apart', 'SIMON-FISHER']
];
const videos = [
  {raceId: 'race-together', url: 'https://www.youtube.com/watch?v=together'},
  {raceId: 'race-apart', url: 'https://www.youtube.com/watch?v=apart'}
];

test('returns a video when Matthew and the selected driver shared the race', () => {
  assert.equal(sharedRaceVideo(results, videos, 'race-together', 'SIMON-FISHER')?.url, videos[0].url);
});

test('does not return a video for a race without Matthew', () => {
  assert.equal(sharedRaceVideo(results, videos, 'race-apart', 'SIMON-FISHER'), null);
});

test('does not return a video when the selected driver was not in the race', () => {
  assert.equal(sharedRaceVideo(results, videos, 'race-together', 'RUSSELL-THOMAS'), null);
});
