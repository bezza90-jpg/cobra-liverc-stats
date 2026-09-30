import {canonicalDriverKey, canonicalDriverName} from '../public/assets/driver-identity.js';
// New entrants belong in selectors before they have recorded a race.
// Only add identities here; never synthesize attendance, laps or results.
export function addCurrentEntrants(names, entries = []) {
  for (const row of entries) {
    const key = canonicalDriverKey(String(row.driverKey || ''));
    const name = canonicalDriverName(key, String(row.driverName || '').trim());
    if (/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(key) && name && !names.has(key)) names.set(key, name);
  }
  return names;
}