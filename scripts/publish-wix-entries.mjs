import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {entrySnapshot} from './sync-wix-event-entries.mjs';

const expected=JSON.parse(await readFile(new URL('../public/data/wix-current-event-entries.json',import.meta.url),'utf8'));
const url='https://racehub.cobracardiff.co.uk/data/wix-current-event-entries.json';
const capacityFile = new URL('../public/grand-prix-wales/data/capacity.json', import.meta.url);
const expectedCapacity = JSON.parse(await readFile(capacityFile, 'utf8'));
const capacityUrl = 'https://racehub.cobracardiff.co.uk/grand-prix-wales/data/capacity.json';
async function matches() {
  try {
    const response=await fetch(`${url}?syncCheck=${Date.now()}`,{cache:'no-store',signal:AbortSignal.timeout(15000)});
    if (!response.ok) return false;
    if (entrySnapshot(await response.json()) !== entrySnapshot(expected)) return false;
    const capacity = await fetch(`${capacityUrl}?syncCheck=${Date.now()}`, {cache:'no-store', signal:AbortSignal.timeout(15000)});
    return capacity.ok && JSON.stringify((await capacity.json()).remaining) === JSON.stringify(expectedCapacity.remaining);
  } catch { return false; }
}
if (!await matches()) {
  // An Actions-token push does not trigger the push-based Pages workflow.
  // Explicit dispatch is supported and retries a previously missed publish too.
  execFileSync('gh',['workflow','run','publish-current-wix-entries.yml','--ref','main'],{stdio:'inherit'});
  const deadline=Date.now()+12*60*1000;
  while (!await matches()) {
    if (Date.now()>=deadline) throw Error('Wix entries were saved but are still missing from the live website after 12 minutes. The next scheduled sync will retry publishing.');
    await delay(15000);
  }
}
console.log(`Verified live Wix entries: ${expected.eventTitle}; ${expected.entries.length} class entries. ${url}`);
