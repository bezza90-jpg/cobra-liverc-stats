import {canonicalDriverKey} from './driver-identity.js';
import {createAvatarLoader} from './avatar-loader.js';
import {trackerDrivers} from './tracker-priority.js';
import {loadStatisticsData} from './statistics-data.js';
import {averageLapText, fastestLapText} from './lap-result-format.js';
import {potentialRun} from './potential-run.js';
import {lapPerformanceClass, renderLapCharts} from './lap-charts.js?v=20261023-lap-colours';
import { loadMap } from './load-map.js?v=20260928-local';
import { journeyRoadDistanceKm, journeyRoadRoute, journeyRoadMilestones } from './journey-route.js?v=20261005-roads';
import {createDistanceRoute} from './journey-route-geometry.js?v=20261005-roads';
import {sharedRaceVideo} from './shared-race-video.js?v=20260929-shared-races';
import {hydrateResultAvatars, resultAvatarCell} from './result-avatars.js?v=20261004-display';

const state = { data: null, profileKey: '', leaderboardSort: { key: 'rank', direction: 'asc' } };
let journeyMap = null;
let journeyMapLayers = null;
let journeyDriverMarkers = new Map();
let journeySelectedKey = '';
let journeyTimelineDates = [];
let journeyRoundSlots = new Map();
let journeySmoothTracks = null;
let journeyRaceTimeline = [];
let journeyPlaybackTimer = null;
let journeyPlaybackPosition = null;
let journeyMotionCache = null;
let journeyTravelledLine = null;
let journeyLastMotionKm = new Map();
let journeyPlaybackHasStarted = false;
let journeyFollowSelected = true;
let journeySelectedKeys = new Set();
let journeyRecentKeys = null;
let journeyLabelsSeed = 0;
let journeyMapFullscreen = false;
let journeyRaceElapsedDays = 0;
let journeyAvatarRenderQueued = false;
const journeyAvatars = createAvatarLoader({onLoad(key) {
  if (!journeyMap || $('journeyMapOverlay').hidden || journeyAvatarRenderQueued) return;
  journeyAvatarRenderQueued = true;
  // Leaflet can still be completing its initial size/layout pass when cached
  // avatar images resolve. Redraw on the next settled frame so cars appear
  // immediately instead of waiting for the user's first zoom interaction.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    journeyAvatarRenderQueued = false;
    journeyMap?.invalidateSize({ pan: false });
    if (journeyMap && !$('journeyMapOverlay').hidden) renderJourneyMap();
  }));
}});
const journeyAvatarImages = journeyAvatars.images;
const $ = id => document.getElementById(id);
async function renderProfileAvatar(driverKey) {
  const frame = $('driverProfileAvatar');
  if (!frame) return;
  const request = String((Number(frame.dataset.request) || 0) + 1);
  frame.dataset.request = request;
  if (frame.dataset.driver !== driverKey) { frame.hidden = true; frame.replaceChildren(); }
  frame.dataset.driver = driverKey;
  const cars = await journeyAvatars.loadAll(driverKey);
  if (frame.dataset.request !== request) return;
  frame.replaceChildren();
  frame.style.setProperty('--avatar-columns', cars.length > 1 ? '2' : '1');
  frame.style.setProperty('--avatar-column-tracks', cars.length === 2 ? cars.map(({image})=>`minmax(0,${image.avatarAspect || 1}fr)`).join(' ') : `repeat(${cars.length > 1 ? 2 : 1},minmax(0,1fr))`);
  frame.style.setProperty('--avatar-rows', String(Math.max(1,Math.ceil(cars.length / 2))));
  for (const {className,image,displaySrc} of cars) {
    const figure = document.createElement('figure');
    const label = classLabels[className] || (className === 'default' ? 'Car avatar' : className);
    const photo = document.createElement('img');
    photo.src = displaySrc || image.src; photo.decoding = 'async';
    photo.alt = `${state.data?.driverByKey?.[driverKey] || 'Driver'} — ${label}`;
    const caption = document.createElement('figcaption'); caption.textContent = label;
    figure.append(photo,caption); frame.append(figure);
  }
  frame.hidden = !cars.length;
}
const fmt = new Intl.NumberFormat('en-GB');
const dateFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const journeyMonthFmt = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London', hourCycle: 'h23' });
const kmToMiles = km => Number((km * 0.621371).toFixed(1));
const journeyExcludedDrivers = new Set(['SIMON-NOTLEY', 'BOB-BOBTECH-GELSTHARP']);
const classLabels = {
  'Junior Racers': 'Juniors',
  '2-Wheel Drive Buggy': '2WD',
  '4-Wheel Drive Buggy': '4WD',
  'Trucks': 'Trucks',
  'Vintage': 'Vintage'
};

let paceCacheData = null;
let fastestLapByRace = new Map();
let driverRatingData = null;
let driverRatingSummaryPools = new Map();
const metricDescriptions = {
  rank: 'Position after sorting by the selected leaderboard measure.',
  finals: 'Published overall final results completed within the selected filters.',
  average: 'Average published overall finishing position after the attendance adjustment.',
  best: 'Best published overall finishing position within the selected filters.',
  topFive: 'Top-five overall finishes, followed by the percentage of completed finals.',
  podiums: 'Top-three overall finishes, followed by the percentage of completed finals.',
  overallWins: 'Published overall event wins within the selected filters.',
  performance: 'Peer-relative performance using every valid record in the selected filters. Race-relative pace from usable heats and finals carries 70%; field-normalised published final results carry 30%. When only one type of evidence exists, the available evidence supplies the score.',
  consistency: 'LiveRC run consistency averaged from full-duration runs with at least five laps, after the attendance adjustment.',
  pace: 'Fastest lap as a percentage of the fastest valid lap in the same class at the same meeting, using runs with at least three completed laps. The meeting benchmark is 100%; closer to 100% is faster. This is the main guide for placing drivers into similarly paced heats.',
  cRating: 'Competitive COBRA skill rating from qualifying heats and finals since January 2022; practice is excluded. Juniors have a separate rating pool from senior classes. Every driver starts at 1,500. Changes compare the result with every direct opponent, using 85% finishing position and 15% race-relative fastest-lap pace from runs of at least three laps. Upsets against highly rated drivers move the score most, finals carry more weight than qualifying, and attendance steadily increases confidence in the displayed rating.',
  eventRating: 'The signed cRating change from this meeting. It combines every recorded race at the meeting; positive means the driver exceeded the field expectation and negative means they finished below it.',
  laps: 'Total completed laps in all matching recorded runs.',
  distance: 'Estimated racing distance using 150 metres for each completed lap.',
  trackTime: 'Combined recorded running time across all matching races.',
  runs: 'Number of matching heats and finals with a recorded result.',
  raceWins: 'Wins in individual heats or finals, rather than overall event wins.',
  tqs: 'Events where the driver qualified first in their class.',
  podiumRate: 'Podium finishes divided by completed published finals.',
  winRate: 'Overall event wins divided by completed published finals.',
  topFiveRate: 'Top-five finishes divided by completed published finals.',
  tqRate: 'Top qualifier results divided by completed published finals.',
  bestConsistency: 'Highest LiveRC consistency percentage from a matching recorded run.',
  highConsistencyRuns: 'Full-duration recorded runs with a LiveRC consistency of at least 95%.',
  lapSpread: 'Average difference between a run’s fastest lap and its average lap; a smaller gap indicates steadier lap speed.',
  qualifyingAverage: 'Average published qualifying position; a smaller number is better.',
  fastestLap: 'Fastest recorded valid lap time within the selected filters.',
  placesGained: 'Average qualifying position minus overall finishing position; a positive figure means places were gained.',
  count: 'Ranked is the number meeting the selected minimum-finals rule. Recorded is every driver with a published final inside the current filters.'
};

function metricHelp(value, description, label = '') {
  const text = String(value ?? '—');
  const help = description || '';
  const accessible = `${label ? `${label}: ` : ''}${text}. ${help}`.trim();
  return `<span class="metric-help" tabindex="0" data-metric-help="${escapeHtml(help)}" aria-label="${escapeHtml(accessible)}">${escapeHtml(text)}</span>`;
}

function metricHelpHtml(valueHtml, accessibleValue, description, label = '') {
  const text = String(accessibleValue ?? '—');
  const help = description || '';
  const accessible = `${label ? `${label}: ` : ''}${text}. ${help}`.trim();
  return `<span class="metric-help" tabindex="0" data-metric-help="${escapeHtml(help)}" aria-label="${escapeHtml(accessible)}">${valueHtml}</span>`;
}

function ensurePaceBenchmarks(data = state.data) {
  if (paceCacheData === data) return fastestLapByRace;
  paceCacheData = data;
  fastestLapByRace = new Map();
  for (const run of data?.raceResults || []) {
    if (completedLaps(run) < 3) continue;
    const race = data?.raceById?.[run[0]];
    if (!race) continue;
    const benchmarkKey = `${race.e}|${race.c}`;
    const lap = lapTimeSeconds(run[5]);
    if (!Number.isFinite(lap) || lap <= 0) continue;
    const current = fastestLapByRace.get(benchmarkKey);
    if (!Number.isFinite(current) || lap < current) fastestLapByRace.set(benchmarkKey, lap);
  }
  return fastestLapByRace;
}

function paceForRun(run, data = state.data) {
  if (completedLaps(run) < 3) return null;
  const lap = lapTimeSeconds(run?.[5]);
  const race = data?.raceById?.[run?.[0]];
  const benchmark = race ? ensurePaceBenchmarks(data).get(`${race.e}|${race.c}`) : null;
  if (!Number.isFinite(lap) || lap <= 0 || !Number.isFinite(benchmark) || benchmark <= 0) return null;
  return Math.min(100, 100 * benchmark / lap);
}

function ensureDriverRatingSummaries(data = state.data, ratingClass = '') {
  if (driverRatingData !== data) {
    driverRatingData = data;
    driverRatingSummaryPools = new Map();
  }
  const ratingPool = ratingClass || 'senior';
  if (driverRatingSummaryPools.has(ratingPool)) return driverRatingSummaryPools.get(ratingPool);
  const driverRatingSummaries = new Map((data?.drivers || []).map(driver => [driver.k, { total: 1500, starts: 0, meetings: new Map(), raceChanges: new Map(), latest: null, ratingClass: ratingPool }]));
  const resultsByRace = new Map();
  for (const run of data?.raceResults || []) {
    if (!resultsByRace.has(run[0])) resultsByRace.set(run[0], []);
    resultsByRace.get(run[0]).push(run);
  }
  const races = Object.entries(data?.raceById || {}).sort(([idA, a], [idB, b]) =>
    a.d.localeCompare(b.d)
    || String(a.e).localeCompare(String(b.e), 'en', { numeric: true })
    || String(a.c).localeCompare(String(b.c), 'en', { numeric: true })
    || Number(Boolean(a.f)) - Number(Boolean(b.f))
    || String(a.r).localeCompare(String(b.r), 'en', { numeric: true })
    || idA.localeCompare(idB, 'en', { numeric: true }));
  for (const [raceId, race] of races) {
    if (!race?.d || race.d < '2022-01-01' || /^Practice\b/i.test(race.r || '') || !classMatches(race.c, ratingPool)) continue;
    const field = (resultsByRace.get(raceId) || []).filter(run => Number(run[2]) > 0 && driverRatingSummaries.has(run[1]));
    if (field.length < 2) continue;
    const before = new Map(field.map(run => [run[1], driverRatingSummaries.get(run[1]).total]));
    const pace = new Map(field
      .filter(run => completedLaps(run) >= 3)
      .map(run => [run[1], lapTimeSeconds(run[5])])
      .filter(([, value]) => Number.isFinite(value) && value > 0));
    const fieldStrength = average([...before.values()]);
    const sessionWeight = race.f ? 1.3 : .7;
    const kFactor = 48 * sessionWeight * Math.min(1.5, Math.max(.75, Math.sqrt(field.length / 6)));
    const updates = field.map(run => {
      let actual = 0;
      let expected = 0;
      for (const opponent of field) {
        if (opponent === run) continue;
        const finish = Number(run[2]) < Number(opponent[2]) ? 1 : Number(run[2]) === Number(opponent[2]) ? .5 : 0;
        const driverLap = pace.get(run[1]);
        const opponentLap = pace.get(opponent[1]);
        const lap = Number.isFinite(driverLap) && Number.isFinite(opponentLap)
          ? (driverLap < opponentLap ? 1 : driverLap === opponentLap ? .5 : 0)
          : finish;
        actual += .85 * finish + .15 * lap;
        expected += 1 / (1 + 10 ** ((before.get(opponent[1]) - before.get(run[1])) / 400));
      }
      const opponents = field.length - 1;
      return { run, before: before.get(run[1]), change: kFactor * (actual / opponents - expected / opponents) };
    });
    for (const update of updates) {
      const driverKey = update.run[1];
      const summary = driverRatingSummaries.get(driverKey);
      const startsBefore = summary.starts;
      summary.total = Math.max(100, summary.total + update.change);
      summary.starts += 1;
      const raceChange = { raceId, date: race.d, eventId: race.e, change: update.change, before: update.before, after: summary.total, fieldSize: field.length, fieldStrength };
      summary.raceChanges.set(raceId, raceChange);
      const key = `${race.d}|${race.e}`;
      const event = data.eventById?.[race.e] || data.events?.find(item => item.i === race.e);
      const meeting = summary.meetings.get(key) || { eventId: race.e, date: race.d, name: event?.n || race.e, races: 0, change: 0, before: update.before, after: update.before };
      meeting.races += 1;
      meeting.change += update.change;
      meeting.after = summary.total;
      summary.meetings.set(key, meeting);
    }
  }
  for (const summary of driverRatingSummaries.values()) {
    const meetings = [...summary.meetings.values()].sort((a, b) => b.date.localeCompare(a.date) || b.eventId.localeCompare(a.eventId));
    summary.meetings = meetings;
    summary.latest = meetings[0] || null;
    summary.rawTotal = summary.total;
    summary.confidence = ratingConfidence(summary.starts);
    summary.total = confirmedRating(summary.rawTotal, summary.starts);
  }
  driverRatingSummaryPools.set(ratingPool, driverRatingSummaries);
  return driverRatingSummaries;
}

function ratingConfidence(starts) {
  return Math.min(1, Math.max(0, 1 - Math.exp(-starts / 12)));
}

function confirmedRating(rawRating, starts) {
  if (!Number.isFinite(rawRating)) return 1500;
  return 1500 + (rawRating - 1500) * ratingConfidence(starts);
}

function driverRatingSummary(driverKey, data = state.data, ratingClass = '') {
  return ensureDriverRatingSummaries(data, ratingClass).get(driverKey) || { total: 1500, starts: 0, meetings: [], raceChanges: new Map(), latest: null, ratingClass: ratingClass || 'senior' };
}

function formatRating(value) {
  if (!Number.isFinite(value)) return '—';
  return Math.round(value).toLocaleString('en-GB');
}

function formatRatingChange(value) {
  if (!Number.isFinite(value)) return '—';
  const rounded = Math.round(value);
  return `${rounded >= 0 ? '+' : '−'}${Math.abs(rounded).toLocaleString('en-GB')}`;
}

function formatRatingWithChange(summary) {
  const total = formatRating(summary?.total);
  return summary?.latest ? `${total} (${formatRatingChange(summary.latest.change)})` : total;
}

function ratingChangeHtml(value) {
  const text = formatRatingChange(value);
  if (!Number.isFinite(value)) return escapeHtml(text);
  const tone = value < 0 ? 'negative' : value > 0 ? 'positive' : 'neutral';
  return `<span class="rating-change ${tone}">${escapeHtml(text)}</span>`;
}

function ratingTextHtml(value) {
  const text = String(value ?? '—');
  const match = text.match(/^(.*) \(([+−-][\d,]+)\)$/);
  if (!match) return escapeHtml(text);
  const tone = /^[−-]/.test(match[2]) ? 'negative' : /^\+0(?:,0)*$/.test(match[2]) ? 'neutral' : 'positive';
  return `${escapeHtml(match[1])} (<span class="rating-change ${tone}">${escapeHtml(match[2])}</span>)`;
}

function ratingMetricHelp(summary, label = 'cRating') {
  const text = formatRatingWithChange(summary);
  return metricHelpHtml(ratingTextHtml(text), text, ratingHelp(summary), label);
}

function ratingChangeMetricHelp(value, label = 'cRating change') {
  const text = formatRatingChange(value);
  return metricHelpHtml(ratingChangeHtml(value), text, metricDescriptions.eventRating, label);
}

function ratingHelp(summary) {
  const latest = summary?.latest;
  const recent = latest
    ? ` Latest meeting: ${formatRatingChange(latest.change)} from ${latest.name} on ${dateFmt.format(new Date(`${latest.date}T12:00:00Z`))}. Current rating: ${formatRating(summary.total)} after ${summary.starts} rated races, with ${Math.round(100 * summary.confidence)}% attendance confidence. ${summary.starts < 20 ? `Provisional: ${20 - summary.starts} more rated race${20 - summary.starts === 1 ? '' : 's'} needed for an established rating.` : 'Established rating.'}`
    : '';
  return `${metricDescriptions.cRating}${recent}`;
}

function metricValueHelp(key, value, label = '') {
  return metricHelp(value, metricDescriptions[key], label);
}

function installMetricHelpPopover() {
  if (document.getElementById('metricHelpPopover')) return;
  const popover = document.createElement('div');
  popover.id = 'metricHelpPopover';
  popover.className = 'metric-help-popover';
  popover.setAttribute('role', 'tooltip');
  popover.hidden = true;
  document.body.append(popover);
  let active = null;
  const show = target => {
    active = target;
    popover.textContent = target.dataset.metricHelp || '';
    popover.hidden = !popover.textContent;
    if (popover.hidden) return;
    const rect = target.getBoundingClientRect();
    const width = Math.min(340, window.innerWidth - 24);
    popover.style.width = `${width}px`;
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2));
    popover.style.left = `${left}px`;
    popover.style.top = `${Math.min(window.innerHeight - popover.offsetHeight - 12, rect.bottom + 10)}px`;
  };
  const hide = target => {
    if (active !== target) return;
    active = null;
    popover.hidden = true;
  };
  document.addEventListener('pointerover', event => { const target = event.target.closest?.('.metric-help'); if (target) show(target); });
  document.addEventListener('pointerout', event => { const target = event.target.closest?.('.metric-help'); if (target && !target.contains(event.relatedTarget)) hide(target); });
  document.addEventListener('focusin', event => { const target = event.target.closest?.('.metric-help'); if (target) show(target); });
  document.addEventListener('focusout', event => { const target = event.target.closest?.('.metric-help'); if (target) hide(target); });
  document.addEventListener('click', event => {
    const target = event.target.closest?.('.metric-help');
    if (target) { event.stopPropagation(); show(target); }
    else if (active) hide(active);
  });
  window.addEventListener('scroll', () => { if (active) show(active); }, true);
  window.addEventListener('resize', () => { if (active) show(active); });
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function inRange(date, from, to) {
  return (!from || date >= from) && (!to || date <= to);
}

function oneYearBefore(date) {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year - 1, month - 1, day));
  return value.toISOString().slice(0, 10);
}

function isPublishedFinal(result) {
  return Number(result[4]) > 0 && /(?:main|final)/i.test(result[7] || '');
}

function eventMatches(eventId, eventType) {
  return !eventType || state.data.eventById[eventId]?.t === eventType;
}

function classMatches(className, selectedClass) {
  if (selectedClass === 'senior') return className !== 'Junior Racers';
  return !selectedClass || className === selectedClass;
}

function syncClassButtons() {
  const selected = $('classFilter').value;
  document.querySelectorAll('[data-class-filter]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.classFilter === selected));
  });
}

function attendanceAdjustedResults(values, higherIsBetter = false) {
  if (!values.length) return [];
  const ordered = values.slice().sort((a, b) => higherIsBetter ? b - a : a - b);
  const discard = Math.max(0, Math.floor(ordered.length / 5) - 1);
  return ordered.slice(0, ordered.length - discard);
}

function combinedPerformanceScore(finishingScores, paceScores) {
  const finish = average(finishingScores.filter(Number.isFinite));
  const pace = average(paceScores.filter(Number.isFinite));
  if (finish === null) return pace;
  if (pace === null) return finish;
  return 0.3 * finish + 0.7 * pace;
}

function filters() {
  return {
    from: $('fromDate').value,
    to: $('toDate').value,
    eventType: $('eventTypeFilter').value,
    className: $('classFilter').value,
    minimumFinals: Number($('minimumFinals').value),
    search: $('driverSearch').value.trim().toUpperCase()
  };
}

function ensureEnhancedMarkup() {
  $('divisionFilter')?.closest('label')?.remove();
  if (!$('resultsNavigation')) document.querySelector('.brand')?.insertAdjacentHTML('afterend', '<nav class="results-nav" id="resultsNavigation" aria-label="Results pages"><a href="./" aria-current="page">Race Stats</a><a href="sword/">SWORD Championship</a><a href="club/">Club Series</a><a href="podiums/">Podium Gallery</a></nav>');
  if (!$('resultsNavigation')?.querySelector('.tracker-nav-button')) $('resultsNavigation')?.insertAdjacentHTML('beforeend', '<a class="tracker-nav-button" href="?tracker=1">Driver Distance Tracker</a>');
  if ($('eventTypeFilter')) $('eventTypeFilter').innerHTML = '<option value="">All official events</option><option value="sword">SWORD</option><option value="club">Club Days</option>';
  if ($('classFilter')) $('classFilter').innerHTML = '<option value="senior">All senior classes</option>';
  if (!$('liveRcArchiveLink')) $('updateSchedule')?.insertAdjacentHTML('afterend', '<a class="archive-link" id="liveRcArchiveLink" href="https://cobracardiff.liverc.com/events/" target="_blank" rel="noopener">Event Results</a>');
  if (!$('youtubeChannelLink')) $('liveRcArchiveLink')?.insertAdjacentHTML('afterend', '<a class="archive-link youtube-channel-link" id="youtubeChannelLink" href="https://www.youtube.com/@Bezza90/videos" target="_blank" rel="noopener">Race Videos ▶</a>');
  if (!$('leaderboardClassTabs')) $('leaderboardTitle')?.insertAdjacentHTML('afterend', `<div class="class-tabs" id="leaderboardClassTabs" aria-label="Leaderboard class">
    <button type="button" data-class-filter="2-Wheel Drive Buggy" aria-pressed="false">2WD</button><button type="button" data-class-filter="4-Wheel Drive Buggy" aria-pressed="false">4WD</button><button type="button" data-class-filter="Junior Racers" aria-pressed="false">Junior Racers</button><button type="button" data-class-filter="Trucks" aria-pressed="false">Trucks</button><button type="button" data-class-filter="Vintage" aria-pressed="false">Vintage</button>
  </div>`);
  if (!$('leaderboardMetric')) $('leaderboardCount')?.insertAdjacentHTML('beforebegin', `<label class="runtime-rank-control">Rank leaderboard by<select id="leaderboardMetric"><option value="average">Av overall finish</option><option value="performance">Performance score</option><option value="pace">Pace</option><option value="cRating">cRating</option><option value="finals">Finals completed</option><option value="laps">Total laps</option><option value="distance">Distance raced</option><option value="trackTime">Time on track</option><option value="runs">Recorded runs</option><option value="raceWins">Individual race wins</option><option value="overallWins">Overall wins</option><option value="podiums">Podiums</option><option value="tqs">TQs</option><option value="podiumRate">Podium rate</option><option value="winRate">Overall win rate</option><option value="topFiveRate">Top-five rate</option><option value="tqRate">TQ rate</option><option value="consistency">Adjusted consistency</option><option value="bestConsistency">Best run consistency</option><option value="highConsistencyRuns">Runs at 95%+</option><option value="lapSpread">Av fastest-to-average gap</option><option value="qualifyingAverage">Av qualifying position</option><option value="fastestLap">Fastest lap</option><option value="placesGained">Av places gained</option></select></label>`);
  const minimum = $('minimumFinals');
  if (minimum) {
    minimum.innerHTML = '<option value="1">1+ final</option><option value="5">5+ finals</option><option value="10">10+ finals</option><option value="20">20+ finals</option><option value="30">30+ finals</option>';
    minimum.value = '10';
  }
  const definition = document.querySelector('.definition');
  if (definition) definition.textContent = 'Choose any ranking measure above. Average finish, performance, Pace and consistency use the attendance adjustment: no result is discarded below 10 finals; one is discarded at 10, then one additional lowest result for every five further finals. Consistency uses only full-duration runs with at least five laps. Activity totals always use every matching run.';
  if (!$('updateSchedule')) $('updatedStatus')?.insertAdjacentHTML('afterend', '<p class="update-schedule" id="updateSchedule">Results update automatically each day at 18:00 UK time.</p>');

  if (!$('raceExplorer')) {
    document.querySelector('.head-to-head')?.insertAdjacentHTML('beforebegin', `
      <section class="panel race-explorer" id="raceExplorer" aria-labelledby="raceExplorerTitle">
        <div class="section-heading"><div><p class="eyebrow">Open the meeting</p><h2 id="raceExplorerTitle">Event &amp; race explorer</h2></div></div>
        <div class="race-explorer-controls">
          <label>Event<select id="raceEvent"></select></label><label>Individual race<select id="raceSelection"></select></label>
          <a class="event-link" id="raceEventLink" href="#" target="_blank" rel="noopener">Open event results ↗</a>
          <a class="event-link" id="raceResultLink" href="#" target="_blank" rel="noopener">Open this race ↗</a><a class="event-link" id="raceReplayLink" href="#" target="_blank" rel="noopener">Virtual race replay ▶</a><a class="event-link video-link" id="raceVideoLink" href="#" target="_blank" rel="noopener" hidden>Watch race video ▶</a>
        </div>
        <h3 class="race-result-title" id="raceResultTitle">Select a race</h3>
        <div class="table-wrap compact"><table><thead><tr><th>Pos</th><th>Driver</th><th class="result-avatar-heading">Avatar</th><th>Qualifying</th><th>Laps / time</th><th>Behind</th><th>Fastest lap</th><th>Average lap</th><th>Consistency</th><th title="Fastest lap compared with the fastest valid lap in this race">Pace</th></tr></thead><tbody id="raceExplorerResults"></tbody></table></div>
      </section>`);
  }

  // Older generated pages already contain the explorer but predate its replay link.
  if (!$('raceReplayLink')) $('raceResultLink')?.insertAdjacentHTML('afterend', '<a class="event-link" id="raceReplayLink" href="#" target="_blank" rel="noopener">Virtual race replay ▶</a>');

  if (!$('driverDialog')) {
    document.querySelector('footer')?.insertAdjacentHTML('beforebegin', `
      <dialog class="driver-dialog" id="driverDialog" aria-labelledby="driverProfileName">
        <div class="dialog-shell">
          <button type="button" class="dialog-close" id="closeDriverProfile" aria-label="Close driver profile">×</button>
          <div class="driver-profile-header">
            <div><p class="eyebrow">Driver profile</p><h2 id="driverProfileName">Driver</h2>
              <p class="profile-context" id="driverProfileContext"></p></div>
            <div class="driver-profile-avatar" id="driverProfileAvatar" hidden><img alt=""></div>
          </div>
          <div class="profile-stats" id="driverProfileStats"></div>
          <section class="profile-metric-evidence" id="driverMetricEvidence" hidden aria-live="polite"></section>
          <div class="profile-breakdown-grid">
            <section class="profile-section profile-breakdown-section"><h3>Class breakdown</h3><div class="profile-metric-cards class-metric-cards" id="driverClassDetails"></div><p class="definition">Distance is estimated at 150 metres per completed lap. Track time, fastest lap and consistency use every recorded run within the selected filters.</p></section>
            <section class="profile-section profile-breakdown-section"><h3>Consistency breakdown</h3><div class="profile-metric-cards consistency-metric-cards" id="driverConsistencyDetails"></div><p class="definition">Consistency bands use only runs completed for the full scheduled duration with at least five laps. The lap-gap figure compares each qualifying run’s fastest lap with its average lap; a smaller gap generally indicates steadier pace.</p></section>
          </div>
          <section class="profile-section"><h3>Event and final history</h3><div class="table-wrap profile-history"><table>
            <thead><tr><th>Date</th><th>Event</th><th title="Individual races">Races</th><th>Class</th><th>Overall</th><th>Final</th><th title="Qualifying">Qual</th><th title="Final result">Result</th><th title="Fastest lap">Best lap</th><th title="Consistency">Consist</th><th title="Race-relative pace">Pace</th><th title="cRating gained from this meeting">Gains</th></tr></thead>
            <tbody id="driverEventDetails"></tbody>
          </table></div></section>
        </div>
      </dialog>`);
  }

  if (!$('journeyMapOverlay')) $('driverDialog')?.querySelector('.dialog-shell')?.insertAdjacentHTML('beforeend', `
    <section class="journey-map-overlay" id="journeyMapOverlay" hidden aria-label="Distance raced road map">
      <div class="journey-map-shell">
        <button type="button" class="dialog-close journey-map-close" id="closeJourneyMap" aria-label="Close road map">×</button>
        <p class="eyebrow">Distance raced</p><h3 id="journeyMapTitle">Virtual road journey</h3>
        <p class="journey-map-copy" id="journeyMapCopy"></p>
        <div class="journey-map-controls">
          <label>Find a driver<input type="search" id="journeyDriverSearch" list="journeyDriverOptions" placeholder="Start typing a name…"><datalist id="journeyDriverOptions"></datalist></label>
          <details class="journey-driver-picker" id="journeyDriverPicker"><summary id="journeyDriverSummary">Choose playback drivers (all)</summary><div class="journey-driver-picker-inner"><input id="journeyPickerSearch" type="search" placeholder="Search drivers" aria-label="Search playback drivers"><div class="journey-driver-picker-actions"><button type="button" id="journeySelectAll">All</button><button type="button" id="journeySelectNone">Clear</button></div><div id="journeyDriverChecklist" class="journey-driver-checklist"></div></div></details>
          <label>Playback mode<select id="journeyPlaybackMode"><option value="calendar">Race dates journey</option><option value="race">Race selected drivers</option></select></label><button type="button" id="journeyPlay">▶ Play journey</button><button type="button" id="journeyFullscreen">Full screen</button><a id="journeyStandalone" href="./" target="_blank" rel="noopener">Open map in new tab</a><label>Playback start<select id="journeyPlaybackStart"><option value="earliest">Earliest selected record</option><option value="2022">First recorded race</option><option value="chosen">Chosen date</option></select></label><label>Choose start date<input type="date" id="journeyStartDate" min="2022-01-01" disabled></label><label>Playback duration<select id="journeySpeed">${Array.from({ length: 15 }, (_, index) => `<option value="${(index + 1) * 60000}"${index === 1 ? ' selected' : ''}>${index + 1} ${index === 0 ? 'minute' : 'minutes'}</option>`).join('')}</select></label>
          <label class="journey-timeline">Race date <strong id="journeyDateLabel">Starting…</strong><input type="range" id="journeyDateSlider" min="0" max="0" value="0" step="1" aria-label="Recorded race dates"></label>
        </div>
        <p class="journey-round-note">Distance advances through each recorded round. Round times within an event day are illustrative.</p>
        <div class="journey-race-standings" id="journeyRaceStandings" hidden aria-live="off"></div>
        <div class="journey-milestones" id="journeyMilestones" aria-label="Journey milestones"></div>
        <div class="journey-map-toolbar"><button type="button" id="journeyRefocus">⌖ Refocus on driver</button><span id="journeyFollowStatus">Following selected driver</span></div>
        <div class="journey-map" id="journeyMap"></div>
        <div class="journey-map-legend"><span><i class="selected"></i> Selected driver</span><span><i></i> Other drivers</span><span>Route: Cardiff → Eurotunnel → Belgium E40 → Germany A4/A3 → ERT Steyregg → Istanbul</span></div>
      </div>
    </section>`);

  if (!document.querySelector('#driver-profile-runtime-styles')) {
    document.head.insertAdjacentHTML('beforeend', `<style id="driver-profile-runtime-styles">
      .driver-name{padding:0;color:#067b14;background:transparent;border:0;border-radius:0;font-weight:850;text-align:left;text-decoration:underline;text-decoration-color:#9dd7a5;text-underline-offset:3px}.driver-name:hover{color:#044f0c;background:transparent;text-decoration-color:currentColor}
      .driver-dialog{width:min(1500px,calc(100% - 24px));max-height:94vh;padding:0;color:#111714;background:#fff;border:0;border-radius:16px;box-shadow:0 28px 90px rgba(0,0,0,.35)}.driver-dialog::backdrop{background:rgba(3,10,6,.72);backdrop-filter:blur(3px)}.dialog-shell{position:relative;padding:clamp(22px,4vw,38px)}.dialog-close{position:absolute;top:14px;right:14px;width:42px;height:42px;padding:0;color:#344039;background:#eef3ef;border-radius:50%;font-size:1.65rem;line-height:1}.dialog-close:hover{color:#fff;background:#067b14}.profile-context{margin:8px 52px 22px 0;color:#637069}.profile-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px}.profile-stats article{min-height:106px;padding:16px;background:#f3f7f4;border:1px solid #dfe6e1;border-top:3px solid #08a31a;border-radius:9px}.profile-stats strong{display:block;font-size:1.65rem;line-height:1}.profile-stats span{display:block;margin-top:8px;color:#637069;font-size:.72rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase}.profile-section{margin-top:28px}.profile-section h3{margin:0 0 12px;font-size:1.2rem}.profile-history{max-height:520px}.profile-history th:first-child,.profile-history td:first-child{text-align:left}.profile-history a,.profile-section a{color:#067b14;font-weight:800}
      .race-explorer-controls{display:grid;grid-template-columns:minmax(220px,1fr) minmax(280px,1.5fr) repeat(3,auto);align-items:end;gap:12px;margin-bottom:22px}.race-result-title{margin:0 0 12px;font-size:1.05rem}.driver-races-toggle{min-width:58px;padding:3px 7px;color:#067b14;background:#f4faf5;border:1px solid #d5e6d8;border-radius:999px;font-size:.68rem;font-weight:850;text-align:center;white-space:nowrap}.driver-races-toggle:hover,.driver-races-toggle[aria-expanded="true"]{color:#fff;background:#067b14;border-color:#067b14}.driver-races-detail-row>td{padding:0 8px 10px;background:#f7faf8}.driver-races-table{width:100%;max-height:340px;margin:0;background:#fff;border:1px solid #b9c9bd;border-radius:8px}.driver-races-table table{min-width:920px;font-size:.82rem}.driver-races-table th,.driver-races-table td{padding:10px 9px;text-align:center}@media(max-width:820px){.race-explorer-controls{grid-template-columns:1fr 1fr}.driver-races-table{max-height:420px}}@media(max-width:520px){.race-explorer-controls{grid-template-columns:1fr}}
      .update-schedule{position:relative;z-index:1;display:inline-block;margin:8px 0 0 10px;color:#b8c9bd;font-size:.78rem}@media(max-width:520px){.update-schedule{display:block;margin-left:0}}
      .archive-link{position:relative;z-index:1;display:inline-block;margin:8px 0 0 10px;padding:9px 16px;color:#055f10;background:#fff;border:1px solid #fff;border-radius:6px;box-shadow:0 5px 18px rgba(0,0,0,.2);font-size:.78rem;font-weight:900;text-decoration:none}.archive-link:hover{color:#fff;background:#08a31a;border-color:#08a31a}.youtube-channel-link{color:#fff;background:#c01919;border-color:#c01919}.youtube-channel-link:hover{color:#fff;background:#941111;border-color:#941111}.class-tabs{display:inline-flex;flex-wrap:wrap;gap:0;margin-top:14px;border:1px solid #b9c5bd;border-radius:5px;overflow:hidden}.class-tabs button{padding:8px 12px;color:#26332b;background:#edf1ee;border:0;border-right:1px solid #b9c5bd;border-radius:0;font-size:.76rem}.class-tabs button:last-child{border-right:0}.class-tabs button[aria-pressed="true"]{color:#fff;background:#067b14}@media(max-width:520px){.archive-link{display:block;width:max-content;margin-left:0}.class-tabs{display:flex}.class-tabs button{flex:1 1 auto}}
    </style>`);
  }
}

function calculateLeaderboard() {
  const { from, to, eventType, className, minimumFinals, search } = filters();
  const data = state.data;
  const stats = new Map(data.drivers.map(driver => [driver.k, {
    driverKey: driver.k, name: driver.n, junior: Boolean(driver.j), finals: 0,
    entries: 0, overallWins: 0, podiums: 0, topFive: 0, tqs: 0, positionTotal: 0,
    performanceTotal: 0, best: Infinity, consistencyTotal: 0, consistencyRuns: 0,
    runs: 0, laps: 0, seconds: 0, raceWins: 0, fastestLap: Infinity, bestConsistency: 0, highConsistencyRuns: 0,
    positions: [], performances: [], consistencies: [], paces: [], ratingRuns: [], placesGained: [], qualifyingPositions: [], lapSpreads: []
  }]));

  for (const entry of data.entries) {
    const [eventId, date, cls, driverKey] = entry;
    if (!inRange(date, from, to) || !eventMatches(eventId, eventType) || !classMatches(cls, className)) continue;
    const row = stats.get(driverKey);
    if (row) row.entries += 1;
  }

  const fieldSizes = new Map();
  for (const result of data.eventResults) {
    if (!isPublishedFinal(result)) continue;
    const key = `${result[0]}|${result[2]}`;
    fieldSizes.set(key, (fieldSizes.get(key) || 0) + 1);
  }

  for (const result of data.eventResults) {
    const [eventId, date, cls, driverKey, finalPosition] = result;
    if (!isPublishedFinal(result) || !inRange(date, from, to) || !eventMatches(eventId, eventType) || !classMatches(cls, className)) continue;
    const row = stats.get(driverKey);
    if (!row) continue;
    const fieldSize = fieldSizes.get(`${eventId}|${cls}`) || 1;
    const performance = fieldSize <= 1 ? 100 : 100 * (fieldSize - finalPosition) / (fieldSize - 1);
    row.finals += 1;
    row.positionTotal += finalPosition;
    row.performanceTotal += Math.max(0, performance);
    row.positions.push(finalPosition);
    row.performances.push(Math.max(0, performance));
    row.best = Math.min(row.best, finalPosition);
    if (finalPosition === 1) row.overallWins += 1;
    if (finalPosition <= 3) row.podiums += 1;
    if (finalPosition <= 5) row.topFive += 1;
    if (Number(result[5]) === 1) row.tqs += 1;
    const qualifyingPosition = Number(result[5]);
    if (Number.isFinite(qualifyingPosition) && qualifyingPosition > 0) {
      row.qualifyingPositions.push(qualifyingPosition);
      row.placesGained.push(qualifyingPosition - finalPosition);
    }
  }

  for (const run of data.raceResults) {
    const [raceId, driverKey, position, , , fastestLap, averageLap, consistency] = run;
    const race = data.raceById[raceId];
    if (!race || !inRange(race.d, from, to) || !eventMatches(race.e, eventType) || !classMatches(race.c, className)) continue;
    const row = stats.get(driverKey);
    if (!row) continue;
    row.runs += 1;
    row.ratingRuns.push(run);
    row.laps += completedLaps(run);
    row.seconds += runTimeSeconds(run);
    if (Number(position) === 1) row.raceWins += 1;
    const lap = lapTimeSeconds(fastestLap);
    if (Number.isFinite(lap) && lap > 0) row.fastestLap = Math.min(row.fastestLap, lap);
    const pace = paceForRun(run, data);
    if (Number.isFinite(pace)) row.paces.push(pace);
    const averageLapValue = lapTimeSeconds(averageLap);
    if (Number.isFinite(lap) && lap > 0 && Number.isFinite(averageLapValue) && averageLapValue >= lap) row.lapSpreads.push(averageLapValue - lap);
    const value = Number.parseFloat(consistency);
    if (Number.isFinite(value) && isCompleteConsistencyRun(run, data)) {
      row.consistencyTotal += value;
      row.consistencyRuns += 1;
      row.consistencies.push(value);
      row.bestConsistency = Math.max(row.bestConsistency, value);
      if (value >= 95) row.highConsistencyRuns += 1;
    }
  }

  const eligible = [...stats.values()].filter(row => row.finals > 0);
  state.leaderboardEligibleCount = eligible.length;
  const ranked = eligible
    .filter(row => row.finals >= minimumFinals)
    .map(row => {
      const keptPositions = attendanceAdjustedResults(row.positions);
      const keptConsistencies = attendanceAdjustedResults(row.consistencies, true);
      const keptPaces = attendanceAdjustedResults(row.paces, true);
      const performance = combinedPerformanceScore(row.performances, row.paces);
      const consistency = average(keptConsistencies);
      const pace = average(keptPaces);
      const ratingSummary = driverRatingSummary(row.driverKey, data, className);
      return {
        ...row,
        average: average(keptPositions),
        performance,
        consistency,
        pace,
        cRating: ratingSummary.total,
        ratingSummary,
        placesGainedAverage: average(row.placesGained),
        qualifyingAverage: average(row.qualifyingPositions),
        lapSpreadAverage: average(row.lapSpreads),
        topFiveRate: row.finals ? 100 * row.topFive / row.finals : 0,
        podiumRate: row.finals ? 100 * row.podiums / row.finals : 0,
        winRate: row.finals ? 100 * row.overallWins / row.finals : 0,
        tqRate: row.finals ? 100 * row.tqs / row.finals : 0
      };
    })
    .sort((a, b) => compareLeaderboardRows(a, b, $('leaderboardMetric')?.value || 'average'))
    .map((row, index) => ({ ...row, rank: index + 1 }));

  return ranked.filter(row => !search || row.name.includes(search));
}

function countAndRate(count, total) {
  if (!(total > 0)) return '—';
  return `${count} (${Math.round(100 * count / total)}%)`;
}

const leaderboardMetrics = {
  average: { label: 'Average overall finish', shortLabel: 'Av overall finish', lower: true, value: row => row.average, display: row => row.average.toFixed(1) },
  performance: { label: 'Performance score', shortLabel: 'Perf', value: row => row.performance, display: row => row.performance.toFixed(1) },
  pace: { label: 'Race-relative pace', shortLabel: 'Pace', value: row => row.pace ?? -Infinity, display: row => row.pace === null ? '—' : `${row.pace.toFixed(1)}%` },
  cRating: { label: 'Competitive COBRA skill rating', shortLabel: 'cRating', value: row => row.cRating, display: row => formatRatingWithChange(row.ratingSummary) },
  finals: { label: 'Finals completed', value: row => row.finals },
  laps: { label: 'Total laps', value: row => row.laps, display: row => fmt.format(row.laps) },
  distance: { label: 'Distance raced', value: row => row.laps * 0.15, display: row => `${fmt.format(kmToMiles(row.laps * 0.15))} miles` },
  trackTime: { label: 'Time on track', value: row => row.seconds, display: row => formatSeconds(row.seconds) },
  runs: { label: 'Recorded runs', value: row => row.runs },
  raceWins: { label: 'Individual race wins', value: row => row.raceWins },
  overallWins: { label: 'Overall wins', value: row => row.overallWins },
  podiums: { label: 'Podiums', value: row => row.podiums },
  tqs: { label: 'TQs', value: row => row.tqs },
  podiumRate: { label: 'Podium rate', value: row => row.podiumRate, display: row => `${row.podiumRate.toFixed(1)}%` },
  winRate: { label: 'Overall win rate', value: row => row.winRate, display: row => `${row.winRate.toFixed(1)}%` },
  topFiveRate: { label: 'Top-five rate', value: row => row.topFiveRate, display: row => `${row.topFiveRate.toFixed(1)}%` },
  tqRate: { label: 'TQ rate', value: row => row.tqRate, display: row => `${row.tqRate.toFixed(1)}%` },
  consistency: { label: 'Adjusted consistency', value: row => row.consistency ?? -Infinity, display: row => row.consistency === null ? '—' : `${row.consistency.toFixed(1)}%` },
  bestConsistency: { label: 'Best run consistency', value: row => row.bestConsistency, display: row => row.bestConsistency ? `${row.bestConsistency.toFixed(1)}%` : '—' },
  highConsistencyRuns: { label: 'Runs at 95%+', value: row => row.highConsistencyRuns },
  lapSpread: { label: 'Average fastest-to-average gap', shortLabel: 'Av lap gap', lower: true, value: row => row.lapSpreadAverage ?? Infinity, display: row => row.lapSpreadAverage === null ? '—' : `${row.lapSpreadAverage.toFixed(3)}s` },
  qualifyingAverage: { label: 'Average qualifying position', shortLabel: 'Av qualifying', lower: true, value: row => row.qualifyingAverage ?? Infinity, display: row => row.qualifyingAverage === null ? '—' : row.qualifyingAverage.toFixed(1) },
  fastestLap: { label: 'Fastest lap', lower: true, value: row => row.fastestLap, display: row => Number.isFinite(row.fastestLap) ? `${row.fastestLap.toFixed(3)}s` : '—' },
  placesGained: { label: 'Average places gained', shortLabel: 'Av places gained', value: row => row.placesGainedAverage ?? -Infinity, display: row => row.placesGainedAverage === null ? '—' : `${row.placesGainedAverage >= 0 ? '+' : ''}${row.placesGainedAverage.toFixed(1)}` }
};

function compareLeaderboardRows(a, b, metricKey) {
  const metric = leaderboardMetrics[metricKey] || leaderboardMetrics.average;
  const first = metric.value(a);
  const second = metric.value(b);
  const primary = metric.lower ? first - second : second - first;
  return primary || a.average - b.average || b.overallWins - a.overallWins || b.podiums - a.podiums || b.finals - a.finals || a.name.localeCompare(b.name);
}

function formatSeconds(seconds) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

const leaderboardColumnValues = {
  rank: row => row.rank,
  name: row => row.name,
  metric: row => (leaderboardMetrics[$('leaderboardMetric')?.value || 'average'] || leaderboardMetrics.average).value(row),
  finals: row => row.finals,
  average: row => row.average,
  best: row => row.best,
  topFive: row => row.topFive,
  podiums: row => row.podiums,
  overallWins: row => row.overallWins,
  performance: row => row.performance,
  consistency: row => row.consistency,
  pace: row => row.pace,
  cRating: row => row.cRating
};

function sortLeaderboardRows(rows) {
  const { key, direction } = state.leaderboardSort;
  const value = leaderboardColumnValues[key] || leaderboardColumnValues.rank;
  const factor = direction === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const first = value(a), second = value(b);
    if (first == null && second == null) return a.name.localeCompare(b.name);
    if (first == null) return 1;
    if (second == null) return -1;
    const comparison = typeof first === 'string' ? first.localeCompare(second) : first - second;
    return factor * comparison || a.name.localeCompare(b.name);
  });
}

function updateLeaderboardSortHeadings() {
  document.querySelectorAll('[data-leaderboard-sort]').forEach(heading => {
    const active = heading.dataset.leaderboardSort === state.leaderboardSort.key;
    heading.setAttribute('aria-sort', active ? (state.leaderboardSort.direction === 'asc' ? 'ascending' : 'descending') : 'none');
  });
}

function leaderboardEvidence(row) {
  const data = state.data;
  const { from, to, eventType, className } = filters();
  const matches = (eventId, date, cls) => inRange(date, from, to) && eventMatches(eventId, eventType) && classMatches(cls, className);
  const finals = data.eventResults
    .filter(result => result[3] === row.driverKey && isPublishedFinal(result) && matches(result[0], result[1], result[2]))
    .sort((a, b) => b[1].localeCompare(a[1]) || a[2].localeCompare(b[2]));
  const runs = data.raceResults
    .filter(run => { const race = data.raceById[run[0]]; return run[1] === row.driverKey && race && matches(race.e, race.d, race.c); })
    .sort((a, b) => (data.raceById[b[0]]?.d || '').localeCompare(data.raceById[a[0]]?.d || ''));
  const finalRows = finals.map(result => {
    const event = data.eventById[result[0]];
    const eventName = event?.u ? `<a href="${escapeHtml(event.u)}" target="_blank" rel="noopener">${escapeHtml(event.n)}</a>` : escapeHtml(event?.n || result[0]);
    return `<tr><td>${dateFmt.format(new Date(`${result[1]}T12:00:00Z`))}</td><td>${eventName}</td><td>${escapeHtml(result[2])}</td><td>P${result[4]}</td><td>${result[5] ? `P${result[5]}` : '—'}</td><td>${escapeHtml(result[7] || result[6] || '—')}</td></tr>`;
  }).join('');
  const runRows = runs.map(run => {
    const race = data.raceById[run[0]];
    const event = data.eventById[race.e];
    const source = race.u ? `<a href="${escapeHtml(race.u)}" target="_blank" rel="noopener">LiveRC ↗</a>` : '—';
    const pace = paceForRun(run, data);
    return `<tr><td>${dateFmt.format(new Date(`${race.d}T12:00:00Z`))}</td><td>${escapeHtml(event?.n || race.e)}</td><td>${escapeHtml(race.c)}</td><td>${escapeHtml(race.r)}</td><td>${escapeHtml(race.n)}</td><td>P${run[2]}</td><td>${escapeHtml(run[3] || '—')}</td><td>${escapeHtml(run[4] || '—')}</td><td>${escapeHtml(run[5] || '—')}</td><td>${escapeHtml(run[6] || '—')}</td><td>${escapeHtml(run[7] || '—')}</td><td>${metricValueHelp('pace', pace === null ? '—' : `${pace.toFixed(1)}%`, 'Pace')}</td><td>${source}</td></tr>`;
  }).join('');
  return `<div class="leaderboard-source-panel">
    <div class="leaderboard-source-heading"><div><p class="eyebrow">Result sources</p><h3>${escapeHtml(row.name)}</h3><p>${finals.length} published final${finals.length === 1 ? '' : 's'} · ${runs.length} recorded run${runs.length === 1 ? '' : 's'}</p></div><button type="button" class="profile-open" data-profile-key="${escapeHtml(row.driverKey)}">Open full driver profile</button></div>
    <div class="source-scorecards"><span>${ratingMetricHelp(row.ratingSummary)}<small>cRating</small></span><span>${metricValueHelp('pace', row.pace === null ? '—' : `${row.pace.toFixed(1)}%`, 'Pace')}<small>Pace</small></span><span>${metricValueHelp('performance', row.performance.toFixed(1), 'Performance')}<small>Performance</small></span><span>${metricValueHelp('consistency', row.consistency === null ? '—' : `${row.consistency.toFixed(1)}%`, 'Consistency')}<small>Consistency</small></span></div>
    <details open><summary>Published overall results (${finals.length})</summary><div class="table-wrap compact"><table><thead><tr><th>Date</th><th>Event</th><th>Class</th><th>Overall</th><th>Qualifying</th><th>Final</th></tr></thead><tbody>${finalRows || '<tr><td colspan="6">No published finals match these filters.</td></tr>'}</tbody></table></div></details>
    <details><summary>Individual LiveRC runs (${runs.length})</summary><div class="table-wrap compact"><table><thead><tr><th>Date</th><th>Event</th><th>Class</th><th>Round</th><th>Race</th><th>Pos</th><th>Laps/time</th><th>Behind</th><th>Fastest</th><th>Average</th><th>Consistency</th><th>Pace</th><th>Source</th></tr></thead><tbody>${runRows || '<tr><td colspan="13">No individual runs match these filters.</td></tr>'}</tbody></table></div></details>
  </div>`;
}

function lapAverage(laps, count) {
  const values = laps.map(lap => Number(lap.seconds)).filter(value => Number.isFinite(value) && value > 0).sort((a, b) => a - b).slice(0, count);
  return values.length === count ? `${average(values).toFixed(3)}s` : '—';
}

function profileRunRows(eventRuns, driverKey, data) {
  return eventRuns.map(run => {
    const race = data.raceById[run[0]];
    const raceName = race.u ? `<a href="${escapeHtml(race.u)}" target="_blank" rel="noopener">${escapeHtml(race.n)}</a>` : escapeHtml(race.n);
    const video = sharedRaceVideo(data.raceResults, data.videos, run[0], driverKey);
    const videoLink = video ? `<a class="race-video-inline" href="${escapeHtml(video.url)}" target="_blank" rel="noopener" title="You are in this race">Watch this race ▶</a>` : '—';
    const runPace = paceForRun(run, data);
    return `<tr class="driver-run-row" data-race-id="${escapeHtml(run[0])}" data-driver-key="${escapeHtml(driverKey)}" tabindex="0" role="button" aria-expanded="false" aria-label="Show complete lap result for ${escapeHtml(race.r)} ${escapeHtml(race.n)}"><td>${escapeHtml(race.r)}</td><td>${raceName}</td><td>P${run[2]}</td><td>${escapeHtml(run[3] || '—')}</td><td>${escapeHtml(run[5] || '—')}</td><td>${escapeHtml(run[6] || '—')}</td><td>${escapeHtml(run[7] || '—')}</td><td>${metricValueHelp('pace', runPace === null ? '—' : `${runPace.toFixed(1)}%`, 'Pace')}</td><td>${videoLink}</td></tr><tr class="driver-run-detail-row" hidden><td colspan="9"></td></tr>`;
  }).join('');
}

function profileRaceDetail(eventRuns, driverKey, data, colspan) {
  return `<tr class="driver-races-detail-row" hidden><td colspan="${colspan}"><div class="table-wrap driver-races-table" aria-label="Individual race results"><table><thead><tr><th>Round</th><th>Race</th><th>Pos</th><th>Laps/time</th><th>Fastest</th><th>Average</th><th>Consistency</th><th>Pace</th><th>Video</th></tr></thead><tbody>${profileRunRows(eventRuns, driverKey, data)}</tbody></table></div></td></tr>`;
}

const driverRaceDetailCache = new Map();

function driverRaceDetailUrl(raceId) {
  return new URL(`../virtual-race-replay/races/${encodeURIComponent(raceId)}.json`, import.meta.url);
}

function prefetchDriverRunDetails(container) {
  const raceIds = [...container.querySelectorAll('.driver-run-row[data-race-id]')]
    .slice(0, 8)
    .map(row => row.dataset.raceId)
    .filter(raceId => raceId && !driverRaceDetailCache.has(raceId));
  raceIds.forEach(raceId => {
    fetch(driverRaceDetailUrl(raceId))
      .then(response => response.ok ? response.json() : Promise.reject(new Error('Lap records unavailable')))
      .then(race => driverRaceDetailCache.set(raceId, race))
      .catch(() => {});
  });
}

async function loadDriverRunDetail(row) {
  const detail = row?.nextElementSibling;
  if (!detail?.classList.contains('driver-run-detail-row')) return;
  detail.hidden = false;
  row.setAttribute('aria-expanded', 'true');
  if (detail.dataset.loaded) return;
  detail.dataset.loaded = 'true';
  const cell = detail.querySelector('td');
  cell.innerHTML = '<div class="driver-run-detail" role="status">Loading lap-by-lap result…</div>';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const raceId = row.dataset.raceId;
    const driverKey = row.dataset.driverKey;
    let race = driverRaceDetailCache.get(raceId);
    if (!race) {
      const response = await fetch(driverRaceDetailUrl(raceId), { signal: controller.signal });
      if (!response.ok) throw new Error('Lap records unavailable');
      race = await response.json();
      driverRaceDetailCache.set(raceId, race);
    }
    const driver = race.drivers?.find(item => canonicalDriverKey(item.key || item.id || item.name) === driverKey);
    if (!driver) throw new Error('This driver has no lap record in the race file');
    const allLaps = (driver.laps || []).filter(lap => Number.isFinite(Number(lap.seconds)) && Number(lap.seconds) > 0);
    const timedLaps = allLaps.length > 1 ? allLaps.slice(1) : allLaps;
    const best = timedLaps.length ? Math.min(...timedLaps.map(lap => Number(lap.seconds))) : null;
    const averageTimed = timedLaps.length ? average(timedLaps.map(lap => Number(lap.seconds))) : null;
    const source = race.source || state.data.raceById[raceId]?.u;
    const lapRows = allLaps.map(lap => `<tr class="${lap.lap === 1 ? '' : lapPerformanceClass(lap.seconds, best)}"><td>${lap.lap}</td><td>${Number(lap.seconds).toFixed(3)}s</td><td>${lap.position ? `P${lap.position}` : '—'}</td></tr>`).join('');
    cell.innerHTML = `<div class="driver-run-detail">
      <div class="run-detail-summary">
        <span><strong>${lapAverage(timedLaps, 3)}</strong><small>Top 3 lap average</small></span>
        <span><strong>${lapAverage(timedLaps, 5)}</strong><small>Top 5 lap average</small></span>
        <span><strong>${best === null ? '—' : `${best.toFixed(3)}s`}</strong><small>Best timed lap</small></span>
        <span><strong>${averageTimed === null ? '—' : `${averageTimed.toFixed(3)}s`}</strong><small>Average timed lap</small></span>
        <span><strong>${timedLaps.length}</strong><small>Timed laps</small></span>
      </div>
      <div class="run-detail-columns"><div><h4>Lap-by-lap result</h4><div class="table-wrap compact"><table><thead><tr><th>Lap</th><th>Time</th><th>Race position</th></tr></thead><tbody>${lapRows || '<tr><td colspan="3">No lap times recorded.</td></tr>'}</tbody></table></div></div>
      <div class="run-detail-links"><h4>Open result</h4><a href="./lap-charts/?race=${encodeURIComponent(raceId)}&driver=${encodeURIComponent(driverKey)}">COBRA lap charts</a>${source ? `<a href="${escapeHtml(source)}" target="_blank" rel="noopener">Original LiveRC result ↗</a>` : ''}<p>The opening crossing is listed but excluded from the Top 3 and Top 5 averages.</p></div></div>
    </div>`;
  } catch (error) {
    delete detail.dataset.loaded;
    const message = error?.name === 'AbortError' ? 'Lap details are taking longer than expected' : error.message;
    cell.innerHTML = `<div class="driver-run-detail"><p>${escapeHtml(message)}. The official summary above remains available.</p><button type="button" class="driver-run-retry">Try again</button></div>`;
  } finally {
    clearTimeout(timeout);
  }
}

function renderLeaderboard() {
  const rows = sortLeaderboardRows(calculateLeaderboard());
  state.leaderboardRows = new Map(rows.map(row => [row.driverKey, row]));
  const metricKey = $('leaderboardMetric')?.value || 'average';
  const metric = leaderboardMetrics[metricKey] || leaderboardMetrics.average;
  const fixedAverageHeading = document.querySelector('#driverLeaderboard [data-leaderboard-sort="average"]');
  if (fixedAverageHeading) fixedAverageHeading.hidden = metricKey === 'average';
  if ($('leaderboardMetricHeading')) {
    const heading = $('leaderboardMetricHeading');
    const button = heading.querySelector('button');
    if (button) button.textContent = metric.shortLabel || metric.label;
    else heading.textContent = metric.shortLabel || metric.label;
    heading.title = metric.label;
  }
  updateLeaderboardSortHeadings();
  $('leaderboardCount').innerHTML = metricValueHelp('count', `${fmt.format(rows.length)} ranked · ${fmt.format(state.leaderboardEligibleCount)} recorded`, 'Leaderboard coverage');
  $('leaderboardBody').innerHTML = rows.length ? rows.map(row => `
    <tr class="leaderboard-driver-row" data-driver-row="${escapeHtml(row.driverKey)}" tabindex="0" role="button" aria-expanded="false" aria-controls="leaderboard-source-${escapeHtml(row.driverKey)}" aria-label="Show source results for ${escapeHtml(row.name)}">
      <td>${metricValueHelp('rank', row.rank, 'Rank')}</td><td class="driver-cell"><button type="button" class="driver-name" data-driver-key="${escapeHtml(row.driverKey)}">${escapeHtml(row.name)}</button>${metricKey === 'cRating' ? '' : `<span class="driver-overall-rating">${ratingMetricHelp(row.ratingSummary, 'Overall cRating')} cRating</span>`}</td>${resultAvatarCell(row.driverKey, filters().className)}<td class="ranked-metric">${metricKey === 'cRating' ? ratingMetricHelp(row.ratingSummary) : metricHelp(metric.display ? metric.display(row) : metric.value(row), metricDescriptions[metricKey], metric.label)}</td><td>${metricValueHelp('finals', row.finals, 'Finals')}</td>
      <td class="leaderboard-fixed-average"${metricKey === 'average' ? ' hidden' : ''}>${metricValueHelp('average', row.average.toFixed(1), 'Average overall finish')}</td><td>${metricValueHelp('best', row.best, 'Best overall finish')}</td><td>${metricValueHelp('topFive', countAndRate(row.topFive, row.finals), 'Top-five finishes')}</td>
      <td>${metricValueHelp('podiums', countAndRate(row.podiums, row.finals), 'Podiums')}</td><td>${metricValueHelp('overallWins', row.overallWins, 'Overall wins')}</td>
      <td>${metricValueHelp('performance', row.performance.toFixed(1), 'Performance')}</td><td>${metricValueHelp('consistency', row.consistency === null ? '—' : `${row.consistency.toFixed(1)}%`, 'Consistency')}</td>
    </tr><tr class="leaderboard-source-row" id="leaderboard-source-${escapeHtml(row.driverKey)}" data-source-driver="${escapeHtml(row.driverKey)}" hidden><td colspan="12"></td></tr>`).join('') : '<tr><td colspan="12">No drivers match these filters.</td></tr>';
  hydrateResultAvatars($('leaderboardBody'));
}

let lapChartRequest = 0;
async function loadExplorerLapCharts(raceId) {
  const token=++lapChartRequest;
  let panel=$('raceLapCharts');
  if(!panel){panel=document.createElement('section');panel.id='raceLapCharts';panel.className='lap-charts';panel.setAttribute('aria-label','Lap times by driver');$('raceExplorerResults').closest('.table-wrap').after(panel);}
  panel.innerHTML='<h2>Lap times by driver</h2><p role="status">'+(raceId?'Loading recorded laps…':'Choose a race to see individual lap times.')+'</p>';
  if(!raceId)return;
  try {
    const response=await fetch(new URL('../virtual-race-replay/races/'+encodeURIComponent(raceId)+'.json',import.meta.url));
    if(!response.ok)throw Error('Unavailable');
    const race=await response.json();
    if(token===lapChartRequest){
      renderLapCharts(panel,race);
      const drivers=new Map(race.drivers.map(driver=>[driver.key,driver]));
      $('raceExplorerResults').querySelectorAll('tr').forEach(row=>{
        const cell=row.querySelector('.potential-run');
        if(cell)cell.textContent=potentialRun(drivers.get(row.querySelector('[data-driver-key]')?.dataset.driverKey),Number(state.data.raceById[raceId]?.l));
      });
    }
  }
  catch {if(token===lapChartRequest)panel.innerHTML='<h2>Lap times by driver</h2><p role="status">Individual lap records are unavailable for this race. The results above remain available.</p>';}
}
function renderRaceExplorer(raceId) {
  loadExplorerLapCharts(raceId);
  const data = state.data;
  const race = data.raceById[raceId];
  const body = $('raceExplorerResults');
  const headings=body.closest('table').querySelector('thead tr');
  if(!headings.querySelector('.pace-heading'))headings.insertAdjacentHTML('beforeend','<th class="pace-heading" title="Fastest lap compared with the fastest valid lap in this race">Pace</th>');
  if(!headings.querySelector('.potential-run-heading'))headings.insertAdjacentHTML('beforeend','<th class="potential-run-heading">Potential run</th>');
  if (!race) {
    $('raceResultTitle').textContent = 'No races match these filters';
    body.innerHTML = '<tr><td colspan="8">Choose a different event or class.</td></tr>';
    $('raceResultLink').hidden = true;
    $('raceReplayLink').hidden = true;
    $('raceVideoLink').hidden = true;
    return;
  }
  const event = data.eventById[race.e];
  $('raceResultTitle').textContent = `${event?.n || ''} — ${race.n}`;
  $('raceEventLink').href = event?.u || '#';
  $('raceEventLink').hidden = !event?.u;
  $('raceReplayLink').href = './virtual-race-replay/?race='+encodeURIComponent(raceId)+'&event='+encodeURIComponent(race.e);
  $('raceReplayLink').hidden = false;
  $('raceResultLink').href = race.u || '#';
  $('raceResultLink').hidden = !race.u;
  const video = sharedRaceVideo(data.raceResults, data.videos, raceId);
  $('raceVideoLink').href = video?.url || '#';
  $('raceVideoLink').textContent = 'Watch this race ▶';
  $('raceVideoLink').title = video ? 'You are in this race' : '';
  $('raceVideoLink').hidden = !video;
  const rows = data.raceResults.filter(row => row[0] === raceId).sort((a, b) => a[2] - b[2]);
  const fastestRow = rows.reduce((best, row) => {
    const seconds = lapTimeSeconds(row[5]);
    return Number.isFinite(seconds) && seconds > 0 && (!best || seconds < lapTimeSeconds(best[5])) ? row : best;
  }, null);
  body.innerHTML = rows.length ? rows.map(row => `
    <tr><td>${row[2] || '—'}</td><td><button type="button" class="driver-name" data-driver-key="${escapeHtml(row[1])}">${escapeHtml(data.driverByKey[row[1]] || row[1])}</button></td>${resultAvatarCell(row[1], race.c)}
    <td>${row[8] ? `P${row[8]}` : '—'}</td><td>${escapeHtml(row[3] || '—')}</td><td>${escapeHtml(row[4] || '—')}</td>
    <td${row === fastestRow ? ' class="fastest-lap" title="Fastest lap of this race"' : ''}>${escapeHtml(row[5] || '—')}</td><td>${escapeHtml(row[6] || '—')}</td><td>${escapeHtml(row[7] || '—')}</td><td>${metricValueHelp('pace', paceForRun(row, data) === null ? '—' : `${paceForRun(row, data).toFixed(1)}%`, 'Pace')}</td><td class="potential-run">—</td></tr>`).join('') : '<tr><td colspan="11">No results were recorded for this race.</td></tr>';
  hydrateResultAvatars(body);
}

function updateRaceSelection(preserve = true) {
  const data = state.data;
  const eventId = $('raceEvent').value;
  const previous = preserve ? $('raceSelection').value : '';
  const { className } = filters();
  const races = Object.entries(data.raceById)
    .filter(([, race]) => race.e === eventId && classMatches(race.c, className))
    .sort(([, a], [, b]) => Number(b.f) - Number(a.f) || a.r.localeCompare(b.r) || a.n.localeCompare(b.n));
  $('raceSelection').innerHTML = races.map(([id, race]) => `<option value="${escapeHtml(id)}">${race.f ? 'Final · ' : ''}${escapeHtml(race.r)} · ${escapeHtml(race.n)}</option>`).join('');
  $('raceSelection').value = races.some(([id]) => id === previous) ? previous : (races[0]?.[0] || '');
  renderRaceExplorer($('raceSelection').value);
}

function updateRaceExplorer(preserve = true) {
  const data = state.data;
  const { from, to, eventType, className } = filters();
  const previous = preserve ? $('raceEvent').value : '';
  const raceEvents = new Set(Object.values(data.raceById).filter(race => classMatches(race.c, className)).map(race => race.e));
  const events = data.events.filter(event => raceEvents.has(event.i) && inRange(event.d, from, to) && eventMatches(event.i, eventType)).sort((a, b) => b.d.localeCompare(a.d));
  $('raceEvent').innerHTML = events.map(event => `<option value="${escapeHtml(event.i)}">${dateFmt.format(new Date(`${event.d}T12:00:00Z`))} — ${escapeHtml(event.n)}</option>`).join('');
  $('raceEvent').value = events.some(event => event.i === previous) ? previous : (events[0]?.i || '');
  updateRaceSelection(preserve);
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function profileStat(value, label, description = '') {
  const lower = label.toLowerCase();
  const evidenceKeys = {
    'events attended': 'events', 'attendance rate': 'attendance', 'class entries': 'entries', 'completed finals': 'finals',
    'adjusted avg overall': 'average', 'best overall': 'best', 'top-five finishes': 'topFive', 'podiums': 'podiums',
    'overall wins': 'wins', 'a-final appearances': 'aFinals', 'performance score': 'performance', 'pace': 'pace',
    'crating': 'cRating', 'average qualifying': 'qualifying', 'adjusted consistency': 'consistency',
    'best run consistency': 'bestConsistency', 'runs at 95%+': 'highConsistency', 'avg lap-time gap': 'lapGap',
    'recorded runs': 'runs', 'completed laps': 'laps', 'time on track': 'trackTime', 'sword / club events': 'eventTypes'
  };
  const inferred = description
    || (lower.includes('pace') ? metricDescriptions.pace : '')
    || (lower.includes('crating') || lower.includes('cobra rating') ? metricDescriptions.cRating : '')
    || (lower.includes('performance') ? metricDescriptions.performance : '')
    || (lower.includes('consistency') ? metricDescriptions.consistency : '')
    || (lower.includes('average qualifying') ? metricDescriptions.qualifyingAverage : '')
    || (lower.includes('fastest') ? metricDescriptions.fastestLap : '')
    || (lower.includes('final') ? metricDescriptions.finals : '')
    || (lower.includes('lap') ? metricDescriptions.laps : '')
    || (lower.includes('distance') ? metricDescriptions.distance : '')
    || (lower.includes('track time') ? metricDescriptions.trackTime : '')
    || 'Calculated from the records that match the current date, event and class filters.';
  const key = evidenceKeys[lower];
  const body = `<strong>${key === 'cRating' ? metricHelpHtml(ratingTextHtml(value), value, inferred, label) : metricHelp(value, inferred, label)}</strong><span>${escapeHtml(label)}</span>`;
  return key
    ? `<article class="profile-stat-expandable"><button type="button" class="profile-stat-button" data-profile-evidence="${key}" data-profile-label="${escapeHtml(label)}" aria-expanded="false">${body}</button></article>`
    : `<article>${body}</article>`;
}

function renderProfileMetricEvidence(key, label) {
  const panel = $('driverMetricEvidence');
  const evidence = state.profileEvidence;
  if (!panel || !evidence) return;
  const active = panel.dataset.metric === key && !panel.hidden;
  $('driverProfileStats').querySelectorAll('[data-profile-evidence]').forEach(button => button.setAttribute('aria-expanded', String(!active && button.dataset.profileEvidence === key)));
  if (active) { panel.hidden = true; panel.classList.remove('fullscreen'); panel.dataset.metric = ''; return; }
  const { data, driverKey, entries, results, runs, ratingSummary } = evidence;
  const eventFilters = {
    finals: () => true, topFive: row => row[4] <= 5, podiums: row => row[4] <= 3, wins: row => row[4] === 1,
    aFinals: row => /^A-(?:Main|Final)$/i.test(row[7] || ''), best: row => row[4] === Math.min(...results.map(item => item[4]))
  };
  const eventMetric = ['events','attendance','entries','eventTypes','finals','average','best','topFive','podiums','wins','aFinals','performance','qualifying'].includes(key);
  let content = '';
  if (key === 'cRating') {
    const rows = ratingSummary?.meetings || [];
    const rowHtml = rows.map(meeting => {
      const event = data.eventById?.[meeting.eventId];
      const eventName = event?.u ? `<a href="${escapeHtml(event.u)}" target="_blank" rel="noopener">${escapeHtml(meeting.name)}</a>` : escapeHtml(meeting.name);
      return `<tr><td>${dateFmt.format(new Date(`${meeting.date}T12:00:00Z`))}</td><td>${eventName}</td><td>${meeting.races}</td><td>${formatRating(meeting.before)}</td><td><strong>${ratingChangeHtml(meeting.change)}</strong></td><td>${formatRating(meeting.after)}</td></tr>`;
    }).join('');
    content = `<p class="metric-evidence-note">Every driver starts at 1,500. Qualifying heats and finals move the rating according to direct opponents, finishing position, lap pace and field strength; practice is excluded and finals carry more weight. The bracketed figure is the latest meeting change.</p><div class="table-wrap compact"><table><thead><tr><th>Date</th><th>Event</th><th>Races</th><th>Start</th><th>Change</th><th>End</th></tr></thead><tbody>${rowHtml || '<tr><td colspan="6">No linked rated races.</td></tr>'}</tbody></table></div>`;
  } else if (eventMetric) {
    const useEntries = ['events','attendance','entries','eventTypes'].includes(key);
    let rows = useEntries ? entries.map(entry => {
      const result = results.find(item => item[0] === entry[0] && item[2] === entry[2]);
      return { eventId: entry[0], date: entry[1], cls: entry[2], position: result?.[4], qualifying: result?.[5], final: result?.[7] };
    }) : results.filter(eventFilters[key] || (() => true)).map(result => ({ eventId: result[0], date: result[1], cls: result[2], position: result[4], qualifying: result[5], final: result[7] }));
    rows.sort((a, b) => b.date.localeCompare(a.date) || a.cls.localeCompare(b.cls));
    const rowHtml = rows.map(row => {
      const event = data.eventById[row.eventId];
      const eventName = event?.u ? `<a href="${escapeHtml(event.u)}" target="_blank" rel="noopener">${escapeHtml(event.n)}</a>` : escapeHtml(event?.n || row.eventId);
      const eventRuns = runs.filter(run => {
        const race = data.raceById[run[0]];
        return race?.e === row.eventId && race.c === row.cls;
      }).sort((a, b) => {
        const raceA = data.raceById[a[0]];
        const raceB = data.raceById[b[0]];
        return Number(raceB.f) - Number(raceA.f) || raceA.r.localeCompare(raceB.r) || raceA.n.localeCompare(raceB.n);
      });
      const raceLabel = `${eventRuns.length} race${eventRuns.length === 1 ? '' : 's'}`;
      const eventRow = `<tr class="profile-evidence-event-row" tabindex="0" role="button" aria-expanded="false" aria-label="Show ${escapeHtml(raceLabel)} for ${escapeHtml(event?.n || row.eventId)}"><td>${dateFmt.format(new Date(`${row.date}T12:00:00Z`))}</td><td>${eventName}</td><td><button type="button" class="driver-races-toggle" aria-expanded="false">${raceLabel}</button></td><td>${escapeHtml(row.cls)}</td><td>${row.position ? `P${row.position}` : '—'}</td><td>${row.qualifying ? `P${row.qualifying}` : '—'}</td><td>${escapeHtml(row.final || '—')}</td></tr>`;
      return `${eventRow}${profileRaceDetail(eventRuns, driverKey, data, 7)}`;
    }).join('');
    content = `<div class="table-wrap compact"><table><thead><tr><th>Date</th><th>Event</th><th>Races</th><th>Class</th><th>Overall</th><th>Qual</th><th>Final</th></tr></thead><tbody>${rowHtml || '<tr><td colspan="7">No matching event records.</td></tr>'}</tbody></table></div>`;
  } else {
    let rows = runs.slice();
    if (key === 'consistency' || key === 'lapGap') rows = rows.filter(run => isCompleteConsistencyRun(run, data));
    if (key === 'highConsistency') rows = rows.filter(run => isCompleteConsistencyRun(run, data) && Number.parseFloat(run[7]) >= 95);
    if (key === 'bestConsistency') {
      const best = Math.max(...rows.map(run => Number.parseFloat(run[7])).filter(Number.isFinite));
      rows = rows.filter(run => Number.parseFloat(run[7]) === best);
    }
    rows.sort((a, b) => (data.raceById[b[0]]?.d || '').localeCompare(data.raceById[a[0]]?.d || ''));
    const rowHtml = rows.map(run => {
      const race = data.raceById[run[0]];
      const raceName = race ? `${escapeHtml(race.r)} · ${escapeHtml(race.n)}` : escapeHtml(run[0]);
      const pace = paceForRun(run, data);
      const consistency = Number.parseFloat(run[7]);
      const change = driverRatingSummary(driverKey, data, filters().className).raceChanges.get(run[0])?.change;
      const rowLabel = race ? `${race.r} ${race.n}` : run[0];
      return `<tr class="driver-run-row" data-race-id="${escapeHtml(run[0])}" data-driver-key="${escapeHtml(driverKey)}" tabindex="0" role="button" aria-expanded="false" aria-label="Show complete lap result for ${escapeHtml(rowLabel)}"><td>${race ? dateFmt.format(new Date(`${race.d}T12:00:00Z`)) : '—'}</td><td><strong>${raceName}</strong></td><td>P${run[2]}</td><td>${escapeHtml(run[3] || '—')}</td><td>${escapeHtml(run[5] || '—')}</td><td>${escapeHtml(run[6] || '—')}</td><td>${Number.isFinite(consistency) && consistency >= 0 && consistency <= 100 ? `${consistency.toFixed(2)}%` : '—'}</td><td>${pace === null ? '—' : `${pace.toFixed(1)}%`}</td><td>${ratingChangeHtml(change)}</td></tr><tr class="driver-run-detail-row" hidden><td colspan="9"></td></tr>`;
    }).join('');
    content = `<div class="table-wrap compact"><table><thead><tr><th>Date</th><th>Race</th><th>Pos</th><th>Laps/time</th><th>Best</th><th>Average</th><th>Consistency</th><th>Pace</th><th title="cRating gained from this run">Gain</th></tr></thead><tbody>${rowHtml || '<tr><td colspan="9">No matching race records.</td></tr>'}</tbody></table></div>`;
  }
  panel.dataset.metric = key;
  panel.classList.remove('fullscreen');
  panel.innerHTML = `<div class="profile-metric-evidence-heading"><div><p class="eyebrow">Metric evidence</p><h3>Where ${escapeHtml(label)} comes from</h3></div><div class="profile-metric-evidence-actions"><button type="button" class="profile-metric-evidence-fullscreen" aria-pressed="false">Full screen</button><button type="button" class="profile-metric-evidence-close" aria-label="Close metric evidence">×</button></div></div>${content}`;
  panel.hidden = false;
  prefetchDriverRunDetails(panel);
  panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function distanceJourneyStat(runs, driverKey) {
  if (journeyExcludedDrivers.has(driverKey)) return '';
  const km = Number((totalLaps(runs) * 0.15).toFixed(1));
  const miles = kmToMiles(km);
  return `<article class="journey-stat"><button type="button" class="journey-map-button" data-journey-driver="${escapeHtml(driverKey)}" aria-label="Show ${fmt.format(miles)} mile career road journey on map"><strong>${fmt.format(miles)} miles</strong><span>Total distance since Jan 2022 · open road map</span></button></article>`;
}

function geoKm(a, b) {
  const rad = Math.PI / 180;
  const lat1 = a[0] * rad;
  const lat2 = b[0] * rad;
  const dLat = (b[0] - a[0]) * rad;
  const dLon = (b[1] - a[1]) * rad;
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

const journeyRouteAt=createDistanceRoute(journeyRoadRoute,journeyRoadDistanceKm);

function journeyRoundOrder(round) {
  const text = String(round || '');
  const number = Number(text.match(/\d+/)?.[0]) || 0;
  if (/practice/i.test(text)) return number;
  if (/qualif/i.test(text)) return 10 + number;
  if (/main|final/i.test(text)) return 30 + number;
  return 20 + number;
}

// LiveRC supplies a date and round, but no dependable start time. Assign each
// event's rounds consecutive slots within its day without claiming real times.
function buildJourneyRoundSlots() {
  const groups = new Map();
  for (const [id, race] of Object.entries(state.data.raceById)) {
    if (race.d < '2022-01-01') continue;
    const key = `${race.d}|${race.e}`;
    if (!groups.has(key)) groups.set(key, new Map());
    const rounds = groups.get(key);
    const name = race.r || race.n || 'Round';
    if (!rounds.has(name)) rounds.set(name, []);
    rounds.get(name).push(id);
  }
  const slots = new Map();
  for (const [key, rounds] of groups) {
    const [date] = key.split('|');
    const ordered = [...rounds].sort(([a], [b]) => journeyRoundOrder(a) - journeyRoundOrder(b) || a.localeCompare(b));
    const first = Date.parse(`${date}T09:00:00Z`);
    const slotLength = 9 * 3600000 / ordered.length;
    ordered.forEach(([name, ids], index) => {
      const start = first + slotLength * index;
      const end = first + slotLength * (index + 1);
      for (const id of ids) slots.set(id, { start, end, date, name });
    });
  }
  return slots;
}

const journeyMilestoneData = journeyRoadMilestones;

function journeyDriverDistances(cutoffTime = Infinity, raceStarts = null, elapsedDays = 0) {
  const stats = new Map();
  for (const run of state.data.raceResults) {
    const race = state.data.raceById[run[0]];
    if (!race || journeyExcludedDrivers.has(run[1]) || race.d < '2022-01-01') continue;
    const slot = journeyRoundSlots.get(run[0]);
    if (!slot) continue;
    const first = raceStarts?.get(run[1]);
    if (raceStarts && first === undefined) continue;
    const now = raceStarts ? first + elapsedDays * 86400000 : cutoffTime;
    const progress = Math.max(0, Math.min(1, (now - slot.start) / (slot.end - slot.start)));
    if (!progress) continue;
    if (!stats.has(run[1])) stats.set(run[1], { laps: 0, runs: 0, events: new Set(), classes: new Set(), lastDate: '', lastEventId: '' });
    const row = stats.get(run[1]);
    row.laps += completedLaps(run) * progress;
    if (progress === 1) row.runs += 1;
    row.events.add(race.e);
    row.classes.add(race.c);
    if (race.d >= row.lastDate) {
      row.lastDate = race.d;
      row.lastEventId = race.e;
    }
  }
  return [...stats].map(([driverKey, row]) => ({
    driverKey,
    name: state.data.driverByKey[driverKey] || driverKey,
    km: row.laps * 0.15,
    laps: Math.floor(row.laps),
    runs: row.runs,
    events: row.events.size,
    classes: [...row.classes],
    lastDate: row.lastDate,
    lastEvent: state.data.eventById[row.lastEventId]?.n || ''
  })).filter(driver => driver.km > 0);
}

function buildJourneySmoothTracks() {
  const grouped=new Map();
  for (const run of state.data.raceResults) {
    const race=state.data.raceById[run[0]], slot=journeyRoundSlots.get(run[0]);
    if (!race || !slot || race.d<'2022-01-01' || journeyExcludedDrivers.has(run[1])) continue;
    if (!grouped.has(run[1])) grouped.set(run[1],[]);
    grouped.get(run[1]).push({start:slot.start,time:slot.end,km:completedLaps(run)*.15,race});
  }
  for (const rows of grouped.values()) {
    rows.sort((a,b)=>a.time-b.time);
    let total=0;
    for (const row of rows) { total+=row.km; row.total=total; }
  }
  return grouped;
}

// Playback is a compressed journey through several seasons. Spread each
// driver's next recorded distance over the gap from their previous run so a
// car does not stop merely because another class has the current checkpoint.
// Every car still lands on its exact recorded cumulative total at each run.
function journeyDriverDistancesSmoothed(cutoffTime, raceStarts=null, elapsedDays=0) {
  journeySmoothTracks ||= buildJourneySmoothTracks();
  const result=[];
  for (const [driverKey,rows] of journeySmoothTracks) {
    if (!rows.length) continue;
    const first=raceStarts?.get(driverKey);
    if (raceStarts && first===undefined) continue;
    const now=raceStarts ? first+elapsedDays*86400000 : cutoffTime;
    if (now<rows[0].start) continue;
    let index=rows.findIndex(row=>row.time>=now);
    if (index<0) index=rows.length-1;
    let groupStart=index;
    while(groupStart>0 && rows[groupStart-1].time===rows[index].time) groupStart--;
    while(index+1<rows.length && rows[index+1].time===rows[index].time) index++;
    const next=rows[index], previous=groupStart ? rows[groupStart-1] : {time:rows[0].start,total:0};
    const fraction=next.time===previous.time ? 1 : Math.max(0,Math.min(1,(now-previous.time)/(next.time-previous.time)));
    const km=previous.total+(next.total-previous.total)*fraction;
    if (km<=0) continue;
    const completed=rows.filter(row=>row.time<=now);
    const latest=completed.at(-1) || next;
    result.push({driverKey,name:state.data.driverByKey[driverKey] || driverKey,km,laps:Math.floor(km/.15),runs:completed.length,
      events:new Set(completed.map(row=>row.race.e)).size,classes:[...new Set(completed.map(row=>row.race.c))],lastDate:latest.race.d,lastEvent:state.data.eventById[latest.race.e]?.n || ''});
  }
  return result;
}

function stopJourneyPlayback() {
  if (journeyPlaybackTimer) cancelAnimationFrame(journeyPlaybackTimer);
  journeyPlaybackTimer = null;
  if ($('journeyPlay')) $('journeyPlay').textContent = '▶ Play journey';
}

function leaveJourneyFullscreen() {
  const overlay = $('journeyMapOverlay');
  journeyMapFullscreen = false;
  overlay?.classList.remove('fullscreen', 'needs-standalone');
  if ($('journeyFullscreen')) $('journeyFullscreen').textContent = 'Full screen';
  if (document.fullscreenElement === overlay) document.exitFullscreen().catch(() => {});
}

function buildJourneyTimeline(endDate, driverKeys = null) {
  const startMs = Date.parse('2022-01-01T00:00:00Z');
  const endMs = Math.max(startMs, Date.parse(`${endDate}T20:00:00Z`));
  const frames = new Map();
  let first = Infinity;
  for (const run of state.data.raceResults) {
    if (completedLaps(run)<=0 || journeyExcludedDrivers.has(run[1]) || (driverKeys && !driverKeys.has(run[1]))) continue;
    const slot=journeyRoundSlots.get(run[0]);
    if(slot && slot.start>=startMs && slot.end<=endMs){
      first=Math.min(first,slot.start);
      frames.set(slot.end,{time:slot.end,round:slot.name});
    }
  }
  // A single starting point and recorded endpoints avoid idle gaps between rounds.
  if(Number.isFinite(first)) frames.set(first,{time:first,round:''});
  return frames.size ? [...frames.values()].sort((a,b)=>a.time-b.time) : [{time:startMs,round:''}];
}

function journeyCutoffDate() {
  return journeyTimelineDates[Number($('journeyDateSlider').value)] || journeyTimelineDates.at(-1) || { time: Date.now(), round: '' };
}

function updateJourneyDateLabel(raceMode = journeyRaceMode()) {
  if (raceMode) {
    $('journeyDateLabel').textContent = `Checkpoint ${Number($('journeyDateSlider').value) + 1} / ${journeyRaceTimeline.length}`;
    return;
  }
  const cutoff = journeyCutoffDate();
  const date = new Date(cutoff.time).toISOString().slice(0, 10);
  $('journeyDateLabel').textContent = journeyMonthFmt.format(new Date(`${date}T12:00:00Z`));
}

function journeyRaceStarts() {
  const starts = new Map();
  const ends = new Map();
  for (const run of state.data.raceResults) {
    if (!journeySelectedKeys.has(run[1])) continue;
    const day = state.data.raceById[run[0]]?.d;
    if (!day || day < '2022-01-01') continue;
    const slot = journeyRoundSlots.get(run[0]);
    if (!slot) continue;
    starts.set(run[1], Math.min(starts.get(run[1]) ?? slot.start, slot.start));
    ends.set(run[1], Math.max(ends.get(run[1]) ?? slot.end, slot.end));
  }
  const days = Math.max(1, ...[...starts].map(([key, first]) => Math.ceil((ends.get(key) - first) / 86400000) + 1));
  return { starts, days };
}

function buildJourneyRaceTimeline({ starts, days }) {
  const frames = [0];
  for (const run of state.data.raceResults) {
    const first = starts.get(run[1]);
    const slot = journeyRoundSlots.get(run[0]);
    if (first === undefined || !slot || completedLaps(run)<=0) continue;
    frames.push((slot.end - first) / 86400000);
  }
  return [...new Set(frames.map(value => Math.max(0, Math.min(days, value)).toFixed(7)))].map(Number).sort((a, b) => a - b);
}

function journeyRaceMode() {
  return $('journeyPlaybackMode')?.value === 'race' && journeySelectedKeys.size > 0;
}

function updateJourneyMode() {
  stopJourneyPlayback();
  journeyPlaybackHasStarted = false;
  journeyPlaybackPosition = null;
  journeyMotionCache = null;
  const race = journeyRaceMode();
  journeyRaceTimeline = race ? buildJourneyRaceTimeline(journeyRaceStarts()) : [];
  $('journeyPlaybackStart').disabled = race;
  $('journeyStartDate').disabled = race || $('journeyPlaybackStart').value !== 'chosen';
  $('journeyDateSlider').max = race ? String(journeyRaceTimeline.length - 1) : String(journeyTimelineDates.length - 1);
  $('journeyDateSlider').value = $('journeyDateSlider').max;
  if ($('journeyPlaybackMode').value === 'race' && !journeySelectedKeys.size) {
    $('journeyPlay').disabled = true;
    $('journeyDateLabel').textContent = 'Select drivers to race';
  } else {
    $('journeyPlay').disabled = false;
    renderJourneyMap();
  }
}

// Cache the two recorded snapshots surrounding the playhead. The map moves
// through the distance between them on every animation frame, even where the
// calendar has no racing dates to display on the slider.
function journeyDriversAtPosition(raceMode) {
  const timeline = raceMode ? journeyRaceTimeline : journeyTimelineDates;
  const last = Math.max(0, timeline.length - 1);
  const position = Math.max(0, Math.min(last, journeyPlaybackPosition ?? Number($('journeyDateSlider').value)));
  const before = Math.floor(position);
  const after = Math.min(last, before + 1);
  const cacheKey = `${raceMode ? 'race' : 'dates'}:${before}:${after}:${[...journeySelectedKeys].sort().join(',')}`;
  if (journeyMotionCache?.key !== cacheKey) {
    const starts = raceMode ? journeyRaceStarts().starts : null;
    const smooth=journeyPlaybackHasStarted;
    const distanceAt = index => raceMode
      ? (smooth ? journeyDriverDistancesSmoothed(Infinity,starts,timeline[index] ?? 0) : journeyDriverDistances(Infinity, starts, timeline[index] ?? 0))
      : (smooth ? journeyDriverDistancesSmoothed(timeline[index]?.time ?? Infinity) : journeyDriverDistances(timeline[index]?.time ?? Infinity));
    const earlier = distanceAt(before);
    const later = after === before ? earlier : distanceAt(after);
    journeyMotionCache = { key: cacheKey, earlier: new Map(earlier.map(driver => [driver.driverKey, driver])), later: new Map(later.map(driver => [driver.driverKey, driver])) };
  }
  const fraction = position - before;
  const result = [];
  for (const [key, later] of journeyMotionCache.later) {
    const earlier = journeyMotionCache.earlier.get(key);
    const km = (earlier?.km ?? 0) + (later.km - (earlier?.km ?? 0)) * fraction;
    if (km > 0) result.push({ ...(fraction >= 1 ? later : earlier || later), km });
  }
  return result;
}

function updateJourneyMovingMarkers() {
  updateJourneyDateLabel();
  if (!journeyMap) return;
  const raceMode = journeyRaceMode();
  const drivers = journeyDriversAtPosition(raceMode);
  const wanted = journeySelectedKeys.size ? drivers.filter(d=>journeySelectedKeys.has(d.driverKey)) : trackerDrivers(drivers,journeyRecentKeys,journeyAvatarImages,journeySelectedKey);
  // Add drivers as their first recorded run enters the timeline, without a zoom.
  if(wanted.some(d=>!journeyDriverMarkers.has(d.driverKey))) renderJourneyMap();
  for (const driver of drivers) {
    const marker = journeyDriverMarkers.get(driver.driverKey);
    if (!marker || Math.abs(driver.km - (journeyLastMotionKm.get(driver.driverKey) ?? -1)) < .001) continue;
    marker.setLatLng(journeyRouteAt(driver.km,false).point);
    journeyLastMotionKm.set(driver.driverKey, driver.km);
    marker.setTooltipContent(`<b>${fmt.format(kmToMiles(driver.km))} miles</b><br>${escapeHtml(driver.name)}`);
    marker.setPopupContent(`<div class="journey-driver-popup"><b>${escapeHtml(driver.name)}</b><strong>${fmt.format(kmToMiles(driver.km))} miles</strong><span>${fmt.format(driver.laps)} laps · ${driver.events} events · ${driver.runs} runs</span><span>${driver.classes.map(cls=>classLabels[cls]||cls).map(escapeHtml).join(', ')}</span>${driver.lastEvent ? `<small>Latest: ${escapeHtml(driver.lastEvent)} · ${dateFmt.format(new Date(`${driver.lastDate}T12:00:00Z`))}</small>` : ''}</div>`);
  }
  const key = raceMode && !journeySelectedKeys.has(journeySelectedKey) ? [...journeySelectedKeys][0] : journeySelectedKey;
  const selected = drivers.find(driver => driver.driverKey === key);
  if (!selected) return;
  if(!raceMode) $('journeyMapTitle').textContent=`${selected.name} — ${fmt.format(kmToMiles(selected.km))} miles`;
  if(raceMode) $('journeyRaceStandings').innerHTML=drivers.filter(d=>journeySelectedKeys.has(d.driverKey)).sort((a,b)=>b.km-a.km||a.name.localeCompare(b.name)).map((d,i)=>`<span><b>${i+1}.</b> ${escapeHtml(d.name)} <strong>${fmt.format(kmToMiles(d.km))} mi</strong></span>`).join('');
  const route = journeyRouteAt(selected.km);
  if (Math.abs(selected.km - (journeyLastMotionKm.get(`route:${key}`) ?? -1)) >= .005) {
    journeyTravelledLine?.setLatLngs(route.travelled);
    journeyLastMotionKm.set(`route:${key}`, selected.km);
  }
  if (journeyFollowSelected && journeyMap.getCenter().distanceTo(window.L.latLng(route.point)) > 150) {
    journeyMap.panTo(route.point, { animate: false });
  }
}

function renderJourneyMap({ resetView = false, focusDriver = false } = {}) {
  if (!window.L || !journeyMap) return;
  // Leaflet needs an initial centre and zoom before projecting driver positions.
  if (resetView) journeyMap.fitBounds(window.L.latLngBounds(journeyRoadRoute), { padding: [24, 24] });
  const raceMode = journeyRaceMode();
  journeyRaceElapsedDays = raceMode ? journeyRaceTimeline[Number($('journeyDateSlider').value)] ?? 0 : 0;
  const drivers = journeyDriversAtPosition(raceMode).sort((a, b) => b.km - a.km);
  const activeKey = raceMode && !journeySelectedKeys.has(journeySelectedKey) ? [...journeySelectedKeys][0] : journeySelectedKey;
  const allDriversView = !activeKey && !raceMode;
  const selectedName = state.data.driverByKey[activeKey] || 'Selected driver';
  const selected = drivers.find(driver => driver.driverKey === activeKey) || { driverKey: activeKey, name: selectedName, km: 0, laps: 0, runs: 0, events: 0, classes: [], lastDate: '', lastEvent: '' };
  if (!allDriversView && (journeyFollowSelected || focusDriver)) {
    const point = journeyRouteAt(selected.km,false).point;
    if (focusDriver && journeyMap.getZoom() < 8) journeyMap.setView(point, 8, { animate: false });
    else if (journeyMap.getCenter().distanceTo(window.L.latLng(point)) > 150) journeyMap.panTo(point, { animate: false });
  }
  updateJourneyDateLabel(raceMode);
  $('journeyMapTitle').textContent = raceMode ? `Race: ${journeySelectedKeys.size} drivers · ${Math.floor(journeyRaceElapsedDays)} career days` : allDriversView ? `All drivers — ${drivers.length} on the route` : `${selected.name} — ${fmt.format(kmToMiles(selected.km))} miles`;
  const routeStatus = selected.km > journeyRoadDistanceKm ? `They have reached Istanbul and covered a further ${fmt.format(kmToMiles(selected.km - journeyRoadDistanceKm))} miles.` : `Their pin shows the equivalent point reached along the saved road route.`;
  $('journeyMapCopy').textContent = raceMode ? `All selected drivers set off from Cardiff together. Their miles advance round by round from each driver's first recorded COBRA run in 2022 or later. All classes count.` : allDriversView ? 'Each pin shows a driver’s combined distance since January 2022. Click a car or pin to follow that driver, search by name, or play the journey through time.' : `Combined distance from every recorded practice, qualifying and final round since 1 January 2022. ${routeStatus} Click any pin for its driver summary, search for a driver, or play the journey through time.`;

  journeyMapLayers.clearLayers();
  journeyDriverMarkers = new Map();
  journeyLastMotionKm = new Map();
  window.L.polyline(journeyRoadRoute, { color: '#6f7972', weight: 5, opacity: .65 }).addTo(journeyMapLayers);
  const selectedRoute = journeyRouteAt(selected.km);
  journeyTravelledLine = allDriversView ? null : window.L.polyline(selectedRoute.travelled, { color: '#08a31a', weight: 7, opacity: .9 }).addTo(journeyMapLayers);

  for (const [name, km] of journeyMilestoneData) {
    const point = journeyRouteAt(km,false).point;
    window.L.circleMarker(point, { radius: 4, color: '#fff', weight: 1, fillColor: selected.km >= km ? '#08a31a' : '#778078', fillOpacity: 1 })
      .bindTooltip(`${escapeHtml(name)} · ${fmt.format(kmToMiles(km))} miles`, { direction: 'top' }).addTo(journeyMapLayers);
  }
  const nextMilestone = journeyMilestoneData.find(([, km]) => km > selected.km);
  $('journeyMilestones').innerHTML = journeyMilestoneData.map(([name, km]) => `<span class="${selected.km >= km ? 'reached' : nextMilestone?.[0] === name ? 'next' : ''}">${selected.km >= km ? '✓ ' : ''}${escapeHtml(name)} <small>${fmt.format(kmToMiles(km))} miles</small></span>`).join('');

  for (const driver of drivers) journeyAvatars.load(driver.driverKey);
  const displayedDrivers = journeySelectedKeys.size
    ? [...journeySelectedKeys].map(key => drivers.find(driver => driver.driverKey === key) || {
        driverKey: key, name: state.data.driverByKey[key] || key, km: 0, laps: 0, runs: 0,
        events: 0, classes: [], lastDate: '', lastEvent: ''
      })
    : trackerDrivers(drivers, journeyRecentKeys, journeyAvatarImages, activeKey);
  if (!journeySelectedKeys.size && !displayedDrivers.some(driver => driver.driverKey === journeySelectedKey) && drivers.some(driver => driver.driverKey === journeySelectedKey)) {
    displayedDrivers.push(drivers.find(driver => driver.driverKey === journeySelectedKey));
  }

  $('journeyRaceStandings').hidden = !raceMode;
  if (allDriversView && !raceMode) $('journeyMapTitle').textContent = `Driver tracker — ${displayedDrivers.length} drivers`;
  if (raceMode) $('journeyRaceStandings').innerHTML = displayedDrivers.slice().sort((a,b) => b.km - a.km || a.name.localeCompare(b.name))
    .map((driver,index) => `<span><b>${index+1}.</b> ${escapeHtml(driver.name)} <strong>${fmt.format(kmToMiles(driver.km))} mi</strong></span>`).join('');

  // Keep every eligible pin clickable. Reserve permanent names for labels that fit the map.
  const occupied = new Set();
  const mapWidth = journeyMap.getSize().x;
  const mapHeight = journeyMap.getSize().y;
  const candidates = displayedDrivers.slice().sort((left, right) => {
    if (left.driverKey === activeKey) return -1;
    if (right.driverKey === activeKey) return 1;
    const avatarPriority = Number(journeyAvatarImages.has(right.driverKey)) - Number(journeyAvatarImages.has(left.driverKey));
    if (avatarPriority) return avatarPriority;
    return ((hashJourneyKey(left.driverKey) + journeyLabelsSeed) % 7919) - ((hashJourneyKey(right.driverKey) + journeyLabelsSeed) % 7919);
  });
  const visibleLabels = new Set();
  const cellWidth = journeyMap.getZoom() < 6 ? 125 : 105;
  const cellHeight = journeyMap.getZoom() < 6 ? 58 : 44;
  for (const driver of candidates) {
    const xy = journeyMap.latLngToContainerPoint(journeyRouteAt(driver.km,false).point);
    if (xy.x < 0 || xy.x > mapWidth || xy.y < 0 || xy.y > mapHeight) continue;
    const cell = `${Math.floor(xy.x / cellWidth)},${Math.floor(xy.y / cellHeight)}`;
    if (!occupied.has(cell) || driver.driverKey === activeKey) {
      occupied.add(cell);
      visibleLabels.add(driver.driverKey);
    }
  }
  for (const driver of displayedDrivers) {
    const route = journeyRouteAt(driver.km,false);
    const selectedDriver = driver.driverKey === activeKey;
    journeyAvatars.load(driver.driverKey);
    const avatar = journeyAvatarImages.get(driver.driverKey);
    const mobileCar = avatar && window.matchMedia('(max-width: 700px)').matches;
    const icon = window.L.divIcon(avatar
      ? { className: `journey-driver-icon car-avatar${mobileCar ? ' car-avatar-mobile' : ''}`, html: `<img src="${avatar.src}" alt="">`, iconSize: mobileCar ? [84, 62] : [66, 50], iconAnchor: mobileCar ? [42, 54] : [33, 43] }
      : { className: 'journey-driver-icon', html: `<i class="${selectedDriver ? 'selected' : ''}"></i>`, iconSize: [18, 24], iconAnchor: [9, 21] });
    const classText = driver.classes.map(cls => classLabels[cls] || cls).join(', ');
    const lastEvent = driver.lastEvent ? `<small>Latest: ${escapeHtml(driver.lastEvent)} · ${dateFmt.format(new Date(`${driver.lastDate}T12:00:00Z`))}</small>` : '';
    const popup = `<div class="journey-driver-popup"><b>${escapeHtml(driver.name)}</b><strong>${fmt.format(kmToMiles(driver.km))} miles</strong><span>${fmt.format(driver.laps)} laps · ${driver.events} events · ${driver.runs} runs</span><span>${escapeHtml(classText)}</span>${lastEvent}</div>`;
    const marker = window.L.marker(route.point, { icon, zIndexOffset: selectedDriver ? 2000 : avatar ? 1000 : 0 })
      .bindTooltip(`<b>${fmt.format(kmToMiles(driver.km))} miles</b><br>${escapeHtml(driver.name)}`, { permanent: visibleLabels.has(driver.driverKey), direction: 'bottom', offset: [0, 12], className: `journey-driver-label${avatar ? ' avatar-priority' : ''}${selectedDriver ? ' selected' : ''}` })
      .bindPopup(popup).addTo(journeyMapLayers);
    marker.on('click', () => {
      journeySelectedKey = driver.driverKey;
      $('journeyDriverSearch').value = driver.name;
      journeyFollowSelected = true;
      $('journeyFollowStatus').textContent = 'Following selected driver';
      $('journeyRefocus').textContent = '⌖ Refocus on driver';
      renderJourneyMap({ focusDriver: true });
      journeyDriverMarkers.get(driver.driverKey)?.openPopup();
    });
    journeyDriverMarkers.set(driver.driverKey, marker);
  }
  window.L.circleMarker(journeyRoadRoute[0], { radius: 7, color: '#fff', weight: 2, fillColor: '#067b14', fillOpacity: 1 }).bindTooltip('House of Sport, Cardiff', { permanent: true, direction: 'bottom', offset: [0, 22], pane: 'journeySiteLabels' }).addTo(journeyMapLayers);
  window.L.circleMarker(journeyRoadRoute.at(-1), { radius: 7, color: '#fff', weight: 2, fillColor: '#17211a', fillOpacity: 1 }).bindTooltip('Istanbul, Türkiye', { permanent: true, direction: 'left' }).addTo(journeyMapLayers);
}

function hashJourneyKey(value) {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

function renderJourneyDriverChecklist() {
  const query = $('journeyPickerSearch').value.trim().toLowerCase();
  const drivers = state.data.drivers.filter(driver => !journeyExcludedDrivers.has(driver.k) && driver.n.toLowerCase().includes(query)).sort((a, b) => a.n.localeCompare(b.n));
  $('journeyDriverChecklist').innerHTML = drivers.map(driver => `<label><input type="checkbox" value="${escapeHtml(driver.k)}" ${journeySelectedKeys.has(driver.k) ? 'checked' : ''}> ${escapeHtml(driver.n)}</label>`).join('');
  $('journeyDriverSummary').textContent = journeySelectedKeys.size ? `Playback drivers (${journeySelectedKeys.size} selected)` : 'Playback drivers (last two years)';
  if ($('journeyPlaybackMode')?.value === 'race') $('journeyPlay').disabled = !journeySelectedKeys.size;
}

function selectedJourneyStart() {
  const choice = $('journeyPlaybackStart').value;
  if (choice === 'chosen') return $('journeyStartDate').value || '2022-01-01';
  if (choice === '2022' || !journeySelectedKeys.size) return '2022-01-01';
  return state.data.raceResults.filter(run => journeySelectedKeys.has(run[1]))
    .map(run => state.data.raceById[run[0]]?.d).filter(date => date && date >= '2022-01-01').sort()[0] || '2022-01-01';
}

function selectJourneyDriver() {
  const query = $('journeyDriverSearch').value.trim().toLowerCase();
  if (!query) return;
  const eligibleDrivers = state.data.drivers.filter(row => !journeyExcludedDrivers.has(row.k));
  const driver = eligibleDrivers.find(row => row.n.toLowerCase() === query) || eligibleDrivers.find(row => row.n.toLowerCase().includes(query));
  if (!driver) return;
  journeySelectedKey = driver.k;
  $('journeyDriverSearch').value = driver.n;
  journeyFollowSelected = true;
  $('journeyFollowStatus').textContent = 'Following selected driver';
  renderJourneyMap({ focusDriver: true });
}

function toggleJourneyPlayback() {
  if (journeyPlaybackTimer) {
    stopJourneyPlayback();
    return;
  }
  const slider = $('journeyDateSlider');
  const raceMode = journeyRaceMode();
  if(!raceMode && (!journeyPlaybackHasStarted || Number(slider.value)>=Number(slider.max))){
    const keys=journeySelectedKeys.size ? journeySelectedKeys : journeySelectedKey ? new Set([journeySelectedKey]) : null;
    const endDate=[state.data.meta.latestEventDate,...Object.values(state.data.raceById).map(r=>r.d)].filter(Boolean).sort().at(-1);
    journeyTimelineDates=buildJourneyTimeline(endDate,keys);
    slider.max=String(journeyTimelineDates.length-1);slider.value=slider.max;
    journeyMotionCache=null;
  }
  const start = raceMode ? '2022-01-01' : selectedJourneyStart();
  const startIndex = raceMode ? 0 : journeyTimelineDates.findIndex(frame => frame.time >= Date.parse(`${start}T00:00:00Z`));
  const configuredStart = Math.max(0, startIndex);
  if (!journeyPlaybackHasStarted || Number(slider.value) >= Number(slider.max)) {
    slider.value = String(configuredStart);
    journeyPlaybackPosition = configuredStart;
  }
  const last = Number(slider.max);
  const current = Math.max(0, Math.min(last, journeyPlaybackPosition ?? Number(slider.value)));
  journeyPlaybackHasStarted = true;
  journeyFollowSelected = true;
  $('journeyFollowStatus').textContent = 'Following selected driver';
  renderJourneyMap({ focusDriver: true });
  $('journeyPlay').textContent = '❚❚ Pause';
  const duration = Number($('journeySpeed').value);
  const origin = Math.min(configuredStart, current);
  const fullSteps = Math.max(1, last - origin);
  const remainingSteps = Math.max(0, last - current);
  const remainingDuration = duration * remainingSteps / fullSteps;
  const startedAt = performance.now();
  if (!remainingDuration) { stopJourneyPlayback(); journeyPlaybackHasStarted = false; return; }
  let lastMotionRender = 0;
  const animate = now => {
    const progress = Math.min(1, (now - startedAt) / remainingDuration);
    journeyPlaybackPosition = current + remainingSteps * progress;
    const next = Math.floor(journeyPlaybackPosition);
    slider.value = String(next);
    if (now - lastMotionRender >= 40 || progress === 1) {
      updateJourneyMovingMarkers();
      lastMotionRender = now;
    }
    // Clearing and rebuilding every Leaflet marker causes a visible jump.
    // Keep the same layers throughout playback and rebuild once at the end.
    if (progress === 1) {
      renderJourneyMap();
    }
    if (progress === 1) {
      stopJourneyPlayback();
      journeyPlaybackHasStarted = false;
      journeyPlaybackPosition = null;
    } else {
      journeyPlaybackTimer = requestAnimationFrame(animate);
    }
  };
  journeyPlaybackTimer = requestAnimationFrame(animate);
}

async function openJourneyMap(driverKey) {
  journeySelectedKey = driverKey;
  // Use the newest date from either source. The generated metadata and race
  // index normally agree, but choosing metadata first can strand the tracker
  // on an old meeting after a partial data refresh.
  const latestDate = [
    state.data.meta.latestEventDate,
    ...Object.values(state.data.raceById).map(race => race.d)
  ].filter(Boolean).sort().at(-1) || '2022-01-01';
  journeyRoundSlots = buildJourneyRoundSlots();
  journeySmoothTracks = null;
  journeyRecentKeys = recentJourneyDrivers(journeyDriverDistances());
  journeyTimelineDates = buildJourneyTimeline(latestDate);
  journeyMotionCache = null;
  journeyPlaybackPosition = null;
  const slider = $('journeyDateSlider');
  slider.max = String(Math.max(0, journeyTimelineDates.length - 1));
  // The resting tracker shows every driver's complete recorded distance.
  // Starting playback resets this to the configured beginning (February
  // 2022 by default) before the animation advances through the timeline.
  slider.value = slider.max;
  $('journeyDriverOptions').innerHTML = state.data.drivers.filter(driver => !journeyExcludedDrivers.has(driver.k)).sort((a, b) => a.n.localeCompare(b.n)).map(driver => `<option value="${escapeHtml(driver.n)}"></option>`).join('');
  $('journeyDriverSearch').value = state.data.driverByKey[driverKey] || '';
  journeyLabelsSeed = Math.floor(Math.random() * 7919);
  renderJourneyDriverChecklist();
  $('journeyStartDate').max = latestDate;
  $('journeyPlaybackMode').value = 'calendar';
  $('journeyPlaybackStart').disabled = false;
  $('driverDialog').classList.add('journey-open');
  $('journeyMapOverlay').hidden = false;
  journeyFollowSelected = Boolean(driverKey);
  journeyPlaybackHasStarted = false;
  $('journeyFollowStatus').textContent = driverKey ? 'Following selected driver' : 'Showing the full route';
  $('journeyRefocus').textContent = driverKey ? '⌖ Refocus on driver' : '⌖ Show full route';
  $('journeyMapOverlay').querySelector('.journey-map-shell').scrollTop = 0;
  stopJourneyPlayback();
  try {
    if (!journeyMap) $('journeyMap').textContent = 'Loading road map…';
    await loadMap();
  } catch (error) {
    $('journeyMap').textContent = error.message;
    return;
  }
  if ($('journeyMapOverlay').hidden) return;
  requestAnimationFrame(() => {
    if (!journeyMap) {
      $('journeyMap').textContent = '';
      journeyMap = window.L.map('journeyMap', { zoomControl: true, scrollWheelZoom: true, wheelPxPerZoomLevel: 80, zoomSnap: .5 });
      // Keep the start label behind car markers (markerPane is z-index 600).
      const siteLabelsPane = journeyMap.createPane('journeySiteLabels');
      siteLabelsPane.style.zIndex = '550';
      siteLabelsPane.style.pointerEvents = 'none';
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(journeyMap);
      journeyMapLayers = window.L.layerGroup().addTo(journeyMap);
      journeyMap.fitBounds(window.L.latLngBounds(journeyRoadRoute), { padding: [24, 24] });
      journeyMap.on('zoomend', () => renderJourneyMap());
      journeyMap.on('dragstart', () => {
        journeyFollowSelected = false;
        $('journeyFollowStatus').textContent = 'Map moved · tap Refocus to follow';
      });
    }
    renderJourneyMap({ resetView: false });
    setTimeout(() => {
      journeyMap.invalidateSize();
      renderJourneyMap({ focusDriver: Boolean(driverKey) });
    }, 50);
  });
}

function recentJourneyDrivers(drivers, today = new Date()) {
  const cutoff = new Date(today);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 2);
  const date = cutoff.toISOString().slice(0,10);
  return new Set(drivers.filter(driver => driver.lastDate >= date).map(driver => driver.driverKey));
}

function completedLaps(run) {
  const match = String(run[3] || '').match(/^(\d+)\//);
  return match ? Number(match[1]) : 0;
}

function lapTimeSeconds(value) {
  const text = String(value ?? '').trim();
  const clock = text.match(/^(\d+):(\d{2}(?:\.\d+)?)(?:\s|$)/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  return Number.parseFloat(text);
}

function runTimeSeconds(run) {
  const value = String(run[3] || '');
  const separator = value.indexOf('/');
  if (separator < 0) return 0;
  const time = value.slice(separator + 1);
  const minutesAndSeconds = time.match(/^(\d+):(\d+(?:\.\d+)?)/);
  if (minutesAndSeconds) return Number(minutesAndSeconds[1]) * 60 + Number(minutesAndSeconds[2]);
  const seconds = Number.parseFloat(time);
  return Number.isFinite(seconds) ? seconds : 0;
}

function isCompleteConsistencyRun(run, data = state.data) {
  const race = data?.raceById?.[run[0]];
  const scheduledSeconds = Number(race?.l) || 0;
  return scheduledSeconds > 0 && completedLaps(run) >= 5 && runTimeSeconds(run) >= scheduledSeconds;
}

function totalLaps(runs) {
  return runs.reduce((total, run) => total + completedLaps(run), 0);
}

function distanceRaced(runs) {
  return `${fmt.format(kmToMiles(totalLaps(runs) * 0.15))} miles`;
}

function trackTime(runs) {
  const minutes = Math.round(runs.reduce((total, run) => total + runTimeSeconds(run), 0) / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function trendRangeCutoff(points, range) {
  if (range === 'all' || !points.length) return '';
  const latest = new Date(`${points.at(-1).date}T12:00:00Z`);
  latest.setUTCMonth(latest.getUTCMonth() - Number(range || 12));
  return latest.toISOString().slice(0, 10);
}

function trendChartHtml(points, { ariaLabel, suffix = '', benchmark = null } = {}) {
  if (!points.length) return '<p class="consistency-trend-empty">No eligible results in this date range.</p>';
  const values = points.map(point => point.value);
  const width = 760, height = 300, left = 58, right = 24, top = 24, bottom = 56;
  let min = Math.floor(Math.min(...values, Number.isFinite(benchmark) ? benchmark : Infinity) - 2);
  let max = Math.ceil(Math.max(...values, Number.isFinite(benchmark) ? benchmark : -Infinity) + 2);
  if (max - min < 8) { const centre = (min + max) / 2; min = Math.floor(centre - 4); max = Math.ceil(centre + 4); }
  const x = index => points.length === 1 ? (left + width - right) / 2 : left + index / (points.length - 1) * (width - left - right);
  const y = value => top + (max - value) / Math.max(1, max - min) * (height - top - bottom);
  const rolling = points.map((point, index) => average(points.slice(Math.max(0, index - 2), index + 1).map(item => item.value)));
  const ticks = Array.from({ length: 5 }, (_, index) => min + (max - min) * index / 4);
  const grid = ticks.map(value => `<line x1="${left}" x2="${width - right}" y1="${y(value)}" y2="${y(value)}"/><text x="${left - 9}" y="${y(value) + 4}" text-anchor="end">${value.toFixed(suffix ? 1 : 0)}${suffix}</text>`).join('');
  const every = Math.max(1, Math.ceil(points.length / 5));
  const labels = points.map((point, index) => (index === 0 || index === points.length - 1 || index % every === 0) ? `<text x="${x(index)}" y="${height - 21}" text-anchor="middle">${escapeHtml(point.date.slice(0, 7))}</text>` : '').join('');
  const line = points.map((point, index) => `${x(index)},${y(point.value)}`).join(' ');
  const rollingLine = rolling.map((value, index) => `${x(index)},${y(value)}`).join(' ');
  const circles = points.map((point, index) => `<circle tabindex="0" role="img" aria-label="${escapeHtml(point.name)}, ${point.value.toFixed(1)}${suffix}" cx="${x(index)}" cy="${y(point.value)}" r="5"><title>${escapeHtml(point.name)} · ${dateFmt.format(new Date(`${point.date}T12:00:00Z`))} · ${point.value.toFixed(1)}${suffix}</title></circle>`).join('');
  const sample = Math.min(3, values.length);
  const delta = average(values.slice(-sample)) - average(values.slice(0, sample));
  const baseline = Number.isFinite(benchmark) ? `<line class="${benchmark === 1500 ? 'crating-baseline' : 'pace-benchmark'}" x1="${left}" x2="${width - right}" y1="${y(benchmark)}" y2="${y(benchmark)}"/>` : '';
  return `<div class="consistency-trend-summary"><strong>${delta > .1 ? 'Improving' : delta < -.1 ? 'Lower recently' : 'Broadly level'}</strong><span>${delta >= 0 ? '+' : ''}${delta.toFixed(1)}${suffix} from the opening to latest three-event average</span><span>${points.length} meeting${points.length === 1 ? '' : 's'} shown</span></div><div class="consistency-trend-scroll" tabindex="0" role="region" aria-label="${escapeHtml(ariaLabel || 'Driver trend')}"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(ariaLabel || 'Driver trend')}"><g class="consistency-trend-grid">${grid}${labels}</g>${baseline}<polyline class="consistency-trend-line" points="${line}"/><polyline class="consistency-trend-average" points="${rollingLine}"/><g class="consistency-trend-points">${circles}</g></svg></div><div class="consistency-trend-legend"><span><i></i>Meeting value</span><span><i></i>Rolling three-meeting average</span></div>`;
}

function renderDriverTrends() {
  const profile = state.profileEvidence;
  if (!profile) return;
  const range = $('driverTrendRange')?.value || '12';
  const grouped = new Map();
  for (const run of profile.runs) {
    const race = profile.data.raceById[run[0]];
    if (!race) continue;
    const key = `${race.d}|${race.e}`;
    if (!grouped.has(key)) grouped.set(key, { date: race.d, eventId: race.e, paces: [], consistencies: [] });
    const group = grouped.get(key);
    const pace = paceForRun(run, profile.data);
    if (Number.isFinite(pace)) group.paces.push(pace);
    if (isCompleteConsistencyRun(run, profile.data)) {
      const consistency = Number.parseFloat(run[7]);
      if (Number.isFinite(consistency)) group.consistencies.push(consistency);
    }
  }
  const eventName = eventId => profile.data.eventById[eventId]?.n || eventId;
  const allPace = [...grouped.values()].filter(group => group.paces.length).map(group => ({ date: group.date, name: eventName(group.eventId), value: average(group.paces) })).sort((a, b) => a.date.localeCompare(b.date));
  const allConsistency = [...grouped.values()].filter(group => group.consistencies.length).map(group => ({ date: group.date, name: eventName(group.eventId), value: average(group.consistencies) })).sort((a, b) => a.date.localeCompare(b.date));
  const paceCutoff = trendRangeCutoff(allPace, range);
  const consistencyCutoff = trendRangeCutoff(allConsistency, range);
  $('driverPaceTrendChart').innerHTML = trendChartHtml(allPace.filter(point => !paceCutoff || point.date >= paceCutoff), { ariaLabel: 'Race-relative pace over time', suffix: '%', benchmark: 100 });
  $('driverConsistencyTrendChart').innerHTML = trendChartHtml(allConsistency.filter(point => !consistencyCutoff || point.date >= consistencyCutoff), { ariaLabel: 'Consistency over time', suffix: '%' });
}

function setupCRatingClassOptions() {
  const profile = state.profileEvidence;
  const select = $('driverCRatingClass');
  if (!profile || !select) return;
  const classes = [...new Set(profile.careerRuns.map(run => profile.data.raceById[run[0]]?.c).filter(Boolean))].sort();
  const options = [];
  if (classes.some(cls => cls !== 'Junior Racers')) options.push(['senior', 'All senior classes']);
  for (const cls of classes) options.push([cls, classLabels[cls] || cls]);
  const wanted = profile.ratingSummary?.ratingClass || 'senior';
  select.innerHTML = options.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join('');
  if (options.some(([value]) => value === wanted)) select.value = wanted;
}

function renderCRatingTrend() {
  const profile = state.profileEvidence;
  if (!profile) return;
  const ratingClass = $('driverCRatingClass')?.value || profile.ratingSummary?.ratingClass || 'senior';
  const summary = driverRatingSummary(profile.driverKey, profile.data, ratingClass);
  let starts = 0;
  const points = summary.meetings.slice().reverse().map(meeting => {
    starts += meeting.races;
    return { date: meeting.date, name: meeting.name, value: confirmedRating(meeting.after, starts) };
  });
  if (!points.length) {
    $('driverCRatingChart').innerHTML = '<p class="consistency-trend-empty">No eligible qualifying heats or finals for this class.</p>';
    return;
  }
  $('driverCRatingChart').innerHTML = `<div class="crating-summary"><div><strong>${formatRating(summary.total)}</strong><span>Current</span></div><div><strong>${formatRating(Math.max(1500, ...points.map(point => point.value)))}</strong><span>Peak</span></div><div><strong>${summary.starts}</strong><span>Rated races</span></div><div><strong>${summary.starts < 20 ? 'Provisional' : 'Established'}</strong><span>Status</span></div></div>${trendChartHtml(points, { ariaLabel: 'cRating history', benchmark: 1500 })}`;
}

function driverProfile(driverKey) {
  const data = state.data;
  const driver = data.drivers.find(row => row.k === driverKey);
  if (!driver) return;
  const { from, to, eventType, className } = filters();
  const matches = (eventId, date, cls) => inRange(date, from, to) && eventMatches(eventId, eventType) && classMatches(cls, className);
  const entries = data.entries.filter(row => row[3] === driverKey && matches(row[0], row[1], row[2]));
  const results = data.eventResults.filter(row => row[3] === driverKey && isPublishedFinal(row) && matches(row[0], row[1], row[2]));
  const runs = data.raceResults.filter(row => {
    const race = data.raceById[row[0]];
    return row[1] === driverKey && race && matches(race.e, race.d, race.c);
  });
  const careerRuns = data.raceResults.filter(row => {
    const race = data.raceById[row[0]];
    return row[1] === driverKey && race && race.d >= '2022-01-01';
  });

  const fieldSizes = new Map();
  for (const row of data.eventResults) {
    if (!isPublishedFinal(row)) continue;
    const key = `${row[0]}|${row[2]}`;
    fieldSizes.set(key, (fieldSizes.get(key) || 0) + 1);
  }
  const performanceFor = row => {
    const size = fieldSizes.get(`${row[0]}|${row[2]}`) || 1;
    return size <= 1 ? 100 : Math.max(0, 100 * (size - row[4]) / (size - 1));
  };

  const positions = results.map(row => row[4]);
  const qualifying = results.map(row => Number(row[5])).filter(Number.isFinite).filter(value => value > 0);
  const consistencyRuns = runs.filter(row => isCompleteConsistencyRun(row, data));
  const consistencies = consistencyRuns.map(row => Number.parseFloat(row[7])).filter(Number.isFinite);
  const lapSpreads = consistencyRuns.map(row => lapTimeSeconds(row[6]) - lapTimeSeconds(row[5])).filter(value => Number.isFinite(value) && value >= 0);
  const uniqueEvents = new Set(entries.map(row => row[0]));
  const eligibleEventIds = new Set(data.events
    .filter(event => inRange(event.d, from, to) && eventMatches(event.i, eventType) && data.entries.some(row => row[0] === event.i && classMatches(row[2], className)))
    .map(event => event.i));
  const swordEvents = new Set(entries.filter(row => data.eventById[row[0]]?.t === 'sword').map(row => row[0]));
  const clubEvents = new Set(entries.filter(row => data.eventById[row[0]]?.t === 'club').map(row => row[0]));
  const topFive = positions.filter(value => value <= 5).length;
  const podiums = positions.filter(value => value <= 3).length;
  const wins = positions.filter(value => value === 1).length;
  const aFinals = results.filter(row => /^A-(?:Main|Final)$/i.test(row[7] || '')).length;
  const keptPositions = attendanceAdjustedResults(positions);
  const keptConsistencies = attendanceAdjustedResults(consistencies, true);
  const keptPaces = attendanceAdjustedResults(runs.map(run => paceForRun(run, data)).filter(Number.isFinite), true);
  const performance = combinedPerformanceScore(results.map(performanceFor), runs.map(run => paceForRun(run, data)).filter(Number.isFinite));
  const pace = average(keptPaces);
  const consistency = average(keptConsistencies);
  const ratingSummary = driverRatingSummary(driverKey, data, className);
  const careerResults = data.eventResults.filter(row => row[3] === driverKey && isPublishedFinal(row) && row[1] >= '2022-01-01');
  state.profileEvidence = { data, driverKey, entries, results, runs, careerResults, careerRuns, ratingSummary };
  if ($('driverMetricEvidence')) {
    $('driverMetricEvidence').hidden = true;
    $('driverMetricEvidence').dataset ||= {};
    $('driverMetricEvidence').dataset.metric = '';
  }

  const typeLabel = eventType === 'sword' ? 'SWORD' : eventType === 'club' ? 'Club Days' : eventType === 'other' ? 'Other official events' : 'All official events';
  const classLabel = className === 'senior' ? 'All senior classes' : (classLabels[className] || className || 'All classes');
  const fromLabel = from ? dateFmt.format(new Date(`${from}T12:00:00Z`)) : 'Beginning of archive';
  const toLabel = to ? dateFmt.format(new Date(`${to}T12:00:00Z`)) : 'Latest result';
  $('driverProfileName').textContent = `${driver.n}${driver.j ? ' — Junior' : ''}`;
  $('driverProfileContext').textContent = `${fromLabel} to ${toLabel} · ${typeLabel} · ${classLabel}`;
  renderProfileAvatar(driverKey);
  $('driverProfileStats').innerHTML = [
    profileStat(uniqueEvents.size, 'Events attended'),
    profileStat(eligibleEventIds.size ? `${Math.round(100 * uniqueEvents.size / eligibleEventIds.size)}%` : '—', 'Attendance rate'),
    profileStat(entries.length, 'Class entries'),
    profileStat(results.length, 'Completed finals'),
    profileStat(keptPositions.length ? average(keptPositions).toFixed(1) : '—', 'Adjusted avg overall'),
    profileStat(positions.length ? Math.min(...positions) : '—', 'Best overall'),
    profileStat(results.length ? countAndRate(topFive, results.length) : '—', 'Top-five finishes'),
    profileStat(results.length ? countAndRate(podiums, results.length) : '—', 'Podiums'),
    profileStat(wins, 'Overall wins'),
    profileStat(aFinals, 'A-final appearances'),
    profileStat(performance === null ? '—' : performance.toFixed(1), 'Performance score'),
    profileStat(pace === null ? '—' : `${pace.toFixed(1)}%`, 'Pace'),
    profileStat(formatRatingWithChange(ratingSummary), 'cRating', ratingHelp(ratingSummary)),
    profileStat(qualifying.length ? average(qualifying).toFixed(1) : '—', 'Average qualifying'),
    profileStat(keptConsistencies.length ? `${average(keptConsistencies).toFixed(1)}%` : '—', 'Adjusted consistency'),
    profileStat(consistencies.length ? `${Math.max(...consistencies).toFixed(1)}%` : '—', 'Best run consistency'),
    profileStat(consistencies.length ? countAndRate(consistencies.filter(value => value >= 95).length, consistencies.length) : '—', 'Runs at 95%+'),
    profileStat(lapSpreads.length ? `${average(lapSpreads).toFixed(3)}s` : '—', 'Avg lap-time gap'),
    profileStat(runs.length, 'Recorded runs'),
    profileStat(fmt.format(totalLaps(runs)), 'Completed laps'),
    distanceJourneyStat(careerRuns, driverKey),
    profileStat(trackTime(runs), 'Time on track'),
    profileStat(`${swordEvents.size} / ${clubEvents.size}`, 'SWORD / Club events')
  ].join('');

  const classes = new Map();
  for (const row of results) {
    if (!classes.has(row[2])) classes.set(row[2], []);
    classes.get(row[2]).push(row);
  }
  const runsByClass = new Map();
  for (const run of runs) {
    const race = data.raceById[run[0]];
    if (!race) continue;
    if (!runsByClass.has(race.c)) runsByClass.set(race.c, []);
    runsByClass.get(race.c).push(run);
  }
  // A class remains part of a driver's history even without a published final.
  for (const cls of [...runsByClass.keys(), ...entries.map(row => row[2])]) {
    if (!classes.has(cls)) classes.set(cls, []);
  }
  $('driverClassDetails').innerHTML = [...classes].sort(([a], [b]) => a.localeCompare(b)).map(([cls, rows]) => {
    const classPositions = rows.map(row => row[4]);
    const classTopFive = classPositions.filter(value => value <= 5).length;
    const classPodiums = classPositions.filter(value => value <= 3).length;
    const classOverallWins = classPositions.filter(value => value === 1).length;
    const classTqs = rows.filter(row => Number(row[5]) === 1).length;
    const classKeptPositions = attendanceAdjustedResults(classPositions);
    const classRuns = runsByClass.get(cls) || [];
    const classEntries = entries.filter(row => row[2] === cls).length;
    const classRaceWins = classRuns.filter(row => Number(row[2]) === 1).length;
    const fastestLaps = classRuns.map(row => lapTimeSeconds(row[5])).filter(value => Number.isFinite(value) && value > 0);
    const classConsistencies = classRuns.filter(row => isCompleteConsistencyRun(row, data)).map(row => Number.parseFloat(row[7])).filter(Number.isFinite);
    const classPace = average(attendanceAdjustedResults(classRuns.map(run => paceForRun(run, data)).filter(Number.isFinite), true));
    const classPerformance = combinedPerformanceScore(rows.map(performanceFor), classRuns.map(run => paceForRun(run, data)).filter(Number.isFinite));
    const classConsistency = average(attendanceAdjustedResults(classConsistencies, true));
    const items = [
      ['Entries', classEntries], ['Runs', classRuns.length], ['Laps', fmt.format(totalLaps(classRuns))], ['Distance', distanceRaced(classRuns)], ['Track time', trackTime(classRuns)], ['Finals', rows.length],
      ['Av overall', classKeptPositions.length ? average(classKeptPositions).toFixed(1) : '—', 'Average overall finish'], ['Best', classPositions.length ? Math.min(...classPositions) : '—', 'Best overall finish'], ['Top 5', countAndRate(classTopFive, rows.length)], ['Podiums', countAndRate(classPodiums, rows.length)],
      ['Overall wins', classOverallWins], ['Race wins', classRaceWins], ['TQs', classTqs], ['Perf', classPerformance === null ? '—' : classPerformance.toFixed(1), 'Performance'],
      ['Pace', metricValueHelp('pace', classPace === null ? '—' : `${classPace.toFixed(1)}%`, 'Pace')], ['cRating', ratingMetricHelp(driverRatingSummary(driverKey, data, cls))],
      ['Best lap', fastestLaps.length ? `${Math.min(...fastestLaps).toFixed(3)}s` : '—', 'Fastest lap'], ['Av consistency', classConsistency === null ? '—' : `${classConsistency.toFixed(1)}%`, 'Average consistency']
    ];
    return `<article class="profile-metric-card"><h4>${escapeHtml(cls)}</h4><dl>${items.map(([label, value, title]) => `<div${title ? ` title="${escapeHtml(title)}"` : ''}><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl></article>`;
  }).join('') || '<p class="profile-breakdown-empty">No class activity within these filters.</p>';

  $('driverConsistencyDetails').innerHTML = [...runsByClass].sort(([a], [b]) => a.localeCompare(b)).map(([cls, classRuns]) => {
    const completeRuns = classRuns.filter(run => isCompleteConsistencyRun(run, data));
    const values = completeRuns.map(run => Number.parseFloat(run[7])).filter(Number.isFinite);
    if (!values.length) return '';
    const adjusted = attendanceAdjustedResults(values, true);
    const gaps = completeRuns.map(run => lapTimeSeconds(run[6]) - lapTimeSeconds(run[5])).filter(value => Number.isFinite(value) && value >= 0);
    const band = predicate => countAndRate(values.filter(predicate).length, values.length);
    const items = [
      ['Runs', values.length, 'Measured runs'], ['Adjusted av', `${average(adjusted).toFixed(1)}%`, 'Adjusted average'], ['Best', `${Math.max(...values).toFixed(1)}%`, 'Best run'],
      ['98%+', band(value => value >= 98)], ['95–97.9%', band(value => value >= 95 && value < 98)], ['90–94.9%', band(value => value >= 90 && value < 95)], ['Below 90%', band(value => value < 90)],
      ['Lap gap', gaps.length ? `${average(gaps).toFixed(3)}s` : '—', 'Average fastest-to-average lap gap']
    ];
    return `<article class="profile-metric-card"><h4>${escapeHtml(cls)}</h4><dl>${items.map(([label, value, title]) => `<div${title ? ` title="${escapeHtml(title)}"` : ''}><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl></article>`;
  }).join('') || '<p class="profile-breakdown-empty">No consistency data within these filters.</p>';

  const finalByEventClass = new Map();
  for (const row of runs) {
    const race = data.raceById[row[0]];
    if (!race?.f) continue;
    const key = `${race.e}|${race.c}|${race.m}`;
    if (!finalByEventClass.has(key)) finalByEventClass.set(key, { row, race });
  }
  const consistencyByEventClass = new Map();
  for (const row of runs) {
    const race = data.raceById[row[0]];
    if (!isCompleteConsistencyRun(row, data)) continue;
    const value = Number.parseFloat(row[7]);
    if (!Number.isFinite(value)) continue;
    const key = `${race.e}|${race.c}`;
    if (!consistencyByEventClass.has(key)) consistencyByEventClass.set(key, []);
    consistencyByEventClass.get(key).push(value);
  }

  $('driverEventDetails').innerHTML = results.slice().sort((a, b) => b[1].localeCompare(a[1]) || a[2].localeCompare(b[2])).map(row => {
    const [eventId, date, cls, , position, qualifyingPosition, publishedResult, raceTier] = row;
    const event = data.eventById[eventId];
    const letter = (raceTier || '').charAt(0).toUpperCase();
    const final = finalByEventClass.get(`${eventId}|${cls}|${letter}`);
    const eventConsistency = average(attendanceAdjustedResults(consistencyByEventClass.get(`${eventId}|${cls}`) || [], true));
    const eventPerformance = performanceFor(row);
    const eventName = event?.u ? `<a href="${escapeHtml(event.u)}" target="_blank" rel="noopener">${escapeHtml(event.n)}</a>` : escapeHtml(event?.n || eventId);
    const finalName = final?.race.u ? `<a href="${escapeHtml(final.race.u)}" target="_blank" rel="noopener">${escapeHtml(raceTier)}</a>` : escapeHtml(raceTier || '—');
    const eventRuns = runs.filter(run => {
      const race = data.raceById[run[0]];
      return race?.e === eventId && race.c === cls;
    }).sort((a, b) => {
      const raceA = data.raceById[a[0]];
      const raceB = data.raceById[b[0]];
      return Number(raceB.f) - Number(raceA.f) || raceA.r.localeCompare(raceB.r) || raceA.n.localeCompare(raceB.n);
    });
    const eventPace = average(attendanceAdjustedResults(eventRuns.map(run => paceForRun(run, data)).filter(Number.isFinite), true));
    const eventRating = ratingSummary.meetings.find(meeting => meeting.eventId === eventId && meeting.date === date)?.change;
    const raceLabel = `${eventRuns.length} race${eventRuns.length === 1 ? '' : 's'}`;
    const raceDrilldown = `<button type="button" class="driver-races-toggle" aria-expanded="false">${raceLabel}</button>`;
    const eventRow = `<tr class="profile-event-row" tabindex="0" role="button" aria-expanded="false"><td>${dateFmt.format(new Date(`${date}T12:00:00Z`))}</td><td>${eventName}</td><td>${raceDrilldown}</td><td>${escapeHtml(cls)}</td><td>P${position}</td><td>${finalName}</td><td>${qualifyingPosition ? `P${qualifyingPosition}` : '—'}</td><td>${escapeHtml(final?.row[3] || publishedResult || '—')}</td><td>${escapeHtml(final?.row[5] || '—')}</td><td>${eventConsistency === null ? '—' : `${eventConsistency.toFixed(1)}%`}</td><td>${metricValueHelp('pace', eventPace === null ? '—' : `${eventPace.toFixed(1)}%`, 'Pace')}</td><td>${ratingChangeMetricHelp(eventRating)}</td></tr>`;
    const detailRow = profileRaceDetail(eventRuns, driverKey, data, 12);
    return `${eventRow}${detailRow}`;
  }).join('') || '<tr><td colspan="12">No completed finals within these filters.</td></tr>';

  state.profileKey = driverKey;
  setupCRatingClassOptions();
  for (const [panelId, buttonId, label] of [
    ['driverTrendPanel', 'driverTrendToggle', '📈 View pace & consistency trends'],
    ['driverCRatingPanel', 'driverCRatingToggle', '🏁 View cRating history']
  ]) {
    const panel = $(panelId);
    const button = $(buttonId);
    if (panel) panel.hidden = true;
    if (button) { button.setAttribute?.('aria-expanded', 'false'); button.textContent = label; }
  }
  const dialog = $('driverDialog');
  if (!dialog.open) {
    if (new URLSearchParams(location.search).get('tracker') === '1' || (window.self !== window.top && new URLSearchParams(location.search).has('map'))) dialog.show();
    else if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }
}

function finalResultCell(position, row, otherPosition) {
  if (!row) return '<span class="result-cell">—</span>';
  const [, , pos, lapsTime, , fastestLap, averageLap, consistency] = row;
  const winning = Number(position ?? pos) < Number(otherPosition);
  const pace = paceForRun(row, state.data);
  return `<span class="result-cell">
    <strong class="${winning ? 'winner' : ''}">P${position ?? pos} · ${escapeHtml(lapsTime || 'No time')}</strong>
    <small>Fastest: ${escapeHtml(fastestLap || '—')}</small>
    <small>Average: ${escapeHtml(averageLap || '—')} · Consistency: ${escapeHtml(consistency || '—')}</small>
    <small>${metricValueHelp('pace', pace === null ? 'Pace —' : `Pace ${pace.toFixed(1)}%`, 'Pace')}</small>
  </span>`;
}

function eventResultCell(row, otherPosition) {
  const position = row[4];
  return `<span class="result-cell"><strong class="${position < otherPosition ? 'winner' : ''}">P${position}</strong><small>${escapeHtml(row[6] || row[7] || '')}</small></span>`;
}

function sharedEventIds(aKey, bKey, from, to, eventType, className) {
  const eligible = row => isPublishedFinal(row) && inRange(row[1], from, to) && eventMatches(row[0], eventType) && classMatches(row[2], className);
  const idsA = new Set(state.data.eventResults.filter(row => row[3] === aKey && eligible(row)).map(row => row[0]));
  return [...new Set(state.data.eventResults.filter(row => row[3] === bKey && idsA.has(row[0]) && eligible(row)).map(row => row[0]))];
}

function updateEventPicker(eventIds, preserveSelection) {
  const picker = $('comparisonEvent');
  const previous = preserveSelection ? picker.value : '';
  const events = eventIds.map(id => state.data.eventById[id]).filter(Boolean).sort((a, b) => b.d.localeCompare(a.d));
  picker.innerHTML = '<option value="">All shared events</option>' + events.map(event =>
    `<option value="${escapeHtml(event.i)}">${dateFmt.format(new Date(`${event.d}T12:00:00Z`))} — ${escapeHtml(event.n)}</option>`
  ).join('');
  if (events.some(event => event.i === previous)) picker.value = previous;
  $('eventPickerWrap').hidden = events.length === 0;
}

function compareDrivers(preserveEvent = false) {
  const aKey = $('driverA').value;
  const bKey = $('driverB').value;
  if (!aKey || !bKey || aKey === bKey) {
    $('h2hResults').hidden = true;
    $('eventPickerWrap').hidden = true;
    $('h2hEmpty').hidden = false;
    $('h2hEmpty').textContent = aKey && aKey === bKey ? 'Choose two different drivers.' : 'Choose two drivers to compare their official final results.';
    return;
  }

  const { from, to, eventType, className } = filters();
  const data = state.data;
  const nameA = data.driverByKey[aKey];
  const nameB = data.driverByKey[bKey];
  const shared = sharedEventIds(aKey, bKey, from, to, eventType, className);
  updateEventPicker(shared, preserveEvent);
  const selectedEvent = $('comparisonEvent').value;
  const selected = eventId => !selectedEvent || eventId === selectedEvent;
  const eventLink = $('openEventResults');
  const eventUrl = data.eventById[selectedEvent]?.u;
  eventLink.hidden = !eventUrl;
  if (eventUrl) eventLink.href = eventUrl;

  const eventMapB = new Map();
  for (const row of data.eventResults) {
    const [eventId, date, cls, driverKey] = row;
    if (driverKey === bKey && isPublishedFinal(row) && selected(eventId) && inRange(date, from, to) && eventMatches(eventId, eventType) && classMatches(cls, className)) eventMapB.set(`${eventId}|${cls}`, row);
  }
  const eventMeetings = [];
  for (const rowA of data.eventResults) {
    const [eventId, date, cls, driverKey, positionA] = rowA;
    if (driverKey !== aKey || !isPublishedFinal(rowA) || !selected(eventId) || !inRange(date, from, to) || !eventMatches(eventId, eventType) || !classMatches(cls, className)) continue;
    const rowB = eventMapB.get(`${eventId}|${cls}`);
    if (rowB) eventMeetings.push({ eventId, date, cls, a: positionA, b: rowB[4], rowA, rowB });
  }

  const raceMapB = new Map(data.raceResults.filter(row => row[1] === bKey).map(row => [row[0], row]));
  const finalMeetings = [];
  for (const rowA of data.raceResults) {
    if (rowA[1] !== aKey) continue;
    const race = data.raceById[rowA[0]];
    const rowB = raceMapB.get(rowA[0]);
    if (!race?.f || !rowB || !selected(race.e) || !inRange(race.d, from, to) || !eventMatches(race.e, eventType) || !classMatches(race.c, className)) continue;
    finalMeetings.push({ raceId: rowA[0], race, a: rowA[2], b: rowB[2], rowA, rowB });
  }

  const score = rows => ({ a: rows.filter(x => x.a < x.b).length, b: rows.filter(x => x.b < x.a).length, ties: rows.filter(x => x.a === x.b).length });
  const eventScore = score(eventMeetings);
  const finalScore = score(finalMeetings);
  $('sharedEvents').textContent = selectedEvent ? (shared.includes(selectedEvent) ? 1 : 0) : shared.length;
  $('eventMeetings').textContent = eventMeetings.length;
  $('raceMeetings').textContent = finalMeetings.length;
  $('eventScoreA').textContent = eventScore.a;
  $('eventScoreB').textContent = eventScore.b;
  $('raceScoreA').textContent = finalScore.a;
  $('raceScoreB').textContent = finalScore.b;
  $('eventHeadA').textContent = nameA;
  $('eventHeadB').textContent = nameB;
  $('raceHeadA').textContent = nameA;
  $('raceHeadB').textContent = nameB;
  $('comparisonSummary').textContent = `${nameA} leads ${eventScore.a}–${eventScore.b} on overall finishing position and ${finalScore.a}–${finalScore.b} in same-final finishes. Overall ties: ${eventScore.ties}; final ties: ${finalScore.ties}.`;

  $('eventDetails').innerHTML = eventMeetings.sort((a, b) => b.date.localeCompare(a.date)).map(row => {
    const event = data.eventById[row.eventId];
    const eventName = event?.u ? `<a href="${escapeHtml(event.u)}" target="_blank" rel="noopener">${escapeHtml(event.n)}</a>` : escapeHtml(event?.n || row.eventId);
    return `<tr><td>${dateFmt.format(new Date(`${row.date}T12:00:00Z`))}</td><td>${eventName}</td><td>${escapeHtml(row.cls)}</td><td>${eventResultCell(row.rowA, row.b)}</td><td>${eventResultCell(row.rowB, row.a)}</td></tr>`;
  }).join('') || '<tr><td colspan="5">No same-class overall comparisons.</td></tr>';

  $('raceDetails').innerHTML = finalMeetings.sort((a, b) => b.race.d.localeCompare(a.race.d)).map(row => {
    const event = data.eventById[row.race.e];
    const raceName = row.race.u ? `<a href="${escapeHtml(row.race.u)}" target="_blank" rel="noopener">${escapeHtml(row.race.n)}</a>` : escapeHtml(row.race.n);
    return `<tr><td>${dateFmt.format(new Date(`${row.race.d}T12:00:00Z`))}</td><td>${escapeHtml(event?.n || '')}<br><small>${raceName}</small></td><td>${escapeHtml(row.race.c)}</td><td>${finalResultCell(row.a, row.rowA, row.b)}</td><td>${finalResultCell(row.b, row.rowB, row.a)}</td></tr>`;
  }).join('') || '<tr><td colspan="5">The selected drivers did not race in the same main final.</td></tr>';

  $('h2hEmpty').hidden = true;
  $('h2hResults').hidden = false;
}

function refresh() {
  renderLeaderboard();
  updateRaceExplorer(true);
  if (!$('h2hResults').hidden) compareDrivers(true);
  if ($('driverDialog').open && state.profileKey) driverProfile(state.profileKey);
}

async function init() {
  const loadingControls=[...document.querySelectorAll('main select,main input,main button')];
  const priorDisabled=loadingControls.map(control=>control.disabled);
  loadingControls.forEach(control=>control.disabled=true);
  $('updatedStatus').setAttribute('role','status');
  $('updatedStatus').textContent='Loading race records — filters will be ready shortly…';
  // On the dedicated tracker, start the map library alongside the race data.
  // Ordinary statistics visits keep the map download on demand.
  const startupParams = new URLSearchParams(window.location.search);
  if (startupParams.get('tracker') === '1' || startupParams.has('map')) loadMap().catch(() => {});
  try {
    const { data, videosReady } = await loadStatisticsData();
    loadingControls.forEach((control,index)=>control.disabled=priorDisabled[index]);
    data.videos = [];
    videosReady.then(videos => {
      data.videos = videos;
      const video = sharedRaceVideo(data.raceResults, videos, $('raceSelection').value);
      $('raceVideoLink').href = video?.url || '#';
      $('raceVideoLink').textContent = 'Watch this race ▶';
      $('raceVideoLink').title = video ? 'You are in this race' : '';
      $('raceVideoLink').hidden = !video;
      if ($('driverDialog').open && state.profileKey) driverProfile(state.profileKey);
    });
    data.eventById = Object.fromEntries(data.events.map(event => [event.i, event]));
    data.driverByKey = Object.fromEntries(data.drivers.map(driver => [driver.k, driver.n]));
    data.raceResults.forEach(row => { row[5] = fastestLapText(row[5]); row[6] = averageLapText(row[6]); });
    state.data = data;

    $('eventTotal').textContent = fmt.format(data.meta.eventCount);
    $('driverTotal').textContent = fmt.format(data.meta.driverCount);
    $('raceTotal').textContent = fmt.format(data.meta.raceCount);
    $('resultTotal').textContent = fmt.format(data.meta.raceResultCount);
    $('updatedStatus').textContent = `Last updated ${dateTimeFmt.format(new Date(data.meta.generatedAt))} UK time`;
    $('toDate').max = data.meta.latestEventDate;
    $('toDate').value = data.meta.latestEventDate;
    $('fromDate').value = oneYearBefore(data.meta.latestEventDate);

    for (const className of data.classes) $('classFilter').insertAdjacentHTML('beforeend', `<option value="${escapeHtml(className)}">${escapeHtml(classLabels[className] || className)}</option>`);
    $('classFilter').value = 'senior';
    const driverOptions = data.drivers.filter(driver => !journeyExcludedDrivers.has(driver.k)).sort((a, b) => a.n.localeCompare(b.n)).map(driver => `<option value="${escapeHtml(driver.k)}">${escapeHtml(driver.n)}${driver.j ? ' (Junior)' : ''}</option>`).join('');
    $('driverA').insertAdjacentHTML('beforeend', driverOptions);
    $('driverB').insertAdjacentHTML('beforeend', driverOptions);
    renderLeaderboard();
    updateRaceExplorer(false);

    for (const id of ['fromDate', 'toDate', 'minimumFinals']) $(id).addEventListener('change', refresh);
    $('eventTypeFilter').addEventListener('change', () => {
      if ($('eventTypeFilter').value === 'sword' && $('minimumFinals').value === '10') $('minimumFinals').value = '5';
      refresh();
    });
    $('classFilter').addEventListener('change', () => {
      if ($('classFilter').value === 'Junior Racers' && $('minimumFinals').value === '10') $('minimumFinals').value = '5';
      syncClassButtons();
      refresh();
    });
    $('leaderboardClassTabs').addEventListener('click', event => {
      const button = event.target.closest('[data-class-filter]');
      if (!button) return;
      $('classFilter').value = button.dataset.classFilter;
      if ($('classFilter').value === 'Junior Racers' && $('minimumFinals').value === '10') $('minimumFinals').value = '5';
      syncClassButtons();
      refresh();
    });
    $('driverSearch').addEventListener('input', renderLeaderboard);
    $('leaderboardMetric').addEventListener('change', () => {
      state.leaderboardSort = { key: 'rank', direction: 'asc' };
      renderLeaderboard();
    });
    $('driverLeaderboard').querySelector('thead').addEventListener('click', event => {
      const heading = event.target.closest('[data-leaderboard-sort]');
      if (!heading) return;
      const key = heading.dataset.leaderboardSort;
      const same = state.leaderboardSort.key === key;
      const lowerFirst = key === 'rank' || key === 'name' || key === 'average' || key === 'best' || (key === 'metric' && (leaderboardMetrics[$('leaderboardMetric')?.value || 'average'] || leaderboardMetrics.average).lower);
      state.leaderboardSort = { key, direction: same ? (state.leaderboardSort.direction === 'asc' ? 'desc' : 'asc') : (lowerFirst ? 'asc' : 'desc') };
      renderLeaderboard();
    });
    $('raceEvent').addEventListener('change', () => updateRaceSelection(false));
    $('raceSelection').addEventListener('change', () => renderRaceExplorer($('raceSelection').value));
    $('raceExplorerResults').addEventListener('click', event => {
      const button = event.target.closest('[data-driver-key]');
      if (button) driverProfile(button.dataset.driverKey);
    });
    $('leaderboardBody').addEventListener('click', event => {
      const profileButton = event.target.closest('[data-profile-key]');
      if (profileButton) { driverProfile(profileButton.dataset.profileKey); return; }
      const nameButton = event.target.closest('.driver-name[data-driver-key]');
      if (nameButton) { driverProfile(nameButton.dataset.driverKey); return; }
      if (event.target.closest('a,button,.metric-help,details,summary')) return;
      const driverRow = event.target.closest('[data-driver-row]');
      if (!driverRow) return;
      const driverKey = driverRow.dataset.driverRow;
      const row = document.getElementById(`leaderboard-source-${driverKey}`);
      if (!row) return;
      if (row.hidden && !row.dataset.loaded) {
        const source = state.leaderboardRows?.get(driverKey);
        if (source) row.querySelector('td').innerHTML = leaderboardEvidence(source);
        row.dataset.loaded = 'true';
      }
      row.hidden = !row.hidden;
      driverRow.setAttribute('aria-expanded', String(!row.hidden));
      driverRow.setAttribute('aria-label', `${row.hidden ? 'Show' : 'Hide'} source results for ${driverRow.querySelector('.driver-name')?.textContent || 'driver'}`);
    });
    $('leaderboardBody').addEventListener('keydown', event => {
      const row = event.target.closest('[data-driver-row]');
      if (!row || event.target !== row || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      row.click();
    });
    const handleProfileDrilldownClick = (container, event) => {
      const retry = event.target.closest('.driver-run-retry');
      if (retry) {
        const detail = retry.closest('.driver-run-detail-row');
        const row = detail?.previousElementSibling;
        if (row?.classList.contains('driver-run-row')) loadDriverRunDetail(row);
        return;
      }
      const eventRow = event.target.closest('.profile-event-row,.profile-evidence-event-row');
      const groupButton = event.target.closest('.driver-races-toggle') || (eventRow && !event.target.closest('a,button,.metric-help') ? eventRow.querySelector('.driver-races-toggle') : null);
      if (groupButton) {
        const detailRow = groupButton.closest('tr')?.nextElementSibling;
        if (!detailRow?.classList.contains('driver-races-detail-row')) return;
        const opening = detailRow.hidden;
        container.querySelectorAll('.driver-races-detail-row').forEach(other => {
          if (other === detailRow) return;
          other.hidden = true;
          const otherRow = other.previousElementSibling;
          otherRow?.querySelector('.driver-races-toggle')?.setAttribute('aria-expanded', 'false');
          otherRow?.setAttribute('aria-expanded', 'false');
        });
        detailRow.hidden = !opening;
        groupButton.setAttribute('aria-expanded', String(opening));
        groupButton.closest('tr')?.setAttribute('aria-expanded', String(opening));
        return;
      }
      if (event.target.closest('a,button,.metric-help')) return;
      const row = event.target.closest('.driver-run-row');
      if (!row) return;
      const detail = row.nextElementSibling;
      const wasPinned = row.dataset.pinned === 'true';
      if (!wasPinned) {
        container.querySelectorAll('.driver-run-row').forEach(other => {
          if (other === row) return;
          other.dataset.pinned = 'false';
          other.setAttribute('aria-expanded', 'false');
          if (other.nextElementSibling?.classList.contains('driver-run-detail-row')) other.nextElementSibling.hidden = true;
        });
        row.dataset.pinned = 'true';
        loadDriverRunDetail(row);
      } else {
        detail.hidden = true;
        row.setAttribute('aria-expanded', 'false');
        row.dataset.pinned = 'false';
      }
    };
    $('driverEventDetails').addEventListener('click', event => handleProfileDrilldownClick($('driverEventDetails'), event));
    $('driverEventDetails').addEventListener('keydown', event => {
      const row = event.target.closest('.driver-run-row,.profile-event-row');
      if (!row || event.target !== row || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      row.click();
    });
    $('driverProfileStats').addEventListener('click', event => {
      const evidenceButton = event.target.closest('[data-profile-evidence]');
      if (evidenceButton) {
        renderProfileMetricEvidence(evidenceButton.dataset.profileEvidence, evidenceButton.dataset.profileLabel || 'metric');
        return;
      }
      const button = event.target.closest('[data-journey-driver]');
      if (button) openJourneyMap(button.dataset.journeyDriver);
    });
    $('driverMetricEvidence').addEventListener('click', event => {
      const panel = $('driverMetricEvidence');
      if (event.target.closest('.profile-metric-evidence-close')) {
        panel.hidden = true;
        panel.classList.remove('fullscreen');
        panel.dataset.metric = '';
        $('driverProfileStats').querySelectorAll('[data-profile-evidence]').forEach(button => button.setAttribute('aria-expanded', 'false'));
        return;
      }
      const fullscreen = event.target.closest('.profile-metric-evidence-fullscreen');
      if (fullscreen) {
        const enabled = panel.classList.toggle('fullscreen');
        fullscreen.setAttribute('aria-pressed', String(enabled));
        fullscreen.textContent = enabled ? 'Exit full screen' : 'Full screen';
        return;
      }
      handleProfileDrilldownClick(panel, event);
    });
    $('driverMetricEvidence').addEventListener('keydown', event => {
      const row = event.target.closest('.driver-run-row,.profile-evidence-event-row');
      if (!row || event.target !== row || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      row.click();
    });
    $('driverTrendToggle')?.addEventListener('click', () => {
      const panel = $('driverTrendPanel');
      const button = $('driverTrendToggle');
      panel.hidden = !panel.hidden;
      button.setAttribute('aria-expanded', String(!panel.hidden));
      button.textContent = panel.hidden ? '📈 View pace & consistency trends' : 'Hide pace & consistency trends';
      if (!panel.hidden) renderDriverTrends();
    });
    $('driverTrendRange')?.addEventListener('change', renderDriverTrends);
    $('driverCRatingToggle')?.addEventListener('click', () => {
      const panel = $('driverCRatingPanel');
      const button = $('driverCRatingToggle');
      panel.hidden = !panel.hidden;
      button.setAttribute('aria-expanded', String(!panel.hidden));
      button.textContent = panel.hidden ? '🏁 View cRating history' : 'Hide cRating history';
      if (!panel.hidden) renderCRatingTrend();
    });
    $('driverCRatingClass')?.addEventListener('change', renderCRatingTrend);
    $('closeJourneyMap').addEventListener('click', () => {
      stopJourneyPlayback();
      leaveJourneyFullscreen();
      $('journeyMapOverlay').hidden = true;
      $('driverDialog').classList.remove('journey-open');
    });
    $('journeyMapOverlay').addEventListener('wheel', event => {
      const shell = $('journeyMapOverlay').querySelector('.journey-map-shell');
      if (!shell.contains(event.target)) {
        event.preventDefault();
        shell.scrollTop += event.deltaY;
      }
    }, { passive: false });
    $('journeyDriverSearch').addEventListener('change', selectJourneyDriver);
    $('journeyDriverSearch').addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        selectJourneyDriver();
      }
    });
    $('journeyDateSlider').addEventListener('input', () => {
      stopJourneyPlayback();
      journeyPlaybackHasStarted = true;
      journeyPlaybackPosition = null;
      renderJourneyMap();
    });
    $('journeyRefocus').addEventListener('click', () => {
      journeyFollowSelected = Boolean(journeySelectedKey);
      $('journeyFollowStatus').textContent = journeySelectedKey ? 'Following selected driver' : 'Showing the full route';
      renderJourneyMap({ resetView: !journeySelectedKey, focusDriver: Boolean(journeySelectedKey) });
    });
    $('journeyDriverChecklist').addEventListener('change', event => {
      if (event.target.type !== 'checkbox') return;
      if (event.target.checked) journeySelectedKeys.add(event.target.value);
      else journeySelectedKeys.delete(event.target.value);
      renderJourneyDriverChecklist(); updateJourneyMode();
    });
    $('journeyPickerSearch').addEventListener('input', renderJourneyDriverChecklist);
    $('journeySelectAll').addEventListener('click', () => { journeySelectedKeys.clear(); renderJourneyDriverChecklist(); updateJourneyMode(); });
    $('journeySelectNone').addEventListener('click', () => { journeySelectedKeys.clear(); renderJourneyDriverChecklist(); updateJourneyMode(); });
    $('journeyPlaybackMode').addEventListener('change', updateJourneyMode);
    $('journeyPlaybackStart').addEventListener('change', () => {
      $('journeyStartDate').disabled = $('journeyPlaybackStart').value !== 'chosen';
      stopJourneyPlayback();
      journeyPlaybackHasStarted = false;
    });
    $('journeyStartDate').addEventListener('change', () => { stopJourneyPlayback(); journeyPlaybackHasStarted = false; });
    $('journeySpeed').addEventListener('change', () => {
      if (journeyPlaybackTimer) {
        stopJourneyPlayback();
        toggleJourneyPlayback();
      }
    });
    $('journeyFullscreen').addEventListener('click', async () => {
      journeyMapFullscreen = !journeyMapFullscreen;
      const overlay = $('journeyMapOverlay');
      overlay.classList.toggle('fullscreen', journeyMapFullscreen);
      $('journeyFullscreen').textContent = journeyMapFullscreen ? 'Exit full screen' : 'Full screen';
      if (journeyMapFullscreen) {
        // Browsers require this call to originate from the user's tap. Wix or
        // iOS may deny it, in which case the map-focused layout still works.
        try {
          if (!overlay.requestFullscreen) throw new Error('Fullscreen unavailable');
          await overlay.requestFullscreen();
        } catch {
          overlay.classList.add('needs-standalone');
        }
      } else {
        overlay.classList.remove('needs-standalone');
        if (document.fullscreenElement === overlay) await document.exitFullscreen().catch(() => {});
      }
      overlay.querySelector('.journey-map-shell').scrollTop = 0;
      setTimeout(() => journeyMap?.invalidateSize(), 100);
    });
    $('journeyStandalone').addEventListener('click', () => {
      const url = new URL(location.href);
      if (journeySelectedKey) url.searchParams.set('map', journeySelectedKey);
      else url.searchParams.delete('map');
      if (journeySelectedKeys.size) url.searchParams.set('raceDrivers', [...journeySelectedKeys].join(','));
      $('journeyStandalone').href = url.href;
    });
    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement || !journeyMapFullscreen) return;
      journeyMapFullscreen = false;
      $('journeyMapOverlay').classList.remove('fullscreen', 'needs-standalone');
      $('journeyFullscreen').textContent = 'Full screen';
      setTimeout(() => journeyMap?.invalidateSize(), 100);
    });
    $('journeyPlay').addEventListener('click', toggleJourneyPlayback);
    $('closeDriverProfile').addEventListener('click', () => $('driverDialog').close());
    $('driverDialog').addEventListener('close', () => {
      stopJourneyPlayback();
      leaveJourneyFullscreen();
      $('journeyMapOverlay').hidden = true;
      $('driverDialog').classList.remove('journey-open');
      const returnTo = new URLSearchParams(location.search).get('returnTo');
      if (returnTo) {
        const destination = new URL(returnTo, location.href);
        if (destination.origin === location.origin && destination.pathname !== location.pathname) {
          if (document.referrer === destination.href && history.length > 1) history.back();
          else location.assign(destination.href);
        }
      }
    });
    $('driverDialog').addEventListener('click', event => {
      if (event.target === $('driverDialog')) $('driverDialog').close();
    });
    $('compareDrivers').addEventListener('click', () => compareDrivers(false));
    $('comparisonEvent').addEventListener('change', () => compareDrivers(true));
    $('resetFilters').addEventListener('click', () => {
      $('fromDate').value = oneYearBefore(data.meta.latestEventDate);
      $('toDate').value = data.meta.latestEventDate;
      $('eventTypeFilter').value = '';
      $('classFilter').value = 'senior';
      $('minimumFinals').value = '10';
      $('leaderboardMetric').value = 'average';
      $('driverSearch').value = '';
      syncClassButtons();
      refresh();
    });
    const params = new URLSearchParams(window.location.search);
    const requestedDriver = canonicalDriverKey(params.get('driver'));
    const requestedMap = params.get('map');
    const trackerDriver = requestedMap && data.driverByKey[requestedMap] && !journeyExcludedDrivers.has(requestedMap) ? requestedMap : '';
    if (trackerDriver || params.get('tracker') === '1') {
      const selected = (params.get('raceDrivers') || '').split(',').map(canonicalDriverKey).filter(key => data.driverByKey[key] && !journeyExcludedDrivers.has(key));
      journeySelectedKeys = new Set(selected);
      if (trackerDriver) driverProfile(trackerDriver);
      else {
        $('driverProfileName').textContent = 'Driver Distance Tracker';
        const dialog = $('driverDialog');
        if (!dialog.open) {
          if ((new URLSearchParams(location.search).get('tracker') === '1' || (window.self !== window.top && new URLSearchParams(location.search).has('map')))) dialog.show();
    else if (typeof dialog.showModal === 'function') dialog.showModal();
          else dialog.setAttribute('open', '');
        }
      }
      if (window.self !== window.top || params.get('tracker') === '1') {
        document.body.classList.add('embedded-tracker-page');

      }
      openJourneyMap(trackerDriver);
      if (params.get('tracker') === '1') window.scrollTo(0, 0);
      renderJourneyDriverChecklist();
    } else if (requestedDriver && data.driverByKey[requestedDriver]) driverProfile(requestedDriver);
  } catch (error) {
    $('updatedStatus').textContent = 'Statistics could not be loaded. ';
    const retry=document.createElement('button');retry.type='button';retry.textContent='Try again';retry.addEventListener('click',()=>location.reload());$('updatedStatus').append(retry);
    $('leaderboardBody').innerHTML = `<tr><td colspan="12">${escapeHtml(error.message)}</td></tr>`;
  } finally {
    loadingControls.forEach((control,index)=>control.disabled=priorDisabled[index]);
  }
}

ensureEnhancedMarkup();
installMetricHelpPopover();
init();
