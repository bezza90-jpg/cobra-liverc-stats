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
const juniorKeys = new Set(eventResults.filter(row => /junior/i.test(row.className)).map(row => row.driverKey));
const classes = [...new Set([...entries, ...eventResults, ...races].map(row => row.className).filter(Boolean))].sort();
const orderedEvents = events.slice().sort((a, b) => a.date.localeCompare(b.date));
const eventType = name => /sword/i.test(name) ? 'sword' : /club day/i.test(name) ? 'club' : 'other';
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
  events: events.map(row => ({ i: row.liveRcEventId, n: row.name, d: row.date, t: eventType(row.name), u: row.sourceUrl || '' })),
  drivers: [...names].map(([key, name]) => ({ k: key, n: name, j: juniorKeys.has(key) })),
  entries: entries.map(row => [row.liveRcEventId, row.eventDate, row.className, row.driverKey]),
  eventResults: eventResults.map(row => [
    row.liveRcEventId, row.eventDate, row.className, row.driverKey,
    row.finalPosition, row.qualifyingPosition, row.result || '', row.raceTier || ''
  ]),
  raceById: Object.fromEntries(races.map(row => [row.liveRcRaceId, {
    e: row.liveRcEventId, d: row.eventDate, c: row.className, n: row.raceName,
    r: row.round, m: row.mainLetter || '', f: Boolean(row.isFinal), u: row.sourceUrl || ''
  }])),
  raceResults: raceResults.map(row => [
    row.liveRcRaceId, row.driverKey, row.position, row.lapsTime || '', row.behind || '',
    row.fastestLap || '', row.averageLap || '', row.consistency || '', row.qualifyingPosition || null
  ])
};

const temporary = `${output}.tmp`;
await writeFile(temporary, `${JSON.stringify(dashboard)}\n`);
await rename(temporary, output);
console.log(`Built dashboard: ${events.length} events, ${names.size} drivers, ${raceResults.length} race results.`);
