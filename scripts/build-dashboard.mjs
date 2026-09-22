import { readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = name => path.join(root, 'data', 'raw', name);
const output = path.join(root, 'public', 'data', 'dashboard.json');

async function read(name) {
  return JSON.parse(await readFile(raw(name), 'utf8'));
}

const [events, entries, eventResults, races, raceResults, sync] = await Promise.all([
  read('events.json'), read('entries.json'), read('event-results.json'),
  read('races.json'), read('race-results.json'), read('sync.json')
]);

const names = new Map();
for (const row of [...entries, ...eventResults, ...raceResults]) names.set(row.driverKey, row.driverName);
const classes = [...new Set([...entries, ...eventResults, ...races].map(row => row.className).filter(Boolean))].sort();
const orderedEvents = events.slice().sort((a, b) => a.date.localeCompare(b.date));
const dashboard = {
  meta: {
    generatedAt: sync.lastCheckedAt || new Date().toISOString(),
    earliestEventDate: orderedEvents[0]?.date || '2022-01-01',
    latestEventDate: orderedEvents.at(-1)?.date || new Date().toISOString().slice(0, 10),
    eventCount: events.length,
    driverCount: names.size,
    raceCount: races.length,
    raceResultCount: raceResults.length,
    sourceUrl: 'https://cobracardiff.liverc.com/events/'
  },
  classes,
  events: events.map(row => ({ i: row.liveRcEventId, n: row.name, d: row.date })),
  drivers: [...names].map(([key, name]) => ({ k: key, n: name })),
  entries: entries.map(row => [row.liveRcEventId, row.eventDate, row.className, row.driverKey]),
  eventResults: eventResults.map(row => [row.liveRcEventId, row.eventDate, row.className, row.driverKey, row.finalPosition, row.qualifyingPosition]),
  raceById: Object.fromEntries(races.map(row => [row.liveRcRaceId, {
    e: row.liveRcEventId, d: row.eventDate, c: row.className, n: row.raceName,
    r: row.round, m: row.mainLetter || '', f: Boolean(row.isFinal)
  }])),
  raceResults: raceResults.map(row => [row.liveRcRaceId, row.driverKey, row.position])
};

const temporary = `${output}.tmp`;
await writeFile(temporary, `${JSON.stringify(dashboard)}\n`);
await rename(temporary, output);
console.log(`Built dashboard: ${events.length} events, ${names.size} drivers, ${raceResults.length} race results.`);
