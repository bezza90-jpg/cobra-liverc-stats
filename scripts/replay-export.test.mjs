import assert from 'node:assert/strict';
import test from 'node:test';
import {recordingFormat,replayFilename} from '../public/virtual-race-replay/replay-export.js';

test('prefers MP4 when the browser can record it',()=>{
  const FakeRecorder={isTypeSupported:type=>type==='video/mp4'};
  assert.deepEqual(recordingFormat(FakeRecorder),{mimeType:'video/mp4',extension:'mp4'});
});

test('falls back to WebM for Chrome and Edge implementations',()=>{
  const FakeRecorder={isTypeSupported:type=>type==='video/webm;codecs=vp8'};
  assert.deepEqual(recordingFormat(FakeRecorder),{mimeType:'video/webm;codecs=vp8',extension:'webm'});
});

test('creates a portable descriptive filename',()=>{
  assert.equal(replayFilename(['COBRA','2026-09-20','2-Wheel Drive Buggy A-Main','replay'],'webm'),'cobra-2026-09-20-2-wheel-drive-buggy-a-main-replay.webm');
});
