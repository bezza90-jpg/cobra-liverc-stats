import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const app = readFileSync(new URL('../public/assets/app.js', import.meta.url), 'utf8');
const data = JSON.parse(readFileSync(new URL('../public/data/dashboard.json', import.meta.url), 'utf8'));
data.eventById = Object.fromEntries(data.events.map(event => [event.i, event]));

function functionSource(name) {
  const start = app.indexOf(`function ${name}(`);
  const next = app.indexOf('\nfunction ', start + 1);
  assert.notEqual(start, -1, `${name} exists`);
  return app.slice(start, next);
}

const context = vm.createContext({
  state: { data },
  driverRatingData: null,
  driverRatingSummaryPools: new Map(),
  Map,
  Math,
  Number,
  String
});
vm.runInContext([
  'average', 'classMatches', 'completedLaps', 'lapTimeSeconds', 'ratingConfidence', 'confirmedRating',
  'ensureDriverRatingSummaries', 'driverRatingSummary'
].map(functionSource).join('\n'), context);

test('cRating audits every archived driver with finite values and provisional status', () => {
  const summaries = context.ensureDriverRatingSummaries(data, 'senior');
  assert.equal(summaries.size, data.drivers.length);
  for (const driver of data.drivers) {
    const summary = summaries.get(driver.k);
    assert.ok(summary, driver.k);
    assert.ok(Number.isFinite(summary.total), `${driver.k} total`);
    assert.ok(Number.isFinite(summary.rawTotal), `${driver.k} raw total`);
    assert.ok(summary.total >= 100, `${driver.k} floor`);
    assert.ok(summary.confidence >= 0 && summary.confidence <= 1, `${driver.k} confidence`);
    assert.ok(Math.abs(summary.total - 1500) <= Math.abs(summary.rawTotal - 1500) + 1e-8, `${driver.k} attendance confidence shrinks uncertainty`);
    for (const meeting of summary.meetings) {
      assert.ok(Number.isFinite(meeting.before) && Number.isFinite(meeting.after) && Number.isFinite(meeting.change), `${driver.k} meeting values`);
      assert.ok(Math.abs(meeting.after - meeting.before - meeting.change) < 1e-7, `${driver.k} meeting movement`);
    }
  }
});

test('every race transfers a zero-sum pool between its direct opponents', () => {
  const summaries = context.ensureDriverRatingSummaries(data, 'senior');
  const changesByRace = new Map();
  for (const summary of summaries.values()) {
    for (const [raceId, race] of summary.raceChanges) changesByRace.set(raceId, (changesByRace.get(raceId) || 0) + race.change);
  }
  for (const [raceId, total] of changesByRace) assert.ok(Math.abs(total) < 1e-7, `${raceId} balances to zero`);
  const totalPool = [...summaries.values()].reduce((sum, summary) => sum + summary.rawTotal, 0);
  assert.ok(Math.abs(totalPool - summaries.size * 1500) < 1e-6, 'archive rating pool remains balanced');
});

test('cRating uses one record per driver per rated race and contains no duplicated source rows', () => {
  const duplicateRows = data.raceResults.length - new Set(data.raceResults.map(row => JSON.stringify(row))).size;
  assert.equal(duplicateRows, 0);
  const ratedFields = new Map();
  for (const row of data.raceResults) {
    if (!ratedFields.has(row[0])) ratedFields.set(row[0], []);
    ratedFields.get(row[0]).push(row);
  }
  const expectedStarts = new Map(data.drivers.map(driver => [driver.k, 0]));
  for (const [raceId, rows] of ratedFields) {
    const race = data.raceById[raceId];
    const field = rows.filter(row => Number(row[2]) > 0 && expectedStarts.has(row[1]));
    if (!race || race.d < '2022-01-01' || /^Practice\b/i.test(race.r || '') || race.c === 'Junior Racers' || field.length < 2) continue;
    for (const row of field) expectedStarts.set(row[1], expectedStarts.get(row[1]) + 1);
  }
  const summaries = context.ensureDriverRatingSummaries(data, 'senior');
  for (const [driverKey, count] of expectedStarts) assert.equal(summaries.get(driverKey).starts, count, driverKey);
});

test('established leading drivers remain above the starting field rating', () => {
  const summaries = context.ensureDriverRatingSummaries(data, 'senior');
  for (const driverKey of ['CRAIG-HARRIS', 'CHRIS-GUNTER', 'MARK-GIAQUINTO', 'RUSS-WILLIAMS']) {
    assert.ok(summaries.get(driverKey).starts >= 100, `${driverKey} has established history`);
    assert.ok(summaries.get(driverKey).total > 1800, `${driverKey} rating reflects leading results`);
  }
  assert.ok(summaries.get('CRAIG-HARRIS').total > summaries.get('CHRIS-GUNTER').total);
});

test('attendance affects confidence without erasing a strong SWORD-only rating', () => {
  const summaries = context.ensureDriverRatingSummaries(data, 'senior');
  for (const summary of summaries.values()) {
    if (!summary.starts) continue;
    assert.ok(Math.abs(summary.total - 1500) <= Math.abs(summary.rawTotal - 1500) + 1e-8);
    if (summary.starts >= 40) assert.ok(summary.confidence > .96);
  }
});

test('Junior ratings remain separate while senior class results establish their own rating', () => {
  const juniors = context.ensureDriverRatingSummaries(data, 'Junior Racers');
  const twoWheelDrive = context.ensureDriverRatingSummaries(data, '2-Wheel Drive Buggy');
  assert.ok(juniors.get('FINLEY-OLDFIELD').starts >= 20, 'Finley retains his Junior history');
  assert.equal(twoWheelDrive.get('FINLEY-OLDFIELD').starts, 0, 'Finley has no invented senior result');
  assert.ok(twoWheelDrive.get('HAIDEN-HICKS').starts > 0, 'Haiden is calibrated by his recorded senior results');
});
