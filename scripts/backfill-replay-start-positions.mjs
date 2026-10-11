import {readdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const races=JSON.parse(await readFile(path.join(root,'data/raw/race-results.json'),'utf8'));
const starts=new Map(races.map(row=>[`${row.liveRcRaceId}|${row.driverKey}`,Number(row.qualifyingPosition)||null]));
const folder=path.join(root,'public/virtual-race-replay/races');
let changed=0;
for(const file of await readdir(folder)){
 if(!file.endsWith('.json'))continue;
 const destination=path.join(folder,file),race=JSON.parse(await readFile(destination,'utf8'));
 let updated=false;
 for(const driver of race.drivers||[]){
  const startPosition=starts.get(`${race.id}|${driver.key}`)||null;
  if(driver.startPosition!==startPosition){driver.startPosition=startPosition;updated=true;}
 }
 if(updated){await writeFile(destination,JSON.stringify(race));changed++;}
}
console.log(`Added qualifying/start positions to ${changed} replay files.`);
