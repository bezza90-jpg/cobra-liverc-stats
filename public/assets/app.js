const state = { data: null };
const $ = id => document.getElementById(id);
const fmt = new Intl.NumberFormat('en-GB');
const dateFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function inRange(date, from, to) {
  return (!from || date >= from) && (!to || date <= to);
}

function filters() {
  return {
    from: $('fromDate').value,
    to: $('toDate').value,
    className: $('classFilter').value,
    search: $('driverSearch').value.trim().toUpperCase()
  };
}

function calculateLeaderboard() {
  const { from, to, className, search } = filters();
  const data = state.data;
  const stats = new Map(data.drivers.map(driver => [driver.k, {
    driverKey: driver.k, name: driver.n, events: new Set(), entries: 0, tq: 0,
    aWins: 0, lowerWins: 0, raceWins: 0
  }]));

  for (const [eventId, date, cls, driverKey] of data.entries) {
    if (!inRange(date, from, to) || (className && cls !== className)) continue;
    const row = stats.get(driverKey);
    if (!row) continue;
    row.events.add(eventId);
    row.entries += 1;
  }
  for (const [, date, cls, driverKey, , qualifyingPosition] of data.eventResults) {
    if (!inRange(date, from, to) || (className && cls !== className)) continue;
    if (qualifyingPosition === 1 && stats.has(driverKey)) stats.get(driverKey).tq += 1;
  }
  for (const [raceId, driverKey, position] of data.raceResults) {
    const race = data.raceById[raceId];
    if (!race || !inRange(race.d, from, to) || (className && race.c !== className)) continue;
    const row = stats.get(driverKey);
    if (!row || position !== 1) continue;
    row.raceWins += 1;
    if (race.f && race.m === 'A') row.aWins += 1;
    else if (race.f && race.m) row.lowerWins += 1;
  }

  return [...stats.values()]
    .map(row => ({ ...row, events: row.events.size }))
    .filter(row => row.entries > 0 && (!search || row.name.includes(search)))
    .sort((a, b) => b.aWins - a.aWins || b.tq - a.tq || b.events - a.events || a.name.localeCompare(b.name));
}

function renderLeaderboard() {
  const rows = calculateLeaderboard();
  $('leaderboardCount').textContent = `${fmt.format(rows.length)} driver${rows.length === 1 ? '' : 's'}`;
  $('leaderboardBody').innerHTML = rows.length ? rows.map(row => `
    <tr>
      <td>${escapeHtml(row.name)}</td><td>${row.events}</td><td>${row.entries}</td>
      <td>${row.tq}</td><td>${row.aWins}</td><td>${row.lowerWins}</td><td>${row.raceWins}</td>
    </tr>`).join('') : '<tr><td colspan="7">No drivers match these filters.</td></tr>';
}

function compareDrivers() {
  const aKey = $('driverA').value;
  const bKey = $('driverB').value;
  if (!aKey || !bKey || aKey === bKey) {
    $('h2hResults').hidden = true;
    $('h2hEmpty').hidden = false;
    $('h2hEmpty').textContent = aKey && aKey === bKey ? 'Choose two different drivers.' : 'Choose two drivers to compare results within the selected dates and class.';
    return;
  }

  const { from, to, className } = filters();
  const data = state.data;
  const nameA = data.driverByKey[aKey];
  const nameB = data.driverByKey[bKey];
  const filteredEntries = data.entries.filter(([, date, cls]) => inRange(date, from, to) && (!className || cls === className));
  const attendance = key => {
    const map = new Map();
    for (const [eventId, , cls, driverKey] of filteredEntries) {
      if (driverKey !== key) continue;
      if (!map.has(eventId)) map.set(eventId, new Set());
      map.get(eventId).add(cls);
    }
    return map;
  };
  const attendanceA = attendance(aKey);
  const attendanceB = attendance(bKey);
  const shared = [...attendanceA.keys()].filter(id => attendanceB.has(id));

  const eventMapB = new Map();
  for (const row of data.eventResults) {
    const [eventId, date, cls, driverKey] = row;
    if (driverKey === bKey && inRange(date, from, to) && (!className || cls === className)) eventMapB.set(`${eventId}|${cls}`, row);
  }
  const eventMeetings = [];
  for (const rowA of data.eventResults) {
    const [eventId, date, cls, driverKey, positionA] = rowA;
    if (driverKey !== aKey || !inRange(date, from, to) || (className && cls !== className)) continue;
    const rowB = eventMapB.get(`${eventId}|${cls}`);
    if (!rowB) continue;
    eventMeetings.push({ eventId, date, cls, a: positionA, b: rowB[4] });
  }

  const raceMapB = new Map(data.raceResults.filter(row => row[1] === bKey).map(row => [row[0], row]));
  const raceMeetings = [];
  for (const [raceId, driverKey, positionA] of data.raceResults) {
    if (driverKey !== aKey) continue;
    const race = data.raceById[raceId];
    const rowB = raceMapB.get(raceId);
    if (!race || !rowB || !inRange(race.d, from, to) || (className && race.c !== className)) continue;
    raceMeetings.push({ raceId, race, a: positionA, b: rowB[2] });
  }

  const score = rows => ({ a: rows.filter(x => x.a < x.b).length, b: rows.filter(x => x.b < x.a).length, ties: rows.filter(x => x.a === x.b).length });
  const eventScore = score(eventMeetings);
  const raceScore = score(raceMeetings);
  $('sharedEvents').textContent = shared.length;
  $('eventMeetings').textContent = eventMeetings.length;
  $('raceMeetings').textContent = raceMeetings.length;
  $('eventScoreA').textContent = eventScore.a;
  $('eventScoreB').textContent = eventScore.b;
  $('raceScoreA').textContent = raceScore.a;
  $('raceScoreB').textContent = raceScore.b;
  $('eventHeadA').textContent = nameA;
  $('eventHeadB').textContent = nameB;
  $('raceHeadA').textContent = nameA;
  $('raceHeadB').textContent = nameB;
  $('comparisonSummary').textContent = `${nameA} leads ${eventScore.a}–${eventScore.b} in event comparisons and ${raceScore.a}–${raceScore.b} in individual races. Event ties: ${eventScore.ties}; race ties: ${raceScore.ties}.`;

  const position = (value, other) => `<span class="${value < other ? 'winner' : ''}">${value || '–'}</span>`;
  $('eventDetails').innerHTML = eventMeetings.sort((a, b) => b.date.localeCompare(a.date)).map(row => {
    const event = data.eventById[row.eventId];
    return `<tr><td>${dateFmt.format(new Date(`${row.date}T12:00:00Z`))}</td><td>${escapeHtml(event?.n || row.eventId)}</td><td>${escapeHtml(row.cls)}</td><td>${position(row.a, row.b)}</td><td>${position(row.b, row.a)}</td></tr>`;
  }).join('') || '<tr><td colspan="5">No same-class event comparisons.</td></tr>';
  $('raceDetails').innerHTML = raceMeetings.sort((a, b) => b.race.d.localeCompare(a.race.d)).map(row => {
    const event = data.eventById[row.race.e];
    return `<tr><td>${dateFmt.format(new Date(`${row.race.d}T12:00:00Z`))}</td><td>${escapeHtml(event?.n || '')}<br><small>${escapeHtml(row.race.n)}</small></td><td>${escapeHtml(row.race.c)}</td><td>${position(row.a, row.b)}</td><td>${position(row.b, row.a)}</td></tr>`;
  }).join('') || '<tr><td colspan="5">No individual race comparisons.</td></tr>';

  $('h2hEmpty').hidden = true;
  $('h2hResults').hidden = false;
}

function refresh() {
  renderLeaderboard();
  if (!$('h2hResults').hidden) compareDrivers();
}

async function init() {
  try {
    const response = await fetch('data/dashboard.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    data.eventById = Object.fromEntries(data.events.map(event => [event.i, event]));
    data.driverByKey = Object.fromEntries(data.drivers.map(driver => [driver.k, driver.n]));
    state.data = data;
    $('eventTotal').textContent = fmt.format(data.meta.eventCount);
    $('driverTotal').textContent = fmt.format(data.meta.driverCount);
    $('raceTotal').textContent = fmt.format(data.meta.raceCount);
    $('resultTotal').textContent = fmt.format(data.meta.raceResultCount);
    $('updatedStatus').textContent = `Data checked ${dateFmt.format(new Date(data.meta.generatedAt))}`;
    $('toDate').max = data.meta.latestEventDate;
    $('toDate').value = data.meta.latestEventDate;

    for (const className of data.classes) $('classFilter').insertAdjacentHTML('beforeend', `<option value="${escapeHtml(className)}">${escapeHtml(className)}</option>`);
    const driverOptions = data.drivers.slice().sort((a, b) => a.n.localeCompare(b.n)).map(driver => `<option value="${escapeHtml(driver.k)}">${escapeHtml(driver.n)}</option>`).join('');
    $('driverA').insertAdjacentHTML('beforeend', driverOptions);
    $('driverB').insertAdjacentHTML('beforeend', driverOptions);
    renderLeaderboard();

    for (const id of ['fromDate', 'toDate', 'classFilter']) $(id).addEventListener('change', refresh);
    $('driverSearch').addEventListener('input', renderLeaderboard);
    $('compareDrivers').addEventListener('click', compareDrivers);
    $('resetFilters').addEventListener('click', () => {
      $('fromDate').value = '';
      $('toDate').value = data.meta.latestEventDate;
      $('classFilter').value = '';
      $('driverSearch').value = '';
      refresh();
    });
  } catch (error) {
    $('updatedStatus').textContent = 'Statistics could not be loaded.';
    $('leaderboardBody').innerHTML = `<tr><td colspan="7">${escapeHtml(error.message)}</td></tr>`;
  }
}

init();
