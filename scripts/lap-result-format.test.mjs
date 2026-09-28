import test from 'node:test';
import assert from 'node:assert/strict';
import {averageLapText,fastestLapText} from '../public/assets/lap-result-format.js';
test('responsive duplicates collapse without changing distinct or missing values',()=>{assert.equal(averageLapText('17.068 17.068'),'17.068');assert.equal(averageLapText('17.068'),'17.068');assert.equal(averageLapText('17.068 18.000'),'17.068 18.000');assert.equal(averageLapText(null),'');});
test('lap index is labelled for new and historical results without altering valid times',()=>{assert.equal(fastestLapText('16.205 11'),'16.205 (lap 11)');assert.equal(fastestLapText('13.85712'),'13.857 (lap 12)');assert.equal(fastestLapText('16.205'),'16.205');assert.equal(fastestLapText('16.205 (lap 11)'),'16.205 (lap 11)');assert.equal(fastestLapText(''),'');});
