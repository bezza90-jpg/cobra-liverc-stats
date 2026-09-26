const $ = id => document.getElementById(id);
const fmt = new Intl.NumberFormat('en-GB');
const dateFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London', hourCycle: 'h23' });
const classLabels = {
  '2-Wheel Drive Buggy': '2WD',
  '4-Wheel Drive Buggy': '4WD',
  'Junior Racers': 'Junior Racers',
  'Trucks': 'Trucks',
  'Vintage': 'Vintage'
};
const state = { data: null, config: null, activeClass: '', activeSeason: '' };

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function overallResult(row) {
  return Number(row[4]) > 0 && /(?:main|final)/i.test(row[7] || '');
}

function pointsFor(position, config) {
  return Math.max(0, config.pointsStart - ((position - 1) * config.pointsStep));
}

function standingComparison(a, b) {
  return b.total - a.total || b.highestDrop - a.highestDrop;
}

function sameRank(a, b) {
  return Boolean(a && b && a.total === b.total && a.highestDrop === b.highestDrop);
}

function seasonForDate(date) {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const startYear = month >= 9 ? year : year - 1;
  return `${startYear}/${String(startYear + 1).slice(-2)}`;
}

function seasonDates(season) {
  if (season === state.config.season) return { startDate: state.config.startDate, endDate: state.config.endDate };
  const startYear = Number(season.slice(0, 4));
  return { startDate: `${startYear}-09-01`, endDate: `${startYear + 1}-04-30` };
}

function availableSeasons() {
  const seasons = new Set(state.data.events.filter(event => event.t === state.config.eventType).map(event => seasonForDate(event.d)));
  seasons.add(state.config.season);
  return [...seasons].sort((a, b) => b.localeCompare(a));
}

function seasonIsPartial(season) {
  const { startDate } = seasonDates(season);
  return startDate < state.data.meta.earliestEventDate;
}

function championshipEvents(className) {
  const { data, config } = state;
  const { startDate, endDate } = seasonDates(state.activeSeason);
  const resultEvents = new Set(data.eventResults.filter(overallResult).map(row => row[0]));
  return data.events.filter(event =>
    event.t === config.eventType &&
    event.d >= startDate && event.d <= endDate &&
    resultEvents.has(event.i)
  ).sort((a, b) => a.d.localeCompare(b.d));
}

function calculateStandings(className, events) {
  const { data, config } = state;
  const eventIds = new Set(events.map(event => event.i));
  const rows = data.eventResults.filter(row => eventIds.has(row[0]) && row[2] === className && overallResult(row));
  const drivers = new Map();

  for (const row of rows) {
    const [eventId, date, , driverKey, position, qualifyingPosition, result] = row;
    const tq = Number(qualifyingPosition) === 1;
    const score = pointsFor(Number(position), config) + (tq ? config.tqBonus : 0);
    if (!drivers.has(driverKey)) drivers.set(driverKey, {
      driverKey,
      name: data.driverByKey[driverKey] || driverKey,
      results: [], wins: 0, podiums: 0, tqs: 0
    });
    const driver = drivers.get(driverKey);
    driver.results.push({ eventId, date, position: Number(position), qualifyingPosition, result, tq, score });
    if (Number(position) === 1) driver.wins += 1;
    if (Number(position) <= 3) driver.podiums += 1;
    if (tq) driver.tqs += 1;
  }

  const standings = [...drivers.values()].map(driver => {
    const ordered = driver.results.slice().sort((a, b) => b.score - a.score || b.date.localeCompare(a.date));
    const counted = ordered.slice(0, config.bestRounds);
    const dropped = ordered.slice(config.bestRounds);
    const countedIds = new Set(counted.map(result => result.eventId));
    return {
      ...driver,
      countedIds,
      total: counted.reduce((sum, result) => sum + result.score, 0),
      highestDrop: dropped.length ? Math.max(...dropped.map(result => result.score)) : 0,
      dropped
    };
  }).sort((a, b) => standingComparison(a, b) || a.name.localeCompare(b.name));

  let displayedRank = 0;
  return standings.map((driver, index) => {
    if (!sameRank(driver, standings[index - 1])) displayedRank = index + 1;
    return { ...driver, rank: displayedRank, tied: sameRank(driver, standings[index - 1]) || sameRank(driver, standings[index + 1]) };
  });
}

function eventCell(driver, event) {
  const result = driver.results.find(row => row.eventId === event.i);
  if (!result) return '<td class="round-score empty-score">—</td>';
  const dropped = !driver.countedIds.has(event.i);
  const detail = `P${result.position}${result.tq ? ' · TQ' : ''}`;
  const content = `<strong>${result.score}</strong><small>${detail}${dropped ? ' · Drop' : ''}</small>`;
  return `<td class="round-score${dropped ? ' dropped-score' : ''}">${event.u ? `<a href="${escapeHtml(event.u)}" target="_blank" rel="noopener">${content}</a>` : content}</td>`;
}

function render() {
  const { data, config, activeClass } = state;
  const events = championshipEvents(activeClass);
  const standings = calculateStandings(activeClass, events);
  const dates = seasonDates(state.activeSeason);
  const completedSeason = state.activeSeason !== availableSeasons()[0];
  const roundTarget = completedSeason ? events.length : config.scheduledRounds;

  document.title = `${config.title} ${state.activeSeason} | COBRA`;
  document.querySelectorAll('[data-class]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.class === activeClass)));
  $('roundsHeld').textContent = `${events.length} / ${roundTarget || events.length}`;
  $('driversEntered').textContent = fmt.format(standings.length);
  $('latestRound').textContent = events.length ? dateFmt.format(new Date(`${events.at(-1).d}T12:00:00Z`)) : 'Not started';
  $('standingsClass').textContent = classLabels[activeClass] || activeClass;
  $('championshipSeason').textContent = `${state.activeSeason} championship standings${seasonIsPartial(state.activeSeason) ? ' · partial archive' : ''}`;
  $('championshipDates').textContent = `${dateFmt.format(new Date(`${dates.startDate}T12:00:00Z`))} to ${dateFmt.format(new Date(`${dates.endDate}T12:00:00Z`))}`;

  const roundHeaders = events.map((event, index) => `<th scope="col"><a href="${escapeHtml(event.u)}" target="_blank" rel="noopener">R${index + 1}</a><small>${dateFmt.format(new Date(`${event.d}T12:00:00Z`))}</small></th>`).join('');
  $('standingsHead').innerHTML = `<tr><th scope="col">Pos</th><th scope="col">Driver</th><th scope="col">Rounds</th>${roundHeaders}<th scope="col">Dropped</th><th scope="col">Best ${config.bestRounds}</th><th scope="col">TQs</th><th scope="col">Wins</th></tr>`;

  $('standingsBody').innerHTML = standings.length ? standings.map(driver => {
    const roundCells = events.map(event => eventCell(driver, event)).join('');
    return `<tr>
      <td>${driver.rank}${driver.tied ? '=' : ''}</td>
      <td><a class="driver-name" href="../?driver=${encodeURIComponent(driver.driverKey)}">${escapeHtml(driver.name)}</a></td>
      <td>${driver.results.length}</td>${roundCells}
      <td>${driver.highestDrop || '—'}</td><td class="championship-total">${driver.total}</td><td>${driver.tqs}</td><td>${driver.wins}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="${8 + events.length}" class="empty-standings">No ${escapeHtml(classLabels[activeClass] || activeClass)} results have been published for this championship yet.</td></tr>`;

  $('roundLinks').innerHTML = events.length ? events.map((event, index) => `<a class="event-link" href="${escapeHtml(event.u)}" target="_blank" rel="noopener">Round ${index + 1}: ${escapeHtml(event.n)}</a>`).join('') : '<p class="empty-state">Rounds will appear automatically after LiveRC publishes the results.</p>';
  $('rulesSummary').textContent = `100 points for 1st, reducing by one point per overall position. TQ earns 1 bonus point. Up to the best ${config.bestRounds} rounds count. DNS and DNF score their published overall position. Ties are decided by the highest dropped score; if that is also equal, the position remains tied.`;

  const url = new URL(window.location.href);
  url.searchParams.set('season', state.activeSeason.replace('/', '-'));
  url.searchParams.set('class', activeClass);
  window.history.replaceState({}, '', url);
}

async function init() {
  try {
    const championshipKey = document.body.dataset.championship;
    const [dataResponse, configResponse] = await Promise.all([
      fetch('../data/championship-results.json', { cache: 'no-cache' }),
      fetch('../data/championships.json', { cache: 'no-cache' })
    ]);
    if (!dataResponse.ok || !configResponse.ok) throw new Error('Championship data could not be loaded.');
    const data = await dataResponse.json();
    const configs = await configResponse.json();
    const config = configs[championshipKey];
    if (!config) throw new Error('Championship configuration is missing.');
    data.driverByKey = Object.fromEntries(data.drivers.map(driver => [driver.k, driver.n]));
    state.data = data;
    state.config = config;
    const params = new URLSearchParams(window.location.search);
    const requestedSeason = (params.get('season') || '').replace('-', '/');
    const requestedClass = params.get('class') || '';
    const seasons = availableSeasons();
    state.activeSeason = seasons.includes(requestedSeason) ? requestedSeason : seasons[0];
    state.activeClass = config.classes.includes(requestedClass) ? requestedClass : config.classes[0];

    document.title = `${config.title} ${config.season} | COBRA`;
    $('championshipTitle').textContent = config.title;
    $('updatedStatus').textContent = `Last updated ${dateTimeFmt.format(new Date(data.meta.generatedAt))} UK time`;
    $('seasonSelect').innerHTML = seasons.map(season => `<option value="${season}"${season === state.activeSeason ? ' selected' : ''}>${season}${seasonIsPartial(season) ? ' (partial archive)' : ''}</option>`).join('');
    $('classTabs').innerHTML = config.classes.map(className => `<button type="button" data-class="${escapeHtml(className)}" aria-pressed="${className === state.activeClass}">${escapeHtml(classLabels[className] || className)}</button>`).join('');
    $('seasonSelect').addEventListener('change', () => {
      state.activeSeason = $('seasonSelect').value;
      render();
    });
    $('classTabs').addEventListener('click', event => {
      const button = event.target.closest('[data-class]');
      if (!button) return;
      state.activeClass = button.dataset.class;
      render();
    });
    render();
  } catch (error) {
    $('updatedStatus').textContent = error.message;
    $('standingsBody').innerHTML = `<tr><td>${escapeHtml(error.message)}</td></tr>`;
  }
}

init();
