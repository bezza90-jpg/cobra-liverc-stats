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

function canonicalClass(value = '') {
  const name = String(value).replace(/\s+[A-Z]\d*-Main\b.*$/i, '').trim();
  if (/junior/i.test(name)) return 'Junior Racers';
  if (/(?:4[ -]?wheel|4wd)/i.test(name)) return '4-Wheel Drive Buggy';
  if (/(?:2[ -]?wheel|2wd)/i.test(name)) return '2-Wheel Drive Buggy';
  if (/truck/i.test(name)) return 'Trucks';
  if (/vintage/i.test(name)) return 'Vintage';
  return '';
}

const names = new Map();
for (const row of [...entries, ...eventResults, ...raceResults]) names.set(row.driverKey, row.driverName);
const juniorKeys = new Set(eventResults.filter(row => canonicalClass(row.className) === 'Junior Racers').map(row => row.driverKey));
const classOrder = ['Junior Racers', '2-Wheel Drive Buggy', '4-Wheel Drive Buggy', 'Trucks', 'Vintage'];
const availableClasses = new Set([...entries, ...eventResults, ...races].map(row => canonicalClass(row.className)).filter(Boolean));
const classes = classOrder.filter(name => availableClasses.has(name));
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
  entries: entries.map(row => [row.liveRcEventId, row.eventDate, canonicalClass(row.className), row.driverKey]).filter(row => row[2]),
  eventResults: eventResults.map(row => [
    row.liveRcEventId, row.eventDate, canonicalClass(row.className), row.driverKey,
    row.finalPosition, row.qualifyingPosition, row.result || '', row.raceTier || ''
  ]).filter(row => row[2]),
  raceById: Object.fromEntries(races.map(row => [row.liveRcRaceId, {
    e: row.liveRcEventId, d: row.eventDate, c: canonicalClass(row.className), n: row.raceName,
    r: row.round, m: row.mainLetter || '', f: Boolean(row.isFinal), u: row.sourceUrl || ''
  }]).filter(([, race]) => race.c)),
  raceResults: raceResults.map(row => [
    row.liveRcRaceId, row.driverKey, row.position, row.lapsTime || '', row.behind || '',
    row.fastestLap || '', row.averageLap || '', row.consistency || '', row.qualifyingPosition || null
  ])
};

const temporary = `${output}.tmp`;
await writeFile(temporary, `${JSON.stringify(dashboard)}\n`);
await rename(temporary, output);
console.log(`Built dashboard: ${events.length} events, ${names.size} drivers, ${raceResults.length} race results.`);

// Championship tables do not need individual runs, entries or race metadata.
const championshipData = Object.fromEntries(['meta', 'events', 'drivers', 'eventResults'].map(key => [key, dashboard[key]]));
const championshipOutput = path.join(root, 'public', 'data', 'championship-results.json');
await writeFile(championshipOutput + '.tmp', JSON.stringify(championshipData) + '\n');
await rename(championshipOutput + '.tmp', championshipOutput);

// Setup cards only need event labels and whether a driver reached a final podium.
const podiumDrivers = {};
for (const [raceId, driverKey, position] of dashboard.raceResults) {
  const race = dashboard.raceById[raceId];
  if (!race?.f || Number(position) < 1 || Number(position) > 3) continue;
  (podiumDrivers[race.e] ||= new Set()).add(driverKey);
}
const setupContext = { events: dashboard.events, drivers: dashboard.drivers,
  podiumDrivers: Object.fromEntries(Object.entries(podiumDrivers).map(([event, drivers]) => [event, [...drivers]])) };
const setupOutput = path.join(root, 'public', 'data', 'setup-context.json');
await writeFile(setupOutput + '.tmp', JSON.stringify(setupContext) + '\n');
await rename(setupOutput + '.tmp', setupOutput);

// The avatar directory needs names and keys, not every recorded race result.
const directoryOutput = path.join(root, 'public', 'data', 'driver-directory.json');
await writeFile(directoryOutput + '.tmp', JSON.stringify({drivers:dashboard.drivers.map(({k,n})=>({k,n}))}) + '\n');
await rename(directoryOutput + '.tmp', directoryOutput);

const podiumOutput = path.join(root, 'public', 'data', 'podium-results.json');
const podiumData = {meta:dashboard.meta, drivers:dashboard.drivers.map(({k,n})=>({k,n})), events:dashboard.events, raceById:Object.fromEntries(Object.entries(dashboard.raceById).filter(([,race])=>race.f)), raceResults:dashboard.raceResults.filter(row=>dashboard.raceById[row[0]]?.f && Number(row[2])>=1 && Number(row[2])<=3)};
await writeFile(podiumOutput + '.tmp', JSON.stringify(podiumData) + '\n');
await rename(podiumOutput + '.tmp', podiumOutput);
