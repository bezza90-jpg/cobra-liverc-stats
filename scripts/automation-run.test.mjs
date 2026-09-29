import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
test('paused worker preserves outputs and never executes child; enabled worker resumes',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'cobra-control-'));
 try {
  mkdirSync(path.join(root,'scripts')); mkdirSync(path.join(root,'public/data'),{recursive:true});
  copyFileSync(new URL('./automation-run.mjs',import.meta.url),path.join(root,'scripts/automation-run.mjs'));
  writeFileSync(path.join(root,'scripts/update-liverc.mjs'),"import {writeFileSync} from 'node:fs';writeFileSync('ran','yes');");
  const config=path.join(root,'public/data/automation-controls.json');
  writeFileSync(config,JSON.stringify({version:1,features:{liverc:false}}));
  let r=spawnSync(process.execPath,['scripts/automation-run.mjs','liverc'],{cwd:root});assert.equal(r.status,0);
  assert.throws(()=>readFileSync(path.join(root,'ran')));
  assert.equal(JSON.parse(readFileSync(path.join(root,'public/data/automation-status.json'))).liverc.status,'paused');
  writeFileSync(config,JSON.stringify({version:1,features:{liverc:true}}));
  r=spawnSync(process.execPath,['scripts/automation-run.mjs','liverc'],{cwd:root});assert.equal(r.status,0);
  assert.equal(readFileSync(path.join(root,'ran'),'utf8'),'yes');
  assert.ok(JSON.parse(readFileSync(path.join(root,'public/data/automation-status.json'))).liverc.lastSuccess);
  writeFileSync(config,'{}'); r=spawnSync(process.execPath,['scripts/automation-run.mjs','liverc'],{cwd:root});assert.notEqual(r.status,0);
 } finally {rmSync(root,{recursive:true,force:true});}
});
