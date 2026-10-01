import test from 'node:test';
import assert from 'node:assert/strict';
import {resultAvatarPath} from '../public/assets/result-avatars.js';

test('class-specific avatars never appear in another class', () => {
  const mark = {'4-Wheel Drive Buggy':'assets/car-avatars/MARK-GIAQUINTO-AUTO-4WD.png'};
  assert.equal(resultAvatarPath(mark, '4-Wheel Drive Buggy'), mark['4-Wheel Drive Buggy']);
  assert.equal(resultAvatarPath(mark, '2-Wheel Drive Buggy'), '');
});

test('general avatars remain valid across classes', () => {
  const general = 'assets/car-avatars/DRIVER.png';
  assert.equal(resultAvatarPath(general, '2-Wheel Drive Buggy'), general);
  assert.equal(resultAvatarPath({default:general}, '4-Wheel Drive Buggy'), general);
});
