import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.argv[2]||'public');
const warnMiB=Number(process.env.PAGES_WARN_MIB||850);
const maxMiB=Number(process.env.PAGES_MAX_MIB||950);
if(!Number.isFinite(warnMiB)||!Number.isFinite(maxMiB)||warnMiB<=0||maxMiB<=warnMiB)throw Error('Pages size limits must be positive and PAGES_MAX_MIB must exceed PAGES_WARN_MIB');

function measure(target){
 const stat=fs.statSync(target);
 if(stat.isFile())return {bytes:stat.size,files:1};
 let bytes=0,files=0;
 for(const entry of fs.readdirSync(target,{withFileTypes:true})){
  if(entry.isSymbolicLink())continue;
  const result=measure(path.join(target,entry.name));
  bytes+=result.bytes;files+=result.files;
 }
 return {bytes,files};
}

const total=measure(root),mib=total.bytes/1024/1024;
const sections=fs.readdirSync(root,{withFileTypes:true}).map(entry=>{
 const result=measure(path.join(root,entry.name));
 return {name:entry.name,...result};
}).sort((a,b)=>b.bytes-a.bytes).slice(0,12);
const lines=[
 '## GitHub Pages deployment size',
 '',
 `**${mib.toFixed(1)} MiB** across ${total.files.toLocaleString('en-GB')} files.`,
 '',
 `Warning threshold: ${warnMiB} MiB · deployment limit: ${maxMiB} MiB.`,
 '',
 '| Largest section | Size | Files |',
 '| --- | ---: | ---: |',
 ...sections.map(item=>`| \`${item.name}\` | ${(item.bytes/1024/1024).toFixed(1)} MiB | ${item.files.toLocaleString('en-GB')} |`),
 ''
];
const report=lines.join('\n');
console.log(report);
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,report+'\n');
if(mib>maxMiB)throw Error(`GitHub Pages output is ${mib.toFixed(1)} MiB, above the ${maxMiB} MiB safety limit`);
if(mib>warnMiB)console.warn(`::warning::GitHub Pages output is ${mib.toFixed(1)} MiB, above the ${warnMiB} MiB warning threshold`);
