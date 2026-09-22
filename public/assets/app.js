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

function filters() {
  return {
    from: $('fromDate').value,
    to: $('toDate').value,
    division: $('divisionFilter').value,
    eventType: $('eventTypeFilter').value,
    className: $('classFilter').value,
    minimumFinals: Number($('minimumFinals').value),
    search: $('driverSearch').value.trim().toUpperCase()
  };
}

function calculateLeaderboard() {
  const { from, to, division, eventType, className, minimumFinals, search } = filters();
  const data = state.data;
  const stats = new Map(data.drivers.map(driver => [driver.k, {
    driverKey: driver.k, name: driver.n, junior: Boolean(driver.j), finals: 0,
    overallWins: 0, podiums: 0, topFive: 0, positionTotal: 0,
    performanceTotal: 0, best: Infinity, consistencyTotal: 0, consistencyRuns: 0
  }]));

  const fieldSizes = new Map();
  for (const result of data.eventResults) {
    if (!isPublishedFinal(result)) continue;
    const key = `${result[0]}|${result[2]}`;
    fieldSizes.set(key, (fieldSizes.get(key) || 0) + 1);
  }

  for (const result of data.eventResults) {
    const [eventId, date, cls, driverKey, finalPosition] = result;
    if (!isPublishedFinal(result) || !inRange(date, from, to) || !eventMatches(eventId, eventType) || (className && cls !== className)) continue;
    const row = stats.get(driverKey);
    if (!row) continue;
    const fieldSize = fieldSizes.get(`${eventId}|${cls}`) || 1;
    const performance = fieldSize <= 1 ? 100 : 100 * (fieldSize - finalPosition) / (fieldSize - 1);
    row.finals += 1;
    row.positionTotal += finalPosition;
    row.performanceTotal += Math.max(0, performance);
    row.best = Math.min(row.best, finalPosition);
    if (finalPosition === 1) row.overallWins += 1;
    if (finalPosition <= 3) row.podiums += 1;
    if (finalPosition <= 5) row.topFive += 1;
  }

  for (const [raceId, driverKey, , , , , , consistency] of data.raceResults) {
    const race = data.raceById[raceId];
    const value = Number.parseFloat(consistency);
    if (!race || !Number.isFinite(value) || !inRange(race.d, from, to) || !eventMatches(race.e, eventType) || (className && race.c !== className)) continue;
    const row = stats.get(driverKey);
    if (!row) continue;
    row.consistencyTotal += value;
    row.consistencyRuns += 1;
  }

  const ranked = [...stats.values()]
    .filter(row => row.finals >= minimumFinals && (division === 'all' || (division === 'junior') === row.junior))
    .map(row => ({
      ...row,
      average: row.positionTotal / row.finals,
      performance: row.performanceTotal / row.finals,
      consistency: row.consistencyRuns ? row.consistencyTotal / row.consistencyRuns : null
    }))
    .sort((a, b) => b.performance - a.performance || a.average - b.average || b.overallWins - a.overallWins || b.finals - a.finals || a.name.localeCompare(b.name))
    .map((row, index) => ({ ...row, rank: index + 1 }));

  return ranked.filter(row => !search || row.name.includes(search));
}

function countAndRate(count, total) {
  return `${count} (${Math.round(100 * count / total)}%)`;
}

function renderLeaderboard() {
  const rows = calculateLeaderboard();
  $('leaderboardCount').textContent = `${fmt.format(rows.length)} driver${rows.length === 1 ? '' : 's'}`;
  $('leaderboardBody').innerHTML = rows.length ? rows.map(row => `
    <tr>
      <td>${row.rank}</td><td>${escapeHtml(row.name)}</td><td>${row.finals}</td>
      <td>${row.average.toFixed(1)}</td><td>${row.best}</td><td>${countAndRate(row.topFive, row.finals)}</td>
      <td>${countAndRate(row.podiums, row.finals)}</td><td>${row.overallWins}</td>
      <td>${row.performance.toFixed(1)}</td><td>${row.consistency === null ? '—' : `${row.consistency.toFixed(1)}%`}</td>
    </tr>`).join('') : '<tr><td colspan="10">No drivers match these filters.</td></tr>';
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
  const eligible = row => isPublishedFinal(row) && inRange(row[1], from, to) && eventMatches(row[0], eventType) && (!className || row[2] === className);
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
    if (driverKey === bKey && isPublishedFinal(row) && selected(eventId) && inRange(date, from, to) && eventMatches(eventId, eventType) && (!className || cls === className)) eventMapB.set(`${eventId}|${cls}`, row);
  }
  const eventMeetings = [];
  for (const rowA of data.eventResults) {
    const [eventId, date, cls, driverKey, positionA] = rowA;
    if (driverKey !== aKey || !isPublishedFinal(rowA) || !selected(eventId) || !inRange(date, from, to) || !eventMatches(eventId, eventType) || (className && cls !== className)) continue;
    const rowB = eventMapB.get(`${eventId}|${cls}`);
    if (rowB) eventMeetings.push({ eventId, date, cls, a: positionA, b: rowB[4], rowA, rowB });
  }

  const raceMapB = new Map(data.raceResults.filter(row => row[1] === bKey).map(row => [row[0], row]));
  const finalMeetings = [];
  for (const rowA of data.raceResults) {
    if (rowA[1] !== aKey) continue;
    const race = data.raceById[rowA[0]];
    const rowB = raceMapB.get(rowA[0]);
    if (!race?.f || !rowB || !selected(race.e) || !inRange(race.d, from, to) || !eventMatches(race.e, eventType) || (className && race.c !== className)) continue;
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
  if (!$('h2hResults').hidden) compareDrivers(true);
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
    $('fromDate').value = oneYearBefore(data.meta.latestEventDate);

    for (const className of data.classes) $('classFilter').insertAdjacentHTML('beforeend', `<option value="${escapeHtml(className)}">${escapeHtml(className)}</option>`);
    const driverOptions = data.drivers.slice().sort((a, b) => a.n.localeCompare(b.n)).map(driver => `<option value="${escapeHtml(driver.k)}">${escapeHtml(driver.n)}${driver.j ? ' (Junior)' : ''}</option>`).join('');
    $('driverA').insertAdjacentHTML('beforeend', driverOptions);
    $('driverB').insertAdjacentHTML('beforeend', driverOptions);
    renderLeaderboard();

    for (const id of ['fromDate', 'toDate', 'divisionFilter', 'eventTypeFilter', 'minimumFinals']) $(id).addEventListener('change', refresh);
    $('classFilter').addEventListener('change', () => {
      if ($('classFilter').value === 'Junior Racers') $('divisionFilter').value = 'junior';
      refresh();
    });
    $('driverSearch').addEventListener('input', renderLeaderboard);
    $('compareDrivers').addEventListener('click', () => compareDrivers(false));
    $('comparisonEvent').addEventListener('change', () => compareDrivers(true));
    $('resetFilters').addEventListener('click', () => {
      $('fromDate').value = oneYearBefore(data.meta.latestEventDate);
      $('toDate').value = data.meta.latestEventDate;
      $('divisionFilter').value = 'open';
      $('eventTypeFilter').value = '';
      $('classFilter').value = '';
      $('minimumFinals').value = '3';
      $('driverSearch').value = '';
      refresh();
    });
  } catch (error) {
    $('updatedStatus').textContent = 'Statistics could not be loaded.';
    $('leaderboardBody').innerHTML = `<tr><td colspan="10">${escapeHtml(error.message)}</td></tr>`;
  }
}

init();
