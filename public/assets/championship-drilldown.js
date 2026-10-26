import { driverDetail } from './current-event-feed.js?v=20261024-round-aware-laps';

const eventCache = new Map();
const raceCache = new Map();

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00Z`));
}

async function fetchJson(url, cache) {
  if (!cache.has(url)) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    cache.set(url, fetch(url, { cache: 'force-cache', signal:controller.signal }).then(response => {
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      return response.json();
    }).finally(() => {
      clearTimeout(timeout);
    }).catch(error => {
      cache.delete(url);
      throw error;
    }));
  }
  return cache.get(url);
}

function raceUrl(raceId) {
  return `../virtual-race-replay/races/${encodeURIComponent(raceId)}.json`;
}

function preloadRaces(races) {
  if (!races.length) return;
  fetchJson(raceUrl(races[0].id),raceCache).catch(()=>{});
  const remaining=()=>Promise.allSettled(races.slice(1).map(race=>fetchJson(raceUrl(race.id),raceCache)));
  if ('requestIdleCallback' in window) window.requestIdleCallback(remaining,{timeout:1500});
  else setTimeout(remaining,150);
}

export function racesForDriver(eventData, className, driverKey) {
  return (eventData?.races || []).filter(race =>
    race.className === className &&
    (race.drivers || []).some(driver => String(driver.key) === String(driverKey))
  );
}

function roundMarkup(round, index) {
  const detail = [`P${round.position}`, `${round.score} pts`, round.tq ? 'TQ' : ''].filter(Boolean).join(' · ');
  return `<details class="championship-round" data-event-id="${escapeHtml(round.id)}"${index === 0 ? ' open' : ''}><summary><span><small>${formatDate(round.date)}</small><strong>${escapeHtml(round.name)}</strong></span><span>${escapeHtml(detail)}</span></summary><div class="championship-round-body"><p class="info-muted">Loading races…</p></div></details>`;
}

function driverMarkup(row) {
  const rounds = JSON.parse(row.dataset.rounds || '[]');
  return `<section class="championship-driver-detail"><header><div><span class="eyebrow">Championship race history</span><h3>${escapeHtml(row.dataset.driverName)}</h3><p>${rounds.length} completed round${rounds.length === 1 ? '' : 's'} · ${escapeHtml(row.dataset.className)}</p></div><button type="button" class="championship-collapse">Collapse</button></header><div class="championship-rounds">${rounds.map(roundMarkup).join('')}</div></section>`;
}

function raceMarkup(race) {
  return `<article class="championship-race" data-race-id="${escapeHtml(race.id)}"><button type="button" class="championship-race-toggle" aria-expanded="false"><span><small>${escapeHtml(race.round || 'Race')}</small><strong>${escapeHtml(race.name)}</strong></span><span>Lap times and chart <b aria-hidden="true">⌄</b></span></button><div class="championship-race-body" hidden></div></article>`;
}

async function loadRound(details) {
  const body = details.querySelector('.championship-round-body');
  if (!body || body.dataset.loaded === 'true') return;
  body.innerHTML = '<p class="info-muted">Loading races…</p>';
  const row = details.closest('.championship-driver-detail-row');
  try {
    const url = `../virtual-race-replay/events/${encodeURIComponent(details.dataset.eventId)}.json`;
    const eventData = await fetchJson(url, eventCache);
    const races = racesForDriver(eventData, row.dataset.className, row.dataset.driverKey);
    body.dataset.loaded = 'true';
    body.innerHTML = races.length ? races.map(raceMarkup).join('') : '<p class="info-muted">No race details are available for this round yet.</p>';
    preloadRaces(races);
    scheduleMobileChampionshipAlignment(row.closest('tbody'));
  } catch {
    body.innerHTML = '<p class="info-muted">These races are taking longer than expected. Close and reopen this round to try again.</p>';
  }
}

async function toggleRace(button) {
  const article = button.closest('.championship-race');
  const body = article?.querySelector('.championship-race-body');
  if (!article || !body) return;
  const opening = body.hidden;
  body.hidden = !opening;
  button.setAttribute('aria-expanded', String(opening));
  if (!opening || body.dataset.loaded === 'true') return;
  body.innerHTML = '<p class="info-muted">Loading lap times and chart…</p>';
  const row = article.closest('.championship-driver-detail-row');
  try {
    const url = raceUrl(article.dataset.raceId);
    const race = await fetchJson(url, raceCache);
    const driver = (race.drivers || []).find(item => String(item.key || item.id || item.name) === row.dataset.driverKey);
    if (!driver) throw new Error('Driver result missing');
    body.dataset.loaded = 'true';
    body.innerHTML = driverDetail(race, driver);
    scheduleMobileChampionshipAlignment(row.closest('tbody'));
  } catch {
    body.innerHTML = '<p class="info-muted">Lap details are taking longer than expected.</p><button type="button" class="championship-race-retry">Try again</button>';
  }
}

function closeDriver(tbody, row) {
  const mainRow = row.previousElementSibling;
  row.hidden = true;
  row.querySelector('.championship-driver-detail')?.remove();
  mainRow?.classList.remove('championship-driver-row-open');
  mainRow?.setAttribute('aria-expanded', 'false');
  mainRow?.querySelector('.championship-driver-toggle')?.setAttribute('aria-expanded', 'false');
  if (!tbody.querySelector('.championship-driver-detail-row:not([hidden])')) tbody.closest('.table-wrap')?.classList.remove('drilldown-expanded');
}

function openDriver(tbody, mainRow) {
  const row = mainRow.nextElementSibling;
  if (!row?.classList.contains('championship-driver-detail-row')) return;
  const wasOpen = !row.hidden;
  tbody.querySelectorAll('.championship-driver-detail-row:not([hidden])').forEach(openRow => closeDriver(tbody, openRow));
  if (wasOpen) return;
  row.hidden = false;
  row.firstElementChild.innerHTML = driverMarkup(row);
  mainRow.classList.add('championship-driver-row-open');
  mainRow.setAttribute('aria-expanded', 'true');
  mainRow.querySelector('.championship-driver-toggle')?.setAttribute('aria-expanded', 'true');
  tbody.closest('.table-wrap')?.classList.add('drilldown-expanded');
  scheduleMobileChampionshipAlignment(tbody);
  const firstRound = row.querySelector('.championship-round[open]');
  if (firstRound) loadRound(firstRound);
}

function selectLapPoint(point) {
  const detail = point.closest('.driver-run-detail');
  detail?.querySelectorAll('.run-lap-selected').forEach(row => row.classList.remove('run-lap-selected'));
  document.getElementById(point.dataset.eventLapTarget)?.classList.add('run-lap-selected');
  detail?.querySelectorAll('[data-event-lap-target].lap-chart-selected').forEach(item => item.classList.remove('lap-chart-selected'));
  point.classList.add('lap-chart-selected');
  const readout = detail?.querySelector('.lap-point-readout');
  if (readout) readout.textContent = `Lap ${point.dataset.lapNumber} · ${point.dataset.lapTime}s`;
}

// Keep an expanded championship panel stationary within the visible portion
// of a horizontally scrolled standings table on phones.
function alignMobileChampionshipDetail(tbody) {
  const wrap = tbody.closest('.championship-table');
  const panel = tbody.querySelector('.championship-driver-detail-row:not([hidden]) .championship-driver-detail');
  if (!wrap || !panel) return;
  if (window.matchMedia('(max-width:760px)').matches) {
    // The detail lives inside a much wider standings table. Align against
    // the VISIBLE wrapper rectangle, not its horizontal scroll position:
    // the containing table cell can start well away from the wrapper edge.
    const available = Math.max(240, wrap.clientWidth - 24);
    panel.style.setProperty('--championship-visible-width', available + 'px');
    const oldOffset = Number(panel.dataset.mobileOffset || 0);
    const actualLeft = panel.getBoundingClientRect().left;
    const desiredLeft = wrap.getBoundingClientRect().left + 12;
    const offset = oldOffset + desiredLeft - actualLeft;
    panel.dataset.mobileOffset = String(offset);
    panel.style.setProperty('--championship-scroll-x', offset + 'px');
  } else {
    panel.style.removeProperty('--championship-scroll-x');
    panel.style.removeProperty('--championship-visible-width');
    delete panel.dataset.mobileOffset;
  }
}

// Re-align after asynchronous race/chart markup has changed the intrinsic
// table width. The old adjustment only ran when opening the driver row.
function scheduleMobileChampionshipAlignment(tbody) {
  if (!tbody) return;
  requestAnimationFrame(() => {
    alignMobileChampionshipDetail(tbody);
    requestAnimationFrame(() => alignMobileChampionshipDetail(tbody));
  });
}

export function bindChampionshipDrilldown(tbody) {
  if (!tbody || tbody.dataset.championshipDrilldownBound === 'true') return;
  tbody.dataset.championshipDrilldownBound = 'true';
  const scrollWrap = tbody.closest('.championship-table');
  scrollWrap?.addEventListener('scroll', () => scheduleMobileChampionshipAlignment(tbody), {passive:true});
  window.addEventListener('resize', () => scheduleMobileChampionshipAlignment(tbody), {passive:true});

  tbody.addEventListener('toggle', event => {
    const details = event.target.closest?.('.championship-round');
    if (details?.open) loadRound(details);
    scheduleMobileChampionshipAlignment(tbody);
  }, true);
  tbody.addEventListener('click', event => {
    const point = event.target.closest('[data-event-lap-target]');
    if (point) return selectLapPoint(point);
    const collapse = event.target.closest('.championship-collapse');
    if (collapse) return closeDriver(tbody, collapse.closest('.championship-driver-detail-row'));
    const retry = event.target.closest('.championship-race-retry');
    if (retry) {
      const article=retry.closest('.championship-race');
      const body=article?.querySelector('.championship-race-body');
      const button=article?.querySelector('.championship-race-toggle');
      if (!article || !body || !button) return;
      raceCache.delete(raceUrl(article.dataset.raceId));
      body.hidden=true;
      delete body.dataset.loaded;
      button.setAttribute('aria-expanded','false');
      return toggleRace(button);
    }
    const raceButton = event.target.closest('.championship-race-toggle');
    if (raceButton) return toggleRace(raceButton);
    const toggle = event.target.closest('.championship-driver-toggle');
    if (toggle) return openDriver(tbody, toggle.closest('.championship-driver-row'));
    const mainRow = event.target.closest('.championship-driver-row');
    if (mainRow && !event.target.closest('a,button,input,select,textarea')) openDriver(tbody, mainRow);
  });
  tbody.addEventListener('keydown', event => {
    const point = event.target.closest('[data-event-lap-target]');
    if (point && ['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      return selectLapPoint(point);
    }
    const mainRow = event.target.closest('.championship-driver-row');
    if (mainRow && event.target === mainRow && ['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      openDriver(tbody, mainRow);
    }
  });
}
