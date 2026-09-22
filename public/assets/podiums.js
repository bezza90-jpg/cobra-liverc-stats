const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const formatDate = value => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00Z`));
const naturalSort = new Intl.Collator('en-GB', { numeric: true, sensitivity: 'base' });

let data;
let events = [];
let activeEventId = '';
let driverByKey = new Map();

function eventFinals(eventId) {
  return Object.entries(data.raceById)
    .filter(([, race]) => String(race.e) === String(eventId) && race.f)
    .sort(([, a], [, b]) => naturalSort.compare(a.c, b.c) || naturalSort.compare(a.m || 'Z', b.m || 'Z') || naturalSort.compare(a.n, b.n));
}

function raceTopThree(raceId) {
  return data.raceResults
    .filter(result => String(result[0]) === String(raceId) && Number(result[2]) >= 1 && Number(result[2]) <= 3)
    .sort((a, b) => Number(a[2]) - Number(b[2]));
}

function podiumRow(result) {
  const position = Number(result[2]);
  const medal = ['🥇', '🥈', '🥉'][position - 1];
  return `<tr class="podium-place podium-place-${position}"><td><span aria-hidden="true">${medal}</span> ${position}</td><td>${escapeHtml(driverByKey.get(result[1]) || result[1])}</td><td>${escapeHtml(result[3] || '—')}</td><td>${escapeHtml(result[5] || '—')}</td></tr>`;
}

function finalCard([raceId, race]) {
  const photoName = `${race.e}-${raceId}-podium.jpg`;
  const rows = raceTopThree(raceId);
  const results = rows.length
    ? rows.map(podiumRow).join('')
    : '<tr><td colspan="4" class="podium-no-results">No classified top-three result is available.</td></tr>';
  return `<article class="podium-card">
    <div class="podium-photo">
      <img src="../podium-photos/${encodeURIComponent(photoName)}" alt="${escapeHtml(race.c)} ${escapeHtml(race.n)} podium" loading="lazy">
      <div class="podium-placeholder">
        <span class="podium-icon" aria-hidden="true">🏆</span>
        <strong>Podium photograph coming soon</strong>
        <small>Upload as <code>${escapeHtml(photoName)}</code></small>
      </div>
    </div>
    <div class="podium-card-copy">
      <p class="podium-class">${escapeHtml(race.c)}</p>
      <h3>${escapeHtml(race.n)}</h3>
      <div class="table-wrap podium-results"><table>
        <thead><tr><th>Pos</th><th>Driver</th><th>Result</th><th>Fastest</th></tr></thead>
        <tbody>${results}</tbody>
      </table></div>
      <a class="event-link podium-race-link" href="${escapeHtml(race.u)}" target="_blank" rel="noopener">See all finishers on LiveRC ↗</a>
    </div>
  </article>`;
}

function renderEvent(eventId, updateAddress = true) {
  const event = events.find(item => String(item.i) === String(eventId)) || events[0];
  if (!event) return;
  activeEventId = String(event.i);
  const finals = eventFinals(event.i);
  $('eventTitle').textContent = event.n;
  $('eventMeta').textContent = `${formatDate(event.d)} · ${finals.length} ${finals.length === 1 ? 'final' : 'finals'}`;
  $('eventResultsLink').href = event.u;
  $('eventSelect').value = activeEventId;
  $('finalsGrid').innerHTML = finals.length ? finals.map(finalCard).join('') : '<div class="panel empty-state">No finals were found for this event.</div>';
  document.querySelectorAll('.podium-photo img').forEach(image => {
    image.addEventListener('load', () => image.closest('.podium-photo').classList.add('has-photo'), { once: true });
    image.addEventListener('error', () => image.remove(), { once: true });
  });
  document.querySelectorAll('[data-event-id]').forEach(button => button.setAttribute('aria-current', String(button.dataset.eventId) === activeEventId ? 'true' : 'false'));
  if (updateAddress) {
    const url = new URL(window.location.href);
    url.searchParams.set('event', activeEventId);
    history.replaceState({}, '', url);
  }
}

function renderArchive() {
  const grouped = new Map();
  for (const event of events) {
    const year = event.d.slice(0, 4);
    if (!grouped.has(year)) grouped.set(year, []);
    grouped.get(year).push(event);
  }
  $('podiumArchive').innerHTML = [...grouped.entries()].map(([year, yearEvents], index) => `<details ${index === 0 ? 'open' : ''}>
    <summary>${year}<span>${yearEvents.length}</span></summary>
    <div>${yearEvents.map(event => `<button type="button" data-event-id="${escapeHtml(event.i)}"><strong>${escapeHtml(event.n)}</strong><small>${escapeHtml(formatDate(event.d))}</small></button>`).join('')}</div>
  </details>`).join('');
  $('eventSelect').innerHTML = events.map(event => `<option value="${escapeHtml(event.i)}">${escapeHtml(formatDate(event.d))} — ${escapeHtml(event.n)}</option>`).join('');
  $('podiumArchive').addEventListener('click', event => {
    const button = event.target.closest('[data-event-id]');
    if (button) renderEvent(button.dataset.eventId);
  });
  $('eventSelect').addEventListener('change', event => renderEvent(event.target.value));
}

async function init() {
  try {
    const response = await fetch('../data/dashboard.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Unable to load statistics (${response.status})`);
    data = await response.json();
    driverByKey = new Map(data.drivers.map(driver => [driver.k, driver.n]));
    const latestDate = [...data.events].sort((a, b) => b.d.localeCompare(a.d))[0]?.d;
    const cutoff = new Date(`${latestDate}T12:00:00Z`);
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
    events = data.events
      .filter(event => new Date(`${event.d}T12:00:00Z`) >= cutoff && eventFinals(event.i).length)
      .sort((a, b) => b.d.localeCompare(a.d) || naturalSort.compare(b.n, a.n));
    $('updatedStatus').textContent = `Last updated ${formatDate(data.meta.generatedAt.slice(0, 10))}`;
    renderArchive();
    const requested = new URLSearchParams(window.location.search).get('event');
    renderEvent(events.some(event => String(event.i) === requested) ? requested : events[0]?.i, false);
  } catch (error) {
    $('eventTitle').textContent = 'Gallery unavailable';
    $('eventMeta').textContent = error.message;
    $('finalsGrid').innerHTML = `<div class="panel empty-state">${escapeHtml(error.message)}</div>`;
  }
}

init();
