import { readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE_URL, driverKey, fetchText, parseArchive, parseEntryList, parseEventIndex, parseOverall, parseQualifyingPoints, parseRace, pause } from './lib/liverc.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rawDirectory = path.join(root, 'data', 'raw');
const minDate = '2022-01-01';
const excludedEventIds = new Set(['449348']);
const maxEvents = 2;

const files = {
  events: 'events.json', entries: 'entries.json', eventResults: 'event-results.json',
  qualifyingResults: 'qualifying-results.json', races: 'races.json',
  raceResults: 'race-results.json', sync: 'sync.json'
};

async function read(name) {
  return JSON.parse(await readFile(path.join(rawDirectory, files[name]), 'utf8'));
}

async function write(name, value) {
  const destination = path.join(rawDirectory, files[name]);
  const temporary = `${destination}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value)}\n`);
  await rename(temporary, destination);
}

function eligible(event, today) {
  return event.date >= minDate && event.date <= today && event.entries > 0 &&
    !excludedEventIds.has(event.liveRcEventId) && !/(^|\b)(test|testing)(\b|$)/i.test(event.name);
}

function replaceEventRows(rows, eventId, replacements) {
  return [...rows.filter(row => row.liveRcEventId !== eventId), ...replacements];
}

async function importEvent(event) {
  console.log(`Checking ${event.date} — ${event.name} (${event.liveRcEventId})`);
  const eventHtml = await fetchText(event.sourceUrl);
  const index = parseEventIndex(eventHtml);
  if (!index.entryList || !index.overall || !index.points || !index.races.length) {
    console.log('Event is listed but its complete results are not yet available.');
    return null;
  }

  const [entryHtml, pointsHtml, overallHtml] = await Promise.all([
    fetchText(index.entryList), fetchText(index.points), fetchText(index.overall)
  ]);
  const entryRows = parseEntryList(entryHtml);
  const qualifyingRows = parseQualifyingPoints(pointsHtml);
  const overallRows = parseOverall(overallHtml);
  if (!entryRows.length || !qualifyingRows.length || !overallRows.length) {
    throw new Error(`Required result tables were empty for event ${event.liveRcEventId}.`);
  }

  const qualifyingMap = new Map(qualifyingRows.map(row => [`${row.className}|${driverKey(row.driverName)}`, row.qualifyingPosition]));
  const entries = entryRows.map(row => {
    const key = driverKey(row.driverName);
    return {
      entryKey: `${event.liveRcEventId}|${row.className}|${key}`,
      liveRcEventId: event.liveRcEventId, eventDate: event.date, eventName: event.name,
      className: row.className, driverKey: key, driverName: row.driverName, transponder: row.transponder
    };
  });
  const qualifyingResults = qualifyingRows.map(row => {
    const key = driverKey(row.driverName);
    return {
      qualifyingKey: `${event.liveRcEventId}|${row.className}|${key}`,
      liveRcEventId: event.liveRcEventId, eventDate: event.date, eventName: event.name,
      className: row.className, driverKey: key, driverName: row.driverName,
      qualifyingPosition: row.qualifyingPosition, pointsResult: row.pointsResult, tieBreaker: row.tieBreaker
    };
  });
  const eventResults = overallRows.map(row => {
    const key = driverKey(row.driverName);
    return {
      resultKey: `${event.liveRcEventId}|${row.className}|${key}`,
      liveRcEventId: event.liveRcEventId, eventDate: event.date, eventName: event.name,
      className: row.className, driverKey: key, driverName: row.driverName,
      finalPosition: row.finalPosition, result: row.result, raceTier: row.raceTier,
      qualifyingPosition: qualifyingMap.get(`${row.className}|${key}`) || null
    };
  });

  const races = [];
  const raceResults = [];
  for (let indexNumber = 0; indexNumber < index.races.length; indexNumber += 1) {
    const raceLink = index.races[indexNumber];
    if (indexNumber) await pause(140);
    const parsed = parseRace(await fetchText(raceLink.sourceUrl));
    if (!parsed.className || !parsed.results.length) continue;
    races.push({
      liveRcRaceId: raceLink.liveRcRaceId, liveRcEventId: event.liveRcEventId,
      eventDate: event.date, eventName: event.name, round: parsed.round,
      raceName: parsed.raceName, className: parsed.className, mainLetter: parsed.mainLetter,
      isFinal: parsed.isFinal, sourceUrl: raceLink.sourceUrl
    });
    for (const result of parsed.results) {
      const key = driverKey(result.driverName);
      raceResults.push({
        resultKey: `${raceLink.liveRcRaceId}|${key}`,
        liveRcRaceId: raceLink.liveRcRaceId, liveRcEventId: event.liveRcEventId,
        eventDate: event.date, eventName: event.name, round: parsed.round,
        raceName: parsed.raceName, className: parsed.className, mainLetter: parsed.mainLetter,
        isFinal: parsed.isFinal, driverKey: key, driverName: result.driverName,
        position: result.position, qualifyingPosition: result.qualifyingPosition,
        lapsTime: result.lapsTime, behind: result.behind, fastestLap: result.fastestLap,
        averageLap: result.averageLap, consistency: result.consistency
      });
    }
  }
  if (!races.length || !raceResults.length) throw new Error(`No usable races were parsed for event ${event.liveRcEventId}.`);

  return {
    event: { ...event, raceCount: races.length, importedAt: new Date().toISOString() },
    entries, qualifyingResults, eventResults, races, raceResults
  };
}

const data = {
  events: await read('events'), entries: await read('entries'), eventResults: await read('eventResults'),
  qualifyingResults: await read('qualifyingResults'), races: await read('races'),
  raceResults: await read('raceResults'), sync: await read('sync')
};

const now = new Date();
const today = now.toISOString().slice(0, 10);
const archive = parseArchive(await fetchText(`${BASE_URL}/events/`))
  .filter(event => eligible(event, today))
  .sort((a, b) => a.date.localeCompare(b.date));
if (!archive.length) throw new Error('No eligible LiveRC events were found; refusing to replace existing data.');

const existingById = new Map(data.events.map(event => [event.liveRcEventId, event]));
const recentCutoff = new Date(now.getTime() - 21 * 86400000).toISOString().slice(0, 10);
const candidates = archive.filter(event => {
  const existing = existingById.get(event.liveRcEventId);
  return !existing || existing.entries !== event.entries || existing.drivers !== event.drivers ||
    (event.date >= recentCutoff && event.liveRcEventId === archive.at(-1).liveRcEventId);
}).slice(0, maxEvents);

const processed = [];
for (const candidate of candidates) {
  const imported = await importEvent(candidate);
  if (!imported) continue;
  const eventId = candidate.liveRcEventId;
  data.events = replaceEventRows(data.events, eventId, [imported.event]);
  data.entries = replaceEventRows(data.entries, eventId, imported.entries);
  data.qualifyingResults = replaceEventRows(data.qualifyingResults, eventId, imported.qualifyingResults);
  data.eventResults = replaceEventRows(data.eventResults, eventId, imported.eventResults);
  data.races = replaceEventRows(data.races, eventId, imported.races);
  data.raceResults = replaceEventRows(data.raceResults, eventId, imported.raceResults);
  processed.push({ eventId, name: candidate.name, date: candidate.date, races: imported.races.length });
}

data.events.sort((a, b) => a.date.localeCompare(b.date) || a.liveRcEventId.localeCompare(b.liveRcEventId));
data.sync = {
  lastCheckedAt: now.toISOString(), sourceUrl: `${BASE_URL}/events/`,
  eligibleEventsFound: archive.length, eventsProcessed: processed.length, processed
};
await Promise.all([
  write('events', data.events), write('entries', data.entries), write('eventResults', data.eventResults),
  write('qualifyingResults', data.qualifyingResults), write('races', data.races),
  write('raceResults', data.raceResults), write('sync', data.sync)
]);

await import('./build-dashboard.mjs');
console.log(processed.length ? `Imported/refreshed ${processed.length} event(s).` : 'No new completed events; check timestamp updated.');
