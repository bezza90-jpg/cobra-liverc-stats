import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../public/assets/avatar-upload.js', import.meta.url), 'utf8');

test('a personalised invitation remains a valid selected driver after initialisation', () => {
  assert.match(source, /if \(!selectedDriver\) \$\('driverSearch'\)\.setCustomValidity\('Choose your name from the matching list\.'\);/);
  assert.doesNotMatch(source, /updateSubmitReadiness\(\);\s*\$\('driverSearch'\)\.setCustomValidity\('Choose your name from the matching list\.'\);/);
});

test('personal GPW and club event links preselect the driver and class', () => {
  assert.match(source, /invitationParams\.get\('gpwToken'\)/);
  assert.match(source, /invitationParams\.get\('eventToken'\)/);
  assert.match(source, /invitationParams\.get\('className'\)/);
  assert.match(source, /\$\('eventToken'\)\.value = invitedDriver\.eventToken/);
  assert.match(source, /\$\('className'\)\.value = invitedDriver\.className/);
});
