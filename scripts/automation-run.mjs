// Run fixed processing stages, retaining all published outputs when paused.
import {readFile, writeFile, rename} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const controls=JSON.parse(await readFile(path.join(root,'public/data/automation-controls.json'),'utf8'));
const plans={liverc:['update-liverc.mjs'],youtube:['update-youtube.mjs'],podiums:['sync-manufacturer-logos.mjs','build-podium-defaults.mjs']};
const feature=process.argv[2];
if(!plans[feature] || controls.version!==1 || typeof controls.features?.[feature]!=='boolean') throw new Error('Invalid automation controls; no processing started.');
const file=path.join(root,'public/data/automation-status.json');
let status={};
try {status=JSON.parse(await readFile(file,'utf8'));} catch(e) {if(e.code!=='ENOENT') throw e;}
const previous=status[feature]||{};
let outcome='paused', code=0;
if(controls.features[feature]) {
  outcome='success';
  for(const script of plans[feature]) {
    const result=spawnSync(process.execPath,[path.join(root,'scripts',script)],{cwd:root,stdio:'inherit',env:process.env});
    if(result.error || result.status!==0) {outcome='failed'; code=result.status||1; break;}
  }
  if(feature==='youtube' && !process.env.YOUTUBE_API_KEY && outcome==='success') outcome='not-configured';
}
const stamp=new Date().toISOString();
status[feature]={...previous,lastAttempt:stamp,status:outcome,...(outcome==='success'?{lastSuccess:stamp}:{}),queued:'Source backlog retained; count not measured'};
await writeFile(file+'.tmp',JSON.stringify(status,null,2)+'\n'); await rename(file+'.tmp',file);
console.log(`${feature}: ${outcome}. Existing outputs retained when paused.`);
process.exitCode=code;
