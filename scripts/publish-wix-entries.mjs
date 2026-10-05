import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {entrySnapshot} from './sync-wix-event-entries.mjs';

const expected=JSON.parse(await readFile(new URL('../public/data/wix-current-event-entries.json',import.meta.url),'utf8'));
const url='https://racehub.cobracardiff.co.uk/data/wix-current-event-entries.json';
async function matches() {
  try {
    const response=await fetch(`${url}?syncCheck=${Date.now()}`,{cache:'no-store',signal:AbortSignal.timeout(15000)});
    if (!response.ok) return false;
    return entrySnapshot(await response.json())===entrySnapshot(expected);
  } catch { return false; }
}
if (!await matches()) {
  // An Actions-token push does not trigger the push-based Pages workflow.
  // Explicit dispatch is supported and retries a previously missed publish too.
  execFileSync('gh',['workflow','run','update-stats.yml','--ref','main'],{stdio:'inherit'});
  const deadline=Date.now()+12*60*1000;
  while (!await matches()) {
    if (Date.now()>=deadline) throw Error('Wix entries were saved but are still missing from the live website after 12 minutes. The next scheduled sync will retry publishing.');
    await delay(15000);
  }
}
console.log(`Verified live Wix entries: ${expected.eventTitle}; ${expected.entries.length} class entries. ${url}`);
