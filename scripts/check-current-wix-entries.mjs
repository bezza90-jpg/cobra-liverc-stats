import {readFile} from 'node:fs/promises';
import {mergeCurrentWixEntries,applyConfirmedChassis} from '../public/assets/event-entry-merge.js';

const file = async name => JSON.parse(await readFile(new URL(`../public/data/${name}`, import.meta.url), 'utf8'));
const key = row => `${String(row.driverName || '').trim().toUpperCase()}|${String(row.className || '').trim().toUpperCase()}`;
const nameKey = row => String(row.driverName || '').trim().toUpperCase();
const wix = await file('wix-current-event-entries.json').catch(() => null);
const source = await file('next-event-entries.json');
const history = await file('transponder-history.json').catch(() => []);
const confirmed = await file('confirmed-event-chassis.json').catch(() => ({}));
const published = applyConfirmedChassis(mergeCurrentWixEntries(source,wix || {},history),confirmed);
if (wix?.entries?.length && (!wix.eventDate || wix.eventDate === published.date)) {
  const actual = new Map();
  const actualByName = new Map();
  for (const row of published.entries || []) {
    actual.set(key(row), row);
    if (!actualByName.has(nameKey(row)) || row.className !== 'Junior Racers') actualByName.set(nameKey(row), row);
    if (row.bookingName) actual.set(key({...row, driverName:row.bookingName}), row);
  }
  const problems = wix.entries.filter(row => {
    if (!row.driverName || !row.className) return false;
    // When there are too few juniors for their own heat, LiveRC places them in
    // the 2WD rookie heat. Their Junior ticket is still valid and must not block
    // race-day publication merely because the displayed class changed.
    const shown = actual.get(key(row)) || (row.className === 'Junior Racers' ? actualByName.get(nameKey(row)) : null);
    if (!shown) return true;
    return (row.chassis && String(shown.chassis || '').toUpperCase() !== String(row.chassis).toUpperCase()) ||
      (/^\d{7}$/.test(String(row.transponder || '')) && row.transponder !== '1234567' && row.transponderSource !== 'history' && String(shown.transponder || '') !== String(row.transponder));
  });
  if (problems.length) throw Error(`Current Wix entries differ from the public list: ${problems.map(row => `${row.driverName} — ${row.className}`).join(', ')}`);
}
console.log('Current Wix entries, chassis and transponders match the public entry list.');
