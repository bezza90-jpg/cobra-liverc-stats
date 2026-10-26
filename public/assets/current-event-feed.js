import { nextMeeting } from './event-calendar.js?v=20260926-midnight';
import { facebookShareLink, lapLineColour } from './lap-charts.js?v=20261026-native-share';

const REFRESH_MS = 60_000;
const raceCache = new Map();
let renderedRaceIds = '';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]);
}

async function fetchJson(url) {
  const separator = url.includes('?') ? '&' : '?';
  const response = await fetch(`${url}${separator}fresh=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

export function orderedPublishedRaces(eventData) {
  return [...(eventData?.races || [])].filter(race => race?.id).reverse();
}

export function isFinalRace(race) {
  if (typeof race?.isFinal === 'boolean') return race.isFinal;
  if (typeof race?.f === 'boolean') return race.f;
  if (typeof race?.f === 'number') return race.f !== 0;
  const round = String(race?.round || race?.r || '').trim();
  return /(?:final|main events?)/i.test(round) && !/(?:semi|quarter|practice|qualif)/i.test(round);
}
export function timedLapsFor(driver, race = null) {
  const laps = (driver?.laps || []).filter(lap => Number.isFinite(Number(lap?.seconds)) && Number(lap.seconds) > 0);
  return isFinalRace(race) && laps.length > 1 ? laps.filter(lap => Number(lap.lap) !== 1) : laps;
}

export function bestLapAverage(laps, count) {
  if (laps.length < count) return null;
  const quickest = laps.map(lap => Number(lap.seconds)).sort((a, b) => a - b).slice(0, count);
  return quickest.reduce((sum, seconds) => sum + seconds, 0) / count;
}

export function lapPerformanceClass(seconds, best) {
  const difference = Number(seconds) - Number(best);
  if (Math.abs(difference) < 0.0005) return 'lap-fastest';
  if (difference <= 0.3) return 'lap-near-fastest';
  if (difference >= 1.5) return 'lap-slow';
  return '';
}

function formatTime(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value)) return '—';
  if (value < 60) return `${value.toFixed(3)}s`;
  const minutes = Math.floor(value / 60);
  return `${minutes}:${(value % 60).toFixed(3).padStart(6, '0')}`;
}

function lapChart(laps, best, targetPrefix, race) {
  if (!laps.length) return '<p class="info-muted">No timed laps were published for this driver.</p>';
  // A narrower viewBox keeps labels and touch targets legible on phones.
  // Desktop retains the existing 630px chart geometry.
  const mobileChart = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 760px)').matches;
  const width = mobileChart ? 360 : 630;
  const height = mobileChart ? 240 : 210;
  const left = mobileChart ? 45 : 48;
  const right = mobileChart ? 16 : 18;
  const top = 20;
  const bottom = mobileChart ? 48 : 34;
  const values = laps.map(lap => Number(lap.seconds));
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const padding = Math.max((maximum - minimum) * 0.12, 0.35);
  const low = minimum - padding;
  const high = maximum + padding;
  const minLap = Math.min(...laps.map(lap => Number(lap.lap)));
  const maxLap = Math.max(...laps.map(lap => Number(lap.lap)));
  const x = lap => left + ((Number(lap) - minLap) / Math.max(maxLap - minLap, 1)) * (width - left - right);
  const y = seconds => top + ((high - Number(seconds)) / Math.max(high - low, 0.1)) * (height - top - bottom);
  const grid = Array.from({ length: 4 }, (_, index) => {
    const ratio = index / 3;
    const yPosition = top + ratio * (height - top - bottom);
    const label = high - ratio * (high - low);
    return `<line x1="${left}" x2="${width - right}" y1="${yPosition}" y2="${yPosition}"/><text x="${left - 7}" y="${yPosition + 4}" text-anchor="end">${label.toFixed(1)}</text>`;
  }).join('');
  const ticks = laps.map(lap => `<text x="${x(lap.lap)}" y="${mobileChart ? height - 30 : height - 12}" text-anchor="middle">${lap.lap}</text>`).join('');
  const points = laps.map(lap => {
    // The first crossing is plotted but must not be treated as a timed lap.
    const timingClass = isFinalRace(race) && Number(lap.lap) === 1 ? 'lap-opening' : lapPerformanceClass(lap.seconds, best);
    const target = `${targetPrefix}-${lap.lap}`;
    return `<g role="button" tabindex="0" data-event-lap-target="${escapeHtml(target)}" data-lap-number="${lap.lap}" data-lap-time="${Number(lap.seconds).toFixed(3)}" aria-label="Outline lap ${lap.lap}, ${Number(lap.seconds).toFixed(3)} seconds"><circle class="${timingClass}" cx="${x(lap.lap)}" cy="${y(lap.seconds)}" r="6"><title>Lap ${lap.lap} · ${Number(lap.seconds).toFixed(3)}s</title></circle></g>`;
  }).join('');
  const gradientPrefix=('event-'+targetPrefix).replace(/[^a-z0-9_-]/gi,'-'),gradientParts=[],lineParts=[];
  laps.slice(1).forEach((lap,index)=>{const previous=laps[index],id=gradientPrefix+'-'+index;gradientParts.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x(previous.lap)}" y1="${y(previous.seconds)}" x2="${x(lap.lap)}" y2="${y(lap.seconds)}"><stop offset="0" stop-color="${isFinalRace(race) && Number(previous.lap) === 1 ? "#9fb3a5" : lapLineColour(previous.seconds,best)}"/><stop offset="1" stop-color="${lapLineColour(lap.seconds,best)}"/></linearGradient>`);lineParts.push(`<line class="run-lap-chart-line" x1="${x(previous.lap)}" y1="${y(previous.seconds)}" x2="${x(lap.lap)}" y2="${y(lap.seconds)}" style="stroke:url(#${id})"/>`);});
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Selectable lap-time chart"><defs>${gradientParts.join('')}</defs><g class="run-lap-chart-grid">${grid}${ticks}<text x="${left}" y="14">Seconds</text><text x="${width / 2}" y="${mobileChart ? height - 8 : 208}" text-anchor="middle">Lap number</text></g>${lineParts.join('')}<g class="run-lap-chart-points">${points}</g></svg>`;
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function driverDetail(race, driver) {
  const allLaps = (driver.laps || []).filter(lap => Number.isFinite(Number(lap.seconds)) && Number(lap.seconds) > 0);
  const timedLaps = timedLapsFor(driver, race);
  const best = timedLaps.length ? Math.min(...timedLaps.map(lap => Number(lap.seconds))) : null;
  const averageTimed = average(timedLaps.map(lap => Number(lap.seconds)));
  const safeRace = escapeHtml(race.id);
  const safeDriver = escapeHtml(driver.key || driver.id || driver.name).replace(/\s+/g, '-');
  const prefix = `event-lap-${safeRace}-${safeDriver}`;
  const averages = [3, 5, 10, 15].map(count => {
    const value = bestLapAverage(timedLaps, count);
    return value === null ? '' : `<span class="run-summary-average run-summary-average-${count}"><strong>${value.toFixed(3)}s</strong><small data-mobile-label="Top ${count}">Top ${count} lap average</small></span>`;
  }).join('');
  const rows = allLaps.map(lap => {
    const timingClass = (isFinalRace(race) && Number(lap.lap) === 1) || best === null ? '' : lapPerformanceClass(lap.seconds, best);
    return `<tr id="${prefix}-${lap.lap}" class="${timingClass}"><td>${lap.lap}</td><td>${Number(lap.seconds).toFixed(3)}s</td><td>${lap.position ? `P${lap.position}` : '—'}</td></tr>`;
  }).join('');
  return `<div class="driver-run-detail current-event-driver-detail"><div class="run-detail-summary">${averages}<span class="run-summary-fastest"><strong>${best === null ? '—' : `${best.toFixed(3)}s`}</strong><small data-mobile-label="Fastest">Fastest lap</small></span><span><strong>${averageTimed === null ? '—' : `${averageTimed.toFixed(3)}s`}</strong><small data-mobile-label="Average">Average timed lap</small></span><span><strong>${timedLaps.length}</strong><small data-mobile-label="Laps">Timed laps</small></span></div><div class="run-detail-columns"><div class="run-lap-list"><h4>${escapeHtml(driver.name)} lap times</h4><div class="table-wrap"><table class="run-laps-table"><thead><tr><th>Lap</th><th>Time</th><th>Pos</th></tr></thead><tbody>${rows}</tbody></table></div></div><aside class="run-detail-chart"><h4>Lap chart</h4><p class="run-lap-chart-help">Select a point to outline that lap.</p><p class="lap-point-readout" aria-live="polite">Select a point to see its lap time.</p><div class="run-lap-chart-scroll">${lapChart(allLaps, best, prefix, race)}</div><div class="run-lap-chart-legend"><span><i class="lap-fastest"></i>Fastest</span><span><i class="lap-near-fastest"></i>Within 0.3s</span><span><i class="lap-slow"></i>1.5s+ slower</span></div><div class="run-detail-links"><a href="../lap-charts/?race=${encodeURIComponent(race.id)}&driver=${encodeURIComponent(driver.key || driver.name)}">Open full COBRA lap chart</a>${facebookShareLink(race.id,driver.key||driver.id||driver.name)}<a href="../virtual-race-replay/?race=${encodeURIComponent(race.id)}">Watch 2D replay</a></div></aside></div></div>`;
}

function standingsMarkup(race) {
  const drivers = [...(race.drivers || [])].sort((a, b) => Number(a.finalPosition || 999) - Number(b.finalPosition || 999));
  const rows = drivers.map(driver => `<tr><td>P${driver.finalPosition || '—'}</td><td><button type="button" class="current-event-driver" data-driver-key="${escapeHtml(driver.key || driver.id || driver.name)}">${escapeHtml(driver.name)}</button></td><td>${(driver.laps || []).length}</td><td>${formatTime(driver.officialTime)}</td></tr>`).join('');
  return `<div class="current-event-race-result"><div class="current-event-result-actions">${facebookShareLink(race.id)}</div><div class="table-wrap"><table class="current-event-standings"><thead><tr><th>Pos</th><th>Driver</th><th>Laps</th><th>Time</th></tr></thead><tbody>${rows}</tbody></table></div><div class="current-event-driver-slot" aria-live="polite"></div></div>`;
}

async function raceDetail(raceId) {
  if (!raceCache.has(raceId)) raceCache.set(raceId, fetchJson(`../virtual-race-replay/races/${encodeURIComponent(raceId)}.json`));
  return raceCache.get(raceId);
}

async function loadRace(details) {
  const host = details.querySelector('.current-event-race-body');
  if (!host || host.dataset.loaded === 'true') return;
  host.innerHTML = '<p class="info-muted">Loading published result…</p>';
  try {
    const race = await raceDetail(details.dataset.raceId);
    host.dataset.loaded = 'true';
    host.innerHTML = standingsMarkup(race);
    host.dataset.race = JSON.stringify(race);
  } catch {
    raceCache.delete(details.dataset.raceId);
    host.innerHTML = '<p class="info-muted">This result is still being prepared. Please try again shortly.</p>';
  }
}

function raceListMarkup(races) {
  return races.map((race, index) => `<details class="current-event-race" data-race-id="${escapeHtml(race.id)}"${index === 0 ? ' open' : ''}><summary><span><small>${escapeHtml(race.round || 'Published result')}</small><strong>${escapeHtml(race.name)}</strong></span><span>${(race.drivers || []).length} drivers</span></summary><div class="current-event-race-body"><p class="info-muted">Loading published result…</p></div></details>`).join('');
}

async function showFeed(eventData, races) {
  const section = document.getElementById('currentEventResultsFeed');
  const host = document.getElementById('currentEventRaceFeed');
  if (!section || !host) return;
  const raceIds = races.map(race => race.id).join(',');
  if (raceIds === renderedRaceIds) {
    section.hidden = false;
    return;
  }
  const openIds = new Set([...host.querySelectorAll('.current-event-race[open]')].map(item => item.dataset.raceId));
  host.innerHTML = raceListMarkup(races);
  host.querySelectorAll('.current-event-race').forEach((details, index) => {
    details.open = openIds.size ? openIds.has(details.dataset.raceId) : index === 0;
    details.addEventListener('toggle', () => { if (details.open) loadRace(details); });
    if (details.open) loadRace(details);
  });
  document.getElementById('currentEventResultsStatus').textContent = `${eventData.name || 'Current event'} · newest published race first`;
  renderedRaceIds = raceIds;
  section.hidden = false;
}

async function refreshFeed() {
  if (document.hidden) return;
  try {
    const calendar = await fetchJson('../data/event-calendar.json');
    const meeting = nextMeeting(calendar.events || []);
    if (!meeting?.eventId) return;
    const eventData = await fetchJson(`../virtual-race-replay/events/${encodeURIComponent(meeting.eventId)}.json`);
    const races = orderedPublishedRaces(eventData);
    if (!races.length) return;
    await raceDetail(races[0].id);
    await showFeed(eventData, races);
  } catch {
    // The feed stays hidden until the first complete result has been published.
  }
}

function handleFeedInteraction(event) {
  const lapPoint = event.target.closest('[data-event-lap-target]');
  if (lapPoint) {
    const detail = lapPoint.closest('.current-event-driver-detail');
    detail?.querySelectorAll('.run-lap-selected').forEach(row => row.classList.remove('run-lap-selected'));
    document.getElementById(lapPoint.dataset.eventLapTarget)?.classList.add('run-lap-selected');
    detail?.querySelectorAll('[data-event-lap-target].lap-chart-selected').forEach(point => point.classList.remove('lap-chart-selected'));
    lapPoint.classList.add('lap-chart-selected');
    const readout = detail?.querySelector('.lap-point-readout');
    if (readout) readout.textContent = `Lap ${lapPoint.dataset.lapNumber} · ${lapPoint.dataset.lapTime}s`;
    return;
  }
  const button = event.target.closest('.current-event-driver');
  if (!button) return;
  const result = button.closest('.current-event-race-result');
  const host = button.closest('.current-event-race-body');
  const slot = result?.querySelector('.current-event-driver-slot');
  if (!host || !slot) return;
  const race = JSON.parse(host.dataset.race || '{}');
  const driver = (race.drivers || []).find(item => String(item.key || item.id || item.name) === button.dataset.driverKey);
  if (!driver) return;
  result.querySelectorAll('.current-event-driver[aria-current="true"]').forEach(item => item.removeAttribute('aria-current'));
  button.setAttribute('aria-current', 'true');
  slot.innerHTML = driverDetail(race, driver);
}

function init() {
  const host = document.getElementById('currentEventRaceFeed');
  if (!host) return;
  host.addEventListener('click', handleFeedInteraction);
  host.addEventListener('keydown', event => {
    const point = event.target.closest('[data-event-lap-target]');
    if (!point || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    point.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  refreshFeed();
  window.setInterval(refreshFeed, REFRESH_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshFeed(); });
}

if (typeof document !== 'undefined') init();
