import { journeyRoadDistanceKm, journeyRoadRoute } from './journey-route.js?v=20260923-istanbul1';

const state = { data: null, profileKey: '' };
let journeyMap = null;
let journeyMapLayers = null;
let journeyDriverMarkers = new Map();
let journeySelectedKey = '';
let journeyTimelineDates = [];
let journeyPlaybackTimer = null;
const journeyPlaybackDurationMs = 120000;
const $ = id => document.getElementById(id);
const fmt = new Intl.NumberFormat('en-GB');
const dateFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London', hourCycle: 'h23' });
const kmToMiles = km => Number((km * 0.621371).toFixed(1));
const classLabels = {
  'Junior Racers': 'Juniors',
  '2-Wheel Drive Buggy': '2WD',
  '4-Wheel Drive Buggy': '4WD',
  'Trucks': 'Trucks',
  'Vintage': 'Vintage'
};

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
  if ($('eventTypeFilter')) $('eventTypeFilter').innerHTML = '<option value="">All official events</option><option value="sword">SWORD</option><option value="club">Club Days</option>';
  if ($('classFilter')) $('classFilter').innerHTML = '<option value="senior">All senior classes</option>';
  if (!$('liveRcArchiveLink')) $('updateSchedule')?.insertAdjacentHTML('afterend', '<a class="archive-link" id="liveRcArchiveLink" href="https://cobracardiff.liverc.com/events/" target="_blank" rel="noopener">Event Results</a>');
  if (!$('youtubeChannelLink')) $('liveRcArchiveLink')?.insertAdjacentHTML('afterend', '<a class="archive-link youtube-channel-link" id="youtubeChannelLink" href="https://www.youtube.com/@Bezza90/videos" target="_blank" rel="noopener">Race Videos ▶</a>');
  if (!$('leaderboardClassTabs')) $('leaderboardTitle')?.insertAdjacentHTML('afterend', `<div class="class-tabs" id="leaderboardClassTabs" aria-label="Leaderboard class">
    <button type="button" data-class-filter="2-Wheel Drive Buggy" aria-pressed="false">2WD</button><button type="button" data-class-filter="4-Wheel Drive Buggy" aria-pressed="false">4WD</button><button type="button" data-class-filter="Junior Racers" aria-pressed="false">Junior Racers</button><button type="button" data-class-filter="Trucks" aria-pressed="false">Trucks</button><button type="button" data-class-filter="Vintage" aria-pressed="false">Vintage</button>
  </div>`);
  if (!$('leaderboardMetric')) $('leaderboardCount')?.insertAdjacentHTML('beforebegin', `<label class="runtime-rank-control">Rank leaderboard by<select id="leaderboardMetric"><option value="average">Average overall finish</option><option value="performance">Performance score</option><option value="finals">Finals completed</option><option value="laps">Total laps</option><option value="distance">Distance raced</option><option value="trackTime">Time on track</option><option value="runs">Recorded runs</option><option value="raceWins">Individual race wins</option><option value="overallWins">Overall wins</option><option value="podiums">Podiums</option><option value="tqs">TQs</option><option value="podiumRate">Podium rate</option><option value="winRate">Overall win rate</option><option value="topFiveRate">Top-five rate</option><option value="tqRate">TQ rate</option><option value="consistency">Adjusted consistency</option><option value="bestConsistency">Best run consistency</option><option value="highConsistencyRuns">Runs at 95%+</option><option value="lapSpread">Fastest-to-average gap</option><option value="qualifyingAverage">Average qualifying position</option><option value="fastestLap">Fastest lap</option><option value="placesGained">Average places gained</option></select></label>`);
  const minimum = $('minimumFinals');
  if (minimum) {
    minimum.innerHTML = '<option value="1">1+ final</option><option value="5">5+ finals</option><option value="10">10+ finals</option><option value="20">20+ finals</option><option value="30">30+ finals</option>';
    minimum.value = '10';
  }
  const definition = document.querySelector('.definition');
  if (definition) definition.textContent = 'Choose any ranking measure above. Average finish, performance and consistency use the attendance adjustment: no result is discarded below 10 finals; one is discarded at 10, then one additional lowest result for every five further finals. Consistency uses only full-duration runs with at least five laps. Activity totals always use every matching run.';
  if (!$('updateSchedule')) $('updatedStatus')?.insertAdjacentHTML('afterend', '<p class="update-schedule" id="updateSchedule">Results update automatically each day at 18:00 UK time.</p>');

  if (!$('raceExplorer')) {
    document.querySelector('.head-to-head')?.insertAdjacentHTML('beforebegin', `
      <section class="panel race-explorer" id="raceExplorer" aria-labelledby="raceExplorerTitle">
        <div class="section-heading"><div><p class="eyebrow">Open the meeting</p><h2 id="raceExplorerTitle">Event &amp; race explorer</h2></div></div>
        <div class="race-explorer-controls">
          <label>Event<select id="raceEvent"></select></label><label>Individual race<select id="raceSelection"></select></label>
          <a class="event-link" id="raceEventLink" href="#" target="_blank" rel="noopener">Open event results ↗</a>
          <a class="event-link" id="raceResultLink" href="#" target="_blank" rel="noopener">Open this race ↗</a><a class="event-link video-link" id="raceVideoLink" href="#" target="_blank" rel="noopener" hidden>Watch race video ▶</a>
        </div>
        <h3 class="race-result-title" id="raceResultTitle">Select a race</h3>
        <div class="table-wrap compact"><table><thead><tr><th>Pos</th><th>Driver</th><th>Qualifying</th><th>Laps / time</th><th>Behind</th><th>Fastest lap</th><th>Average lap</th><th>Consistency</th></tr></thead><tbody id="raceExplorerResults"></tbody></table></div>
      </section>`);
  }

  if (!$('driverDialog')) {
    document.querySelector('footer')?.insertAdjacentHTML('beforebegin', `
      <dialog class="driver-dialog" id="driverDialog" aria-labelledby="driverProfileName">
        <div class="dialog-shell">
          <button type="button" class="dialog-close" id="closeDriverProfile" aria-label="Close driver profile">×</button>
          <p class="eyebrow">Driver profile</p><h2 id="driverProfileName">Driver</h2>
          <p class="profile-context" id="driverProfileContext"></p>
          <div class="profile-stats" id="driverProfileStats"></div>
          <section class="profile-section"><h3>Class breakdown</h3><div class="table-wrap compact"><table>
            <thead><tr><th>Class</th><th>Entries</th><th>Runs</th><th>Laps</th><th>Distance</th><th>Track time</th><th>Finals</th><th>Avg overall</th><th>Best</th><th>Top 5</th><th>Podiums</th><th>Overall wins</th><th>Race wins</th><th>TQs</th><th>Performance</th><th>Fastest lap</th><th>Avg consistency</th></tr></thead>
            <tbody id="driverClassDetails"></tbody>
          </table></div><p class="definition">Distance is estimated at 150 metres per completed lap. Track time, fastest lap and consistency use every recorded run within the selected filters.</p></section>
          <section class="profile-section"><h3>Consistency breakdown</h3><div class="table-wrap compact"><table>
            <thead><tr><th>Class</th><th>Measured runs</th><th>Adjusted average</th><th>Best run</th><th>98%+</th><th>95–97.9%</th><th>90–94.9%</th><th>Below 90%</th><th>Avg fastest-to-average gap</th></tr></thead>
            <tbody id="driverConsistencyDetails"></tbody>
          </table></div><p class="definition">Consistency bands use only runs completed for the full scheduled duration with at least five laps. The lap-gap figure compares each qualifying run’s fastest lap with its average lap; a smaller gap generally indicates steadier pace.</p></section>
          <section class="profile-section"><h3>Event and final history</h3><div class="table-wrap profile-history"><table>
            <thead><tr><th>Date</th><th>Event</th><th>Class</th><th>Overall</th><th>Final</th><th>Qualifying</th><th>Final result</th><th>Fastest lap</th><th>Consistency</th><th>Individual races</th></tr></thead>
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
          <label>Drivers shown<select id="journeyDriverLimit"><option value="0">All drivers</option><option value="25">Top 25</option><option value="50">Top 50</option><option value="100">Top 100</option><option value="200">Top 200</option></select></label>
          <button type="button" id="journeyPlay">▶ Play 2-minute journey</button>
          <label class="journey-timeline">Journey date <strong id="journeyDateLabel">Latest</strong><input type="range" id="journeyDateSlider" min="0" max="0" value="0" step="1" aria-label="Journey date from January 2022 to the latest result"></label>
        </div>
        <div class="journey-milestones" id="journeyMilestones" aria-label="Journey milestones"></div>
        <div class="journey-map" id="journeyMap"></div>
        <div class="journey-map-legend"><span><i class="selected"></i> Selected driver</span><span><i></i> Other drivers</span><span>Route: House of Sport, Cardiff → Munich → Rome → Istanbul</span></div>
      </div>
    </section>`);

  if (!document.querySelector('#driver-profile-runtime-styles')) {
    document.head.insertAdjacentHTML('beforeend', `<style id="driver-profile-runtime-styles">
      .driver-name{padding:0;color:#067b14;background:transparent;border:0;border-radius:0;font-weight:850;text-align:left;text-decoration:underline;text-decoration-color:#9dd7a5;text-underline-offset:3px}.driver-name:hover{color:#044f0c;background:transparent;text-decoration-color:currentColor}
      .driver-dialog{width:min(1120px,calc(100% - 28px));max-height:92vh;padding:0;color:#111714;background:#fff;border:0;border-radius:16px;box-shadow:0 28px 90px rgba(0,0,0,.35)}.driver-dialog::backdrop{background:rgba(3,10,6,.72);backdrop-filter:blur(3px)}.dialog-shell{position:relative;padding:clamp(22px,4vw,38px)}.dialog-close{position:absolute;top:14px;right:14px;width:42px;height:42px;padding:0;color:#344039;background:#eef3ef;border-radius:50%;font-size:1.65rem;line-height:1}.dialog-close:hover{color:#fff;background:#067b14}.profile-context{margin:8px 52px 22px 0;color:#637069}.profile-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px}.profile-stats article{min-height:106px;padding:16px;background:#f3f7f4;border:1px solid #dfe6e1;border-top:3px solid #08a31a;border-radius:9px}.profile-stats strong{display:block;font-size:1.65rem;line-height:1}.profile-stats span{display:block;margin-top:8px;color:#637069;font-size:.72rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase}.profile-section{margin-top:28px}.profile-section h3{margin:0 0 12px;font-size:1.2rem}.profile-history{max-height:430px}.profile-history th:first-child,.profile-history td:first-child{text-align:left}.profile-history a,.profile-section a{color:#067b14;font-weight:800}
      .race-explorer-controls{display:grid;grid-template-columns:minmax(220px,1fr) minmax(280px,1.5fr) repeat(3,auto);align-items:end;gap:12px;margin-bottom:22px}.race-result-title{margin:0 0 12px;font-size:1.05rem}.inline-races summary{padding:0;color:#067b14;font-size:.78rem;white-space:nowrap}.inline-races[open]{min-width:640px}.inline-races .table-wrap{margin:10px 0 0;max-height:300px}@media(max-width:820px){.race-explorer-controls{grid-template-columns:1fr 1fr}}@media(max-width:520px){.race-explorer-controls{grid-template-columns:1fr}}
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
    positions: [], performances: [], consistencies: [], placesGained: [], qualifyingPositions: [], lapSpreads: []
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
    row.laps += completedLaps(run);
    row.seconds += runTimeSeconds(run);
    if (Number(position) === 1) row.raceWins += 1;
    const lap = Number.parseFloat(fastestLap);
    if (Number.isFinite(lap) && lap > 0) row.fastestLap = Math.min(row.fastestLap, lap);
    const averageLapValue = Number.parseFloat(averageLap);
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
      const keptPerformances = attendanceAdjustedResults(row.performances, true);
      const keptConsistencies = attendanceAdjustedResults(row.consistencies, true);
      return {
        ...row,
        average: average(keptPositions),
        performance: average(keptPerformances),
        consistency: average(keptConsistencies),
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
  return `${count} (${Math.round(100 * count / total)}%)`;
}

const leaderboardMetrics = {
  average: { label: 'Average overall finish', lower: true, value: row => row.average, display: row => row.average.toFixed(1) },
  performance: { label: 'Performance score', value: row => row.performance, display: row => row.performance.toFixed(1) },
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
  lapSpread: { label: 'Avg fastest-to-average gap', lower: true, value: row => row.lapSpreadAverage ?? Infinity, display: row => row.lapSpreadAverage === null ? '—' : `${row.lapSpreadAverage.toFixed(3)}s` },
  qualifyingAverage: { label: 'Average qualifying position', lower: true, value: row => row.qualifyingAverage ?? Infinity, display: row => row.qualifyingAverage === null ? '—' : row.qualifyingAverage.toFixed(1) },
  fastestLap: { label: 'Fastest lap', lower: true, value: row => row.fastestLap, display: row => Number.isFinite(row.fastestLap) ? `${row.fastestLap.toFixed(3)}s` : '—' },
  placesGained: { label: 'Average places gained', value: row => row.placesGainedAverage ?? -Infinity, display: row => row.placesGainedAverage === null ? '—' : `${row.placesGainedAverage >= 0 ? '+' : ''}${row.placesGainedAverage.toFixed(1)}` }
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

function renderLeaderboard() {
  const rows = calculateLeaderboard();
  const metric = leaderboardMetrics[$('leaderboardMetric')?.value || 'average'] || leaderboardMetrics.average;
  if ($('leaderboardMetricHeading')) $('leaderboardMetricHeading').textContent = metric.label;
  $('leaderboardCount').textContent = `${fmt.format(rows.length)} ranked · ${fmt.format(state.leaderboardEligibleCount)} recorded`;
  $('leaderboardBody').innerHTML = rows.length ? rows.map(row => `
    <tr>
      <td>${row.rank}</td><td><button type="button" class="driver-name" data-driver-key="${escapeHtml(row.driverKey)}">${escapeHtml(row.name)}</button></td><td class="ranked-metric">${escapeHtml(metric.display ? metric.display(row) : metric.value(row))}</td><td>${row.finals}</td>
      <td>${row.average.toFixed(1)}</td><td>${row.best}</td><td>${countAndRate(row.topFive, row.finals)}</td>
      <td>${countAndRate(row.podiums, row.finals)}</td><td>${row.overallWins}</td>
      <td>${row.performance.toFixed(1)}</td><td>${row.consistency === null ? '—' : `${row.consistency.toFixed(1)}%`}</td>
    </tr>`).join('') : '<tr><td colspan="11">No drivers match these filters.</td></tr>';
}

function renderRaceExplorer(raceId) {
  const data = state.data;
  const race = data.raceById[raceId];
  const body = $('raceExplorerResults');
  if (!race) {
    $('raceResultTitle').textContent = 'No races match these filters';
    body.innerHTML = '<tr><td colspan="8">Choose a different event or class.</td></tr>';
    $('raceResultLink').hidden = true;
    $('raceVideoLink').hidden = true;
    return;
  }
  const event = data.eventById[race.e];
  $('raceResultTitle').textContent = `${event?.n || ''} — ${race.n}`;
  $('raceEventLink').href = event?.u || '#';
  $('raceEventLink').hidden = !event?.u;
  $('raceResultLink').href = race.u || '#';
  $('raceResultLink').hidden = !race.u;
  const video = data.videos.find(item => item.raceId === raceId);
  $('raceVideoLink').href = video?.url || '#';
  $('raceVideoLink').textContent = video ? `Watch ${video.round || 'race'} video ▶` : 'Watch race video ▶';
  $('raceVideoLink').hidden = !video;
  const rows = data.raceResults.filter(row => row[0] === raceId).sort((a, b) => a[2] - b[2]);
  body.innerHTML = rows.length ? rows.map(row => `
    <tr><td>${row[2] || '—'}</td><td><button type="button" class="driver-name" data-driver-key="${escapeHtml(row[1])}">${escapeHtml(data.driverByKey[row[1]] || row[1])}</button></td>
    <td>${row[8] ? `P${row[8]}` : '—'}</td><td>${escapeHtml(row[3] || '—')}</td><td>${escapeHtml(row[4] || '—')}</td>
    <td>${escapeHtml(row[5] || '—')}</td><td>${escapeHtml(row[6] || '—')}</td><td>${escapeHtml(row[7] || '—')}</td></tr>`).join('') : '<tr><td colspan="8">No results were recorded for this race.</td></tr>';
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

function profileStat(value, label) {
  return `<article><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></article>`;
}

function distanceJourneyStat(runs, driverKey) {
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

function journeyRouteAt(distanceKm) {
  const capped = Math.max(0, Math.min(distanceKm, journeyRoadDistanceKm));
  const segmentLengths = [];
  let geographicTotal = 0;
  for (let index = 1; index < journeyRoadRoute.length; index += 1) {
    const length = geoKm(journeyRoadRoute[index - 1], journeyRoadRoute[index]);
    segmentLengths.push(length);
    geographicTotal += length;
  }
  const target = geographicTotal * capped / journeyRoadDistanceKm;
  const travelled = [journeyRoadRoute[0]];
  let accumulated = 0;
  for (let index = 1; index < journeyRoadRoute.length; index += 1) {
    const length = segmentLengths[index - 1];
    if (accumulated + length >= target) {
      const fraction = length ? (target - accumulated) / length : 0;
      const start = journeyRoadRoute[index - 1];
      const end = journeyRoadRoute[index];
      const point = [start[0] + (end[0] - start[0]) * fraction, start[1] + (end[1] - start[1]) * fraction];
      travelled.push(point);
      return { point, travelled };
    }
    travelled.push(journeyRoadRoute[index]);
    accumulated += length;
  }
  return { point: journeyRoadRoute.at(-1), travelled: journeyRoadRoute.slice() };
}

const journeyMilestoneData = [
  ['Cardiff', 0], ['London', 236], ['Calais', 417], ['Reims', 677], ['Saarbrücken', 920],
  ['Munich', 1377], ['Innsbruck', 1538], ['Verona', 1799], ['Rome', 2293],
  ['Zagreb', 3181], ['Belgrade', 3581], ['Sofia', 3968], ['Istanbul', 4522]
];

function journeyDriverDistances(cutoffDate = '9999-12-31') {
  const stats = new Map();
  for (const run of state.data.raceResults) {
    const race = state.data.raceById[run[0]];
    if (!race || race.d < '2022-01-01' || race.d > cutoffDate) continue;
    if (!stats.has(run[1])) stats.set(run[1], { laps: 0, runs: 0, events: new Set(), classes: new Set(), lastDate: '', lastEventId: '' });
    const row = stats.get(run[1]);
    row.laps += completedLaps(run);
    row.runs += 1;
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
    km: Number((row.laps * 0.15).toFixed(1)),
    laps: row.laps,
    runs: row.runs,
    events: row.events.size,
    classes: [...row.classes],
    lastDate: row.lastDate,
    lastEvent: state.data.eventById[row.lastEventId]?.n || ''
  })).filter(driver => driver.km > 0);
}

function stopJourneyPlayback() {
  if (journeyPlaybackTimer) clearInterval(journeyPlaybackTimer);
  journeyPlaybackTimer = null;
  if ($('journeyPlay')) $('journeyPlay').textContent = '▶ Play 2-minute journey';
}

function buildJourneyTimeline(endDate, frameCount = 121) {
  const startMs = Date.parse('2022-01-01T12:00:00Z');
  const endMs = Math.max(startMs, Date.parse(`${endDate}T12:00:00Z`));
  return Array.from({ length: frameCount }, (_, index) => {
    const progress = index / (frameCount - 1);
    return new Date(startMs + (endMs - startMs) * progress).toISOString().slice(0, 10);
  });
}

function journeyCutoffDate() {
  return journeyTimelineDates[Number($('journeyDateSlider').value)] || journeyTimelineDates.at(-1) || '9999-12-31';
}

function renderJourneyMap({ resetView = false, focusDriver = false } = {}) {
  if (!window.L || !journeyMap) return;
  const cutoffDate = journeyCutoffDate();
  const drivers = journeyDriverDistances(cutoffDate).sort((a, b) => b.km - a.km);
  const selectedName = state.data.driverByKey[journeySelectedKey] || 'Selected driver';
  const selected = drivers.find(driver => driver.driverKey === journeySelectedKey) || { driverKey: journeySelectedKey, name: selectedName, km: 0, laps: 0, runs: 0, events: 0, classes: [], lastDate: '', lastEvent: '' };
  const latest = cutoffDate === journeyTimelineDates.at(-1);
  $('journeyDateLabel').textContent = latest ? `Latest · ${dateFmt.format(new Date(`${cutoffDate}T12:00:00Z`))}` : dateFmt.format(new Date(`${cutoffDate}T12:00:00Z`));
  $('journeyMapTitle').textContent = `${selected.name} — ${fmt.format(kmToMiles(selected.km))} miles`;
  const routeStatus = selected.km > journeyRoadDistanceKm ? `They have reached Istanbul and covered a further ${fmt.format(kmToMiles(selected.km - journeyRoadDistanceKm))} miles.` : `Their pin shows the equivalent point reached along the route.`;
  $('journeyMapCopy').textContent = `Combined distance from every recorded class and official event since 1 January 2022. ${routeStatus} Click any pin for its driver summary, search for a driver, or play the journey through time.`;

  journeyMapLayers.clearLayers();
  journeyDriverMarkers = new Map();
  window.L.polyline(journeyRoadRoute, { color: '#6f7972', weight: 5, opacity: .65 }).addTo(journeyMapLayers);
  const selectedRoute = journeyRouteAt(selected.km);
  window.L.polyline(selectedRoute.travelled, { color: '#08a31a', weight: 7, opacity: .9 }).addTo(journeyMapLayers);

  for (const [name, km] of journeyMilestoneData) {
    const point = journeyRouteAt(km).point;
    window.L.circleMarker(point, { radius: 4, color: '#fff', weight: 1, fillColor: selected.km >= km ? '#08a31a' : '#778078', fillOpacity: 1 })
      .bindTooltip(`${escapeHtml(name)} · ${fmt.format(kmToMiles(km))} miles`, { direction: 'top' }).addTo(journeyMapLayers);
  }
  const nextMilestone = journeyMilestoneData.find(([, km]) => km > selected.km);
  $('journeyMilestones').innerHTML = journeyMilestoneData.map(([name, km]) => `<span class="${selected.km >= km ? 'reached' : nextMilestone?.[0] === name ? 'next' : ''}">${selected.km >= km ? '✓ ' : ''}${escapeHtml(name)} <small>${fmt.format(kmToMiles(km))} miles</small></span>`).join('');

  const driverLimit = Number($('journeyDriverLimit').value);
  const displayedDrivers = driverLimit ? drivers.slice(0, driverLimit) : drivers.slice();
  if (!displayedDrivers.some(driver => driver.driverKey === journeySelectedKey) && drivers.some(driver => driver.driverKey === journeySelectedKey)) {
    displayedDrivers.push(drivers.find(driver => driver.driverKey === journeySelectedKey));
  }

  for (const driver of displayedDrivers) {
    const route = journeyRouteAt(driver.km);
    const selectedDriver = driver.driverKey === journeySelectedKey;
    const icon = window.L.divIcon({ className: 'journey-driver-icon', html: `<i class="${selectedDriver ? 'selected' : ''}"></i>`, iconSize: [18, 24], iconAnchor: [9, 21] });
    const classText = driver.classes.map(cls => classLabels[cls] || cls).join(', ');
    const lastEvent = driver.lastEvent ? `<small>Latest: ${escapeHtml(driver.lastEvent)} · ${dateFmt.format(new Date(`${driver.lastDate}T12:00:00Z`))}</small>` : '';
    const popup = `<div class="journey-driver-popup"><b>${escapeHtml(driver.name)}</b><strong>${fmt.format(kmToMiles(driver.km))} miles</strong><span>${fmt.format(driver.laps)} laps · ${driver.events} events · ${driver.runs} runs</span><span>${escapeHtml(classText)}</span>${lastEvent}</div>`;
    const marker = window.L.marker(route.point, { icon, zIndexOffset: selectedDriver ? 1000 : 0 })
      .bindTooltip(escapeHtml(driver.name), { permanent: true, direction: 'top', offset: [0, -18], className: `journey-driver-label${selectedDriver ? ' selected' : ''}` })
      .bindPopup(popup).addTo(journeyMapLayers);
    journeyDriverMarkers.set(driver.driverKey, marker);
  }
  window.L.circleMarker(journeyRoadRoute[0], { radius: 7, color: '#fff', weight: 2, fillColor: '#067b14', fillOpacity: 1 }).bindTooltip('House of Sport, Cardiff', { permanent: true, direction: 'right' }).addTo(journeyMapLayers);
  window.L.circleMarker(journeyRoadRoute.at(-1), { radius: 7, color: '#fff', weight: 2, fillColor: '#17211a', fillOpacity: 1 }).bindTooltip('Istanbul, Türkiye', { permanent: true, direction: 'left' }).addTo(journeyMapLayers);
  if (resetView) journeyMap.fitBounds(window.L.latLngBounds(journeyRoadRoute), { padding: [24, 24] });
  if (focusDriver && journeyDriverMarkers.has(journeySelectedKey)) {
    const marker = journeyDriverMarkers.get(journeySelectedKey);
    journeyMap.setView(marker.getLatLng(), Math.max(journeyMap.getZoom(), 8));
    marker.openPopup();
  }
}

function selectJourneyDriver() {
  const query = $('journeyDriverSearch').value.trim().toLowerCase();
  if (!query) return;
  const driver = state.data.drivers.find(row => row.n.toLowerCase() === query) || state.data.drivers.find(row => row.n.toLowerCase().includes(query));
  if (!driver) return;
  journeySelectedKey = driver.k;
  $('journeyDriverSearch').value = driver.n;
  renderJourneyMap({ focusDriver: true });
}

function toggleJourneyPlayback() {
  if (journeyPlaybackTimer) {
    stopJourneyPlayback();
    return;
  }
  const slider = $('journeyDateSlider');
  if (Number(slider.value) >= Number(slider.max)) {
    slider.value = '0';
    renderJourneyMap();
  }
  $('journeyPlay').textContent = '❚❚ Pause';
  const frameInterval = journeyPlaybackDurationMs / Math.max(1, journeyTimelineDates.length - 1);
  journeyPlaybackTimer = setInterval(() => {
    const next = Number(slider.value) + 1;
    if (next > Number(slider.max)) {
      stopJourneyPlayback();
      return;
    }
    slider.value = String(next);
    renderJourneyMap();
  }, frameInterval);
}

function openJourneyMap(driverKey) {
  journeySelectedKey = driverKey;
  const latestDate = state.data.meta.latestEventDate || Object.values(state.data.raceById).map(race => race.d).sort().at(-1) || '2022-01-01';
  journeyTimelineDates = buildJourneyTimeline(latestDate);
  const slider = $('journeyDateSlider');
  slider.max = String(Math.max(0, journeyTimelineDates.length - 1));
  slider.value = slider.max;
  $('journeyDriverOptions').innerHTML = state.data.drivers.slice().sort((a, b) => a.n.localeCompare(b.n)).map(driver => `<option value="${escapeHtml(driver.n)}"></option>`).join('');
  $('journeyDriverSearch').value = state.data.driverByKey[driverKey] || '';
  $('journeyMapOverlay').hidden = false;
  stopJourneyPlayback();
  requestAnimationFrame(() => {
    if (!window.L) {
      $('journeyMap').textContent = 'The road map could not be loaded. Please check the internet connection and try again.';
      return;
    }
    if (!journeyMap) {
      journeyMap = window.L.map('journeyMap', { zoomControl: true });
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(journeyMap);
      journeyMapLayers = window.L.layerGroup().addTo(journeyMap);
    }
    renderJourneyMap({ resetView: true });
    setTimeout(() => journeyMap.invalidateSize(), 50);
  });
}

function completedLaps(run) {
  const match = String(run[3] || '').match(/^(\d+)\//);
  return match ? Number(match[1]) : 0;
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
  const lapSpreads = consistencyRuns.map(row => Number.parseFloat(row[6]) - Number.parseFloat(row[5])).filter(value => Number.isFinite(value) && value >= 0);
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
  const keptPerformances = attendanceAdjustedResults(results.map(performanceFor), true);
  const keptConsistencies = attendanceAdjustedResults(consistencies, true);
  const performance = average(keptPerformances);

  const typeLabel = eventType === 'sword' ? 'SWORD' : eventType === 'club' ? 'Club Days' : eventType === 'other' ? 'Other official events' : 'All official events';
  const classLabel = className === 'senior' ? 'All senior classes' : (classLabels[className] || className || 'All classes');
  const fromLabel = from ? dateFmt.format(new Date(`${from}T12:00:00Z`)) : 'Beginning of archive';
  const toLabel = to ? dateFmt.format(new Date(`${to}T12:00:00Z`)) : 'Latest result';
  $('driverProfileName').textContent = `${driver.n}${driver.j ? ' — Junior' : ''}`;
  $('driverProfileContext').textContent = `${fromLabel} to ${toLabel} · ${typeLabel} · ${classLabel}`;
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
  $('driverClassDetails').innerHTML = [...classes].sort(([a], [b]) => a.localeCompare(b)).map(([cls, rows]) => {
    const classPositions = rows.map(row => row[4]);
    const classTopFive = classPositions.filter(value => value <= 5).length;
    const classPodiums = classPositions.filter(value => value <= 3).length;
    const classOverallWins = classPositions.filter(value => value === 1).length;
    const classTqs = rows.filter(row => Number(row[5]) === 1).length;
    const classKeptPositions = attendanceAdjustedResults(classPositions);
    const classKeptPerformance = attendanceAdjustedResults(rows.map(performanceFor), true);
    const classRuns = runsByClass.get(cls) || [];
    const classEntries = entries.filter(row => row[2] === cls).length;
    const classRaceWins = classRuns.filter(row => Number(row[2]) === 1).length;
    const fastestLaps = classRuns.map(row => Number.parseFloat(row[5])).filter(value => Number.isFinite(value) && value > 0);
    const classConsistencies = classRuns.filter(row => isCompleteConsistencyRun(row, data)).map(row => Number.parseFloat(row[7])).filter(Number.isFinite);
    return `<tr><td>${escapeHtml(cls)}</td><td>${classEntries}</td><td>${classRuns.length}</td><td>${fmt.format(totalLaps(classRuns))}</td><td>${distanceRaced(classRuns)}</td><td>${trackTime(classRuns)}</td><td>${rows.length}</td><td>${average(classKeptPositions).toFixed(1)}</td><td>${Math.min(...classPositions)}</td><td>${countAndRate(classTopFive, rows.length)}</td><td>${countAndRate(classPodiums, rows.length)}</td><td>${classOverallWins}</td><td>${classRaceWins}</td><td>${classTqs}</td><td>${average(classKeptPerformance).toFixed(1)}</td><td>${fastestLaps.length ? `${Math.min(...fastestLaps).toFixed(3)}s` : '—'}</td><td>${classConsistencies.length ? `${average(classConsistencies).toFixed(1)}%` : '—'}</td></tr>`;
  }).join('') || '<tr><td colspan="17">No completed finals within these filters.</td></tr>';

  $('driverConsistencyDetails').innerHTML = [...runsByClass].sort(([a], [b]) => a.localeCompare(b)).map(([cls, classRuns]) => {
    const completeRuns = classRuns.filter(run => isCompleteConsistencyRun(run, data));
    const values = completeRuns.map(run => Number.parseFloat(run[7])).filter(Number.isFinite);
    if (!values.length) return '';
    const adjusted = attendanceAdjustedResults(values, true);
    const gaps = completeRuns.map(run => Number.parseFloat(run[6]) - Number.parseFloat(run[5])).filter(value => Number.isFinite(value) && value >= 0);
    const band = predicate => countAndRate(values.filter(predicate).length, values.length);
    return `<tr><td>${escapeHtml(cls)}</td><td>${values.length}</td><td>${average(adjusted).toFixed(1)}%</td><td>${Math.max(...values).toFixed(1)}%</td><td>${band(value => value >= 98)}</td><td>${band(value => value >= 95 && value < 98)}</td><td>${band(value => value >= 90 && value < 95)}</td><td>${band(value => value < 90)}</td><td>${gaps.length ? `${average(gaps).toFixed(3)}s` : '—'}</td></tr>`;
  }).join('') || '<tr><td colspan="9">No consistency data within these filters.</td></tr>';

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
    const runRows = eventRuns.map(run => {
      const race = data.raceById[run[0]];
      const raceName = race.u ? `<a href="${escapeHtml(race.u)}" target="_blank" rel="noopener">${escapeHtml(race.n)}</a>` : escapeHtml(race.n);
      const video = data.videos.find(item => item.raceId === run[0]);
      const videoLink = video ? `<a class="race-video-inline" href="${escapeHtml(video.url)}" target="_blank" rel="noopener">Watch ▶</a>` : '—';
      return `<tr><td>${escapeHtml(race.r)}</td><td>${raceName}</td><td>P${run[2]}</td><td>${escapeHtml(run[3] || '—')}</td><td>${escapeHtml(run[5] || '—')}</td><td>${escapeHtml(run[6] || '—')}</td><td>${escapeHtml(run[7] || '—')}</td><td>${videoLink}</td></tr>`;
    }).join('');
    const raceDrilldown = `<details class="inline-races"><summary>${eventRuns.length} race${eventRuns.length === 1 ? '' : 's'}</summary><div class="table-wrap"><table><thead><tr><th>Round</th><th>Race</th><th>Pos</th><th>Laps/time</th><th>Fastest</th><th>Average</th><th>Consistency</th><th>Video</th></tr></thead><tbody>${runRows}</tbody></table></div></details>`;
    return `<tr><td>${dateFmt.format(new Date(`${date}T12:00:00Z`))}</td><td>${eventName}</td><td>${escapeHtml(cls)}</td><td>P${position}</td><td>${finalName}</td><td>${qualifyingPosition ? `P${qualifyingPosition}` : '—'}</td><td>${escapeHtml(final?.row[3] || publishedResult || '—')}</td><td>${escapeHtml(final?.row[5] || '—')}</td><td>${eventConsistency === null ? '—' : `${eventConsistency.toFixed(1)}%`}</td><td>${raceDrilldown}</td></tr>`;
  }).join('') || '<tr><td colspan="10">No completed finals within these filters.</td></tr>';

  state.profileKey = driverKey;
  const dialog = $('driverDialog');
  if (!dialog.open) {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }
}

function finalResultCell(position, row, otherPosition) {
  if (!row) return '<span class="result-cell">—</span>';
  const [, , pos, lapsTime, , fastestLap, averageLap, consistency] = row;
  const winning = Number(position ?? pos) < Number(otherPosition);
  return `<span class="result-cell">
    <strong class="${winning ? 'winner' : ''}">P${position ?? pos} · ${escapeHtml(lapsTime || 'No time')}</strong>
    <small>Fastest: ${escapeHtml(fastestLap || '—')}</small>
    <small>Average: ${escapeHtml(averageLap || '—')} · Consistency: ${escapeHtml(consistency || '—')}</small>
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
  try {
    const [response, videoResponse] = await Promise.all([
      fetch('data/dashboard.json', { cache: 'no-cache' }),
      fetch('data/videos.json', { cache: 'no-cache' })
    ]);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const videoData = videoResponse.ok ? await videoResponse.json() : { videos: [] };
    data.videos = videoData.videos || [];
    data.eventById = Object.fromEntries(data.events.map(event => [event.i, event]));
    data.driverByKey = Object.fromEntries(data.drivers.map(driver => [driver.k, driver.n]));
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
    const driverOptions = data.drivers.slice().sort((a, b) => a.n.localeCompare(b.n)).map(driver => `<option value="${escapeHtml(driver.k)}">${escapeHtml(driver.n)}${driver.j ? ' (Junior)' : ''}</option>`).join('');
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
    $('leaderboardMetric').addEventListener('change', renderLeaderboard);
    $('raceEvent').addEventListener('change', () => updateRaceSelection(false));
    $('raceSelection').addEventListener('change', () => renderRaceExplorer($('raceSelection').value));
    $('raceExplorerResults').addEventListener('click', event => {
      const button = event.target.closest('[data-driver-key]');
      if (button) driverProfile(button.dataset.driverKey);
    });
    $('leaderboardBody').addEventListener('click', event => {
      const button = event.target.closest('[data-driver-key]');
      if (button) driverProfile(button.dataset.driverKey);
    });
    $('driverProfileStats').addEventListener('click', event => {
      const button = event.target.closest('[data-journey-driver]');
      if (button) openJourneyMap(button.dataset.journeyDriver);
    });
    $('closeJourneyMap').addEventListener('click', () => {
      stopJourneyPlayback();
      $('journeyMapOverlay').hidden = true;
    });
    $('journeyDriverSearch').addEventListener('change', selectJourneyDriver);
    $('journeyDriverSearch').addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        selectJourneyDriver();
      }
    });
    $('journeyDateSlider').addEventListener('input', () => {
      stopJourneyPlayback();
      renderJourneyMap();
    });
    $('journeyDriverLimit').addEventListener('change', () => renderJourneyMap());
    $('journeyPlay').addEventListener('click', toggleJourneyPlayback);
    $('closeDriverProfile').addEventListener('click', () => $('driverDialog').close());
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
    const requestedDriver = new URLSearchParams(window.location.search).get('driver');
    if (requestedDriver && data.driverByKey[requestedDriver]) driverProfile(requestedDriver);
  } catch (error) {
    $('updatedStatus').textContent = 'Statistics could not be loaded.';
    $('leaderboardBody').innerHTML = `<tr><td colspan="11">${escapeHtml(error.message)}</td></tr>`;
  }
}

ensureEnhancedMarkup();
init();
