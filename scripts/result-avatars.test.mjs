import test from 'node:test';
import assert from 'node:assert/strict';
import {resultAvatarClass, resultAvatarPath} from '../public/assets/result-avatars.js';

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

test('all-senior leaderboard uses an available class avatar', () => {
  const twoWheelDrive = 'assets/car-avatars/DRIVER-AUTO-2WD.png';
  const fourWheelDrive = 'assets/car-avatars/DRIVER-AUTO-4WD.png';
  const record = {
    '2-Wheel Drive Buggy':twoWheelDrive,
    '4-Wheel Drive Buggy':fourWheelDrive
  };
  assert.equal(resultAvatarPath(record, 'senior'), twoWheelDrive);
  assert.equal(resultAvatarClass(record, 'senior'), '2-Wheel Drive Buggy');
  assert.equal(resultAvatarPath({'4-Wheel Drive Buggy':fourWheelDrive}, 'senior'), fourWheelDrive);
});
