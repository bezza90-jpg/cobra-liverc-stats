import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const publicRoot=fileURLToPath(new URL('../public/',import.meta.url));
const racesRoot=path.join(publicRoot,'virtual-race-replay/races');
const sharesRoot=path.join(publicRoot,'lap-charts/share');
const failures=[];

function verifyPage(raceId) {
  const pageDir=path.join(sharesRoot,raceId);
  const pagePath=path.join(pageDir,'index.html');
  if(!fs.existsSync(pagePath)) {
    failures.push(`${raceId}: missing index.html`);
    return;
  }
  const html=fs.readFileSync(pagePath,'utf8');
  const imageUrl=html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  if(!imageUrl) {
    failures.push(`${raceId}: missing og:image`);
    return;
  }
  const pathname=new URL(imageUrl).pathname.replace(/^\//,'');
  const imagePath=path.join(publicRoot,pathname);
  if(!fs.existsSync(imagePath)) failures.push(`${raceId}: missing ${pathname}`);
  if(!/<meta name="twitter:card" content="summary_large_image">/.test(html)) failures.push(`${raceId}: missing large Twitter card`);
}

for(const file of fs.readdirSync(racesRoot).filter(file=>file.endsWith('.json'))) {
  const race=JSON.parse(fs.readFileSync(path.join(racesRoot,file),'utf8'));
  verifyPage(String(race.id));
}

if(failures.length) {
  console.error(`Chart share cache is incomplete (${failures.length} problems).`);
  for(const failure of failures.slice(0,30)) console.error(`- ${failure}`);
  if(failures.length>30) console.error(`- …and ${failures.length-30} more`);
  process.exit(1);
}
console.log('Every race-level share page has preview metadata and an available image.');
