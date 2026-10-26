import {readFile, writeFile, rename, rm} from 'node:fs/promises';
import {publicEntryData, publicEntryFeed} from './lib/public-entry-data.mjs';

const names=['admin-event-entries.json','next-event-entries.json','wix-current-event-entries.json'];
for (const name of names) {
  const file=new URL(`../public/data/${name}`,import.meta.url);
  const value=JSON.parse(await readFile(file,'utf8'));
  const output=JSON.stringify(publicEntryFeed(value),null,2)+'\n';
  const temporary=new URL(file.href+'.tmp');
  await writeFile(temporary,output);
  await rename(temporary,file);
}
const rawEntries=new URL('../data/raw/entries.json',import.meta.url);
const rawValue=JSON.parse(await readFile(rawEntries,'utf8'));
const rawOutput=JSON.stringify(rawValue.map(publicEntryData))+'\n';
const rawTemporary=new URL(rawEntries.href+'.tmp');
await writeFile(rawTemporary,rawOutput);
await rename(rawTemporary,rawEntries);
await rm(new URL('../public/data/transponder-history.json',import.meta.url),{force:true});
console.log('Repository entry data sanitised; private transponder fields and public history removed.');
