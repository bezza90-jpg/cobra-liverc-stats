import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async relative => JSON.parse(await readFile(path.join(root, relative), 'utf8'));
const [events, entries, eventResults, races, raceResults, dashboard, championships, indexHtml, swordHtml, clubHtml, appJs, championshipJs, styles] = await Promise.all([
  readJson('data/raw/events.json'), readJson('data/raw/entries.json'), readJson('data/raw/event-results.json'),
  readJson('data/raw/races.json'), readJson('data/raw/race-results.json'), readJson('public/data/dashboard.json'), readJson('public/data/championships.json'),
  readFile(path.join(root, 'public/index.html'), 'utf8'),
  readFile(path.join(root, 'public/sword/index.html'), 'utf8'),
  readFile(path.join(root, 'public/club/index.html'), 'utf8'),
  readFile(path.join(root, 'public/assets/app.js'), 'utf8'),
  readFile(path.join(root, 'public/assets/championship.js'), 'utf8'),
  readFile(path.join(root, 'public/assets/styles.css'), 'utf8')
]);

const errors = [];
const unique = (rows, key, label) => {
  const values = new Set();
  for (const row of rows) {
    const value = key(row);
    if (!value) errors.push(`${label} contains a blank key.`);
    else if (values.has(value)) errors.push(`${label} contains duplicate key ${value}.`);
    values.add(value);
  }
};

unique(events, row => row.liveRcEventId, 'events');
unique(entries, row => row.entryKey, 'entries');
unique(eventResults, row => row.resultKey, 'event results');
unique(races, row => row.liveRcRaceId, 'races');
unique(raceResults, row => row.resultKey, 'race results');
if (events.some(row => row.date < '2022-01-01')) errors.push('An event predates 1 January 2022.');
if (events.some(row => /(^|\b)(test|testing)(\b|$)/i.test(row.name))) errors.push('A test event was included.');
if (events.some(row => row.liveRcEventId === '449348')) errors.push('Known unfinished duplicate event 449348 was included.');
if (dashboard.meta.eventCount !== events.length) errors.push('Dashboard event count does not match raw data.');
if (dashboard.meta.raceCount !== races.length) errors.push('Dashboard race count does not match raw data.');
if (dashboard.meta.raceResultCount !== raceResults.length) errors.push('Dashboard result count does not match raw data.');
if (!dashboard.drivers.length || !dashboard.classes.length) errors.push('Dashboard driver or class list is empty.');
if (!eventResults.some(row => row.qualifyingPosition === 1)) errors.push('No TQ results were found.');
if (!races.some(row => row.isFinal && row.mainLetter === 'A')) errors.push('No A-final races were found.');
if (!raceResults.some(row => row.position === 1)) errors.push('No race winners were found.');
const raceField = new Map();
for (const row of raceResults) raceField.set(row.liveRcRaceId, (raceField.get(row.liveRcRaceId) || 0) + 1);
if (![...raceField.values()].some(count => count >= 2)) errors.push('No race is suitable for head-to-head comparison.');
if (!indexHtml.includes('data/dashboard.json') && !appJs.includes('data/dashboard.json')) errors.push('The dashboard data file is not referenced by the website.');
if (!indexHtml.includes('assets/styles.css') || !indexHtml.includes('assets/app.js')) errors.push('Website asset links are missing.');
for (const key of ['sword', 'club']) {
  const config = championships[key];
  if (!config || config.scheduledRounds !== 6 || config.bestRounds !== 4 || config.pointsStart !== 100 || config.tqBonus !== 1) errors.push(`${key} championship scoring configuration is invalid.`);
}
if (!swordHtml.includes('data-championship="sword"') || !clubHtml.includes('data-championship="club"')) errors.push('Championship page identity is missing.');
if (!championshipJs.includes('highestDrop') || !championshipJs.includes('qualifyingPosition')) errors.push('Championship tie-break or TQ scoring logic is missing.');
if (!styles.includes('@media (max-width: 520px)')) errors.push('Mobile layout rules are missing.');
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Validation passed: ${events.length} events, ${dashboard.drivers.length} drivers, ${raceResults.length} race results.`);
