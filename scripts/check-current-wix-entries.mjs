import {readFile} from 'node:fs/promises';

const file = async name => JSON.parse(await readFile(new URL(`../public/data/${name}`, import.meta.url), 'utf8'));
const key = row => `${String(row.driverName || '').trim().toUpperCase()}|${String(row.className || '').trim().toUpperCase()}`;
const wix = await file('wix-current-event-entries.json').catch(() => null);
const published = await file('next-event-entries.json');
if (wix?.entries?.length && (!wix.eventDate || wix.eventDate === published.date)) {
  const actual = new Set((published.entries || []).flatMap(row => [key(row), row.bookingName ? key({...row, driverName:row.bookingName}) : null]).filter(Boolean));
  const missing = wix.entries.filter(row => row.driverName && row.className && !actual.has(key(row)));
  if (missing.length) throw Error(`Current Wix entries missing from the public list: ${missing.map(row => `${row.driverName} — ${row.className}`).join(', ')}`);
}
console.log('Current Wix entries are all present in the public entry list.');
