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

test('every rated session transfers a zero-sum pool between its direct opponents', () => {
  const summaries = context.ensureDriverRatingSummaries(data, 'senior');
  const changesBySession = new Map();
  for (const summary of summaries.values()) {
    for (const race of summary.raceChanges.values()) changesBySession.set(race.sessionKey, (changesBySession.get(race.sessionKey) || 0) + race.change);
  }
  for (const [sessionKey, total] of changesBySession) assert.ok(Math.abs(total) < 1e-7, `${sessionKey} balances to zero`);
  const totalPool = [...summaries.values()].reduce((sum, summary) => sum + summary.rawTotal, 0);
  assert.ok(Math.abs(totalPool - summaries.size * 1500) < 1e-6, 'archive rating pool remains balanced');
});

test('cRating uses one record per driver per qualifying round or final and contains no duplicated source rows', () => {
  const duplicateRows = data.raceResults.length - new Set(data.raceResults.map(row => JSON.stringify(row))).size;
  assert.equal(duplicateRows, 0);
  const ratedFields = new Map();
  for (const row of data.raceResults) {
    if (!ratedFields.has(row[0])) ratedFields.set(row[0], []);
    ratedFields.get(row[0]).push(row);
  }
  const expectedSessions = new Map(data.drivers.map(driver => [driver.k, new Set()]));
  for (const [raceId, rows] of ratedFields) {
    const race = data.raceById[raceId];
    const field = rows.filter(row => Number(row[2]) > 0 && expectedSessions.has(row[1]));
    if (!race || race.d < '2022-01-01' || /^Practice\b/i.test(race.r || '') || race.c === 'Junior Racers' || field.length < 2) continue;
    const sessionKey = /^Qualifier\s+Round\b/i.test(race.r || '')
      ? `${race.d}|${race.e}|${race.c}|${String(race.r).toLowerCase()}`
      : `race:${raceId}`;
    for (const row of field) expectedSessions.get(row[1]).add(sessionKey);
  }
  const summaries = context.ensureDriverRatingSummaries(data, 'senior');
  for (const [driverKey, sessions] of expectedSessions) assert.equal(summaries.get(driverKey).starts, sessions.size, driverKey);
});

test('qualifying compares the overall round order across separate heats', () => {
  const qualifyingData = {
    drivers: ['A', 'B', 'C', 'D'].map(k => ({ k, n: k })),
    events: [{ i: 'event', n: 'Test event' }],
    eventById: { event: { i: 'event', n: 'Test event' } },
    raceById: {
      heat1: { e: 'event', d: '2026-10-23', c: '2-Wheel Drive Buggy', r: 'Qualifier Round 1', f: false },
      heat2: { e: 'event', d: '2026-10-23', c: '2-Wheel Drive Buggy', r: 'Qualifier Round 1', f: false }
    },
    raceResults: [
      ['heat1', 'A', 1, '10/5:00.000', '', '20.000 (lap 2)'],
      ['heat1', 'B', 2, '9/5:00.000', '', '20.000 (lap 2)'],
      ['heat2', 'C', 1, '11/5:00.000', '', '20.000 (lap 2)'],
      ['heat2', 'D', 2, '10/4:50.000', '', '20.000 (lap 2)']
    ]
  };
  const summaries = context.ensureDriverRatingSummaries(qualifyingData, 'senior');
  assert.ok(summaries.get('C').total > summaries.get('D').total, 'eleven laps ranks first overall');
  assert.ok(summaries.get('D').total > summaries.get('A').total, 'faster ten-lap result outranks the other heat winner');
  assert.ok(summaries.get('A').total > summaries.get('B').total, 'ten laps outranks nine laps');
  for (const summary of summaries.values()) assert.equal(summary.starts, 1, 'the combined qualifying round counts once');
});

test('established leading drivers remain above the starting field rating', () => {
  const summaries = context.ensureDriverRatingSummaries(data, 'senior');
  for (const driverKey of ['CRAIG-HARRIS', 'CHRIS-GUNTER', 'MARK-GIAQUINTO', 'RUSS-WILLIAMS']) {
    assert.ok(summaries.get(driverKey).starts >= 100, `${driverKey} has established history`);
    assert.ok(summaries.get(driverKey).total > 1800, `${driverKey} rating reflects leading results`);
  }
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
