const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const formatDate = value => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00Z`));
const naturalSort = new Intl.Collator('en-GB', { numeric: true, sensitivity: 'base' });

let data;
let events = [];
let activeEventId = '';
let driverByKey = new Map();
let podiumPhotoByRaceId = new Map();
let podiumWebAppUrl = '';

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

function resizedDriveImage(url, width) {
  if (!url || !/drive\.google\.com\/thumbnail/i.test(url)) return url;
  const imageUrl = new URL(url);
  imageUrl.searchParams.set('sz', `w${width}`);
  return imageUrl.href;
}

function podiumRow(result) {
  const position = Number(result[2]);
  const medal = ['🥇', '🥈', '🥉'][position - 1];
  return `<tr class="podium-place podium-place-${position}"><td><span aria-hidden="true">${medal}</span> ${position}</td><td>${escapeHtml(driverByKey.get(result[1]) || result[1])}</td><td>${escapeHtml(result[3] || '—')}</td><td>${escapeHtml(result[5] || '—')}</td></tr>`;
}

function finalCard([raceId, race]) {
  const photoName = `${race.e}-${raceId}-podium.jpg`;
  const approvedPhoto = podiumPhotoByRaceId.get(String(raceId));
  const originalPhotoUrl = approvedPhoto?.imageUrl || `../podium-photos/${encodeURIComponent(photoName)}`;
  const photoUrl = approvedPhoto ? resizedDriveImage(originalPhotoUrl, 900) : originalPhotoUrl;
  const fullPhotoUrl = approvedPhoto ? resizedDriveImage(originalPhotoUrl, 2400) : originalPhotoUrl;
  const photoSrcset = approvedPhoto
    ? `${resizedDriveImage(originalPhotoUrl, 480)} 480w, ${resizedDriveImage(originalPhotoUrl, 900)} 900w, ${resizedDriveImage(originalPhotoUrl, 1400)} 1400w`
    : '';
  const originalUrl = approvedPhoto?.viewUrl || photoUrl;
  const photoTitle = `${race.c} ${race.n} podium`;
  const caption = approvedPhoto?.caption || '';
  const uploadUrl = podiumUploadUrl(race.e, raceId);
  const rows = raceTopThree(raceId);
  const results = rows.length
    ? rows.map(podiumRow).join('')
    : '<tr><td colspan="4" class="podium-no-results">No classified top-three result is available.</td></tr>';
  return `<article class="podium-card">
    <div class="podium-photo" data-full-image="${escapeHtml(fullPhotoUrl)}" data-original-image="${escapeHtml(originalUrl)}" data-photo-title="${escapeHtml(photoTitle)}" data-photo-caption="${escapeHtml(caption)}">
      <img src="${escapeHtml(photoUrl)}"${photoSrcset ? ` srcset="${escapeHtml(photoSrcset)}" sizes="(max-width: 650px) calc(100vw - 32px), (max-width: 1100px) 50vw, 520px"` : ''} alt="${escapeHtml(photoTitle)}" loading="lazy" decoding="async">
      <button class="podium-photo-expand" type="button">Enlarge photo</button>
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
      ${uploadUrl ? `<a class="event-link podium-race-link podium-upload-final" href="${escapeHtml(uploadUrl)}" target="_blank" rel="noopener">Upload photo</a>` : ''}
    </div>
  </article>`;
}

function podiumUploadUrl(eventId = '', raceId = '') {
  if (!podiumWebAppUrl) return '';
  const url = new URL(podiumWebAppUrl);
  url.searchParams.set('page', 'podiums');
  if (eventId) url.searchParams.set('eventId', String(eventId));
  if (raceId) url.searchParams.set('raceId', String(raceId));
  return url.href;
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
    const markLoaded = () => image.closest('.podium-photo').classList.add('has-photo');
    const markFailed = () => {
      image.closest('.podium-photo').querySelector('.podium-photo-expand')?.remove();
      image.remove();
    };
    if (image.complete) image.naturalWidth ? markLoaded() : markFailed();
    else {
      image.addEventListener('load', markLoaded, { once: true });
      image.addEventListener('error', markFailed, { once: true });
    }
  });
  document.querySelectorAll('[data-event-id]').forEach(button => button.setAttribute('aria-current', String(button.dataset.eventId) === activeEventId ? 'true' : 'false'));
  if (updateAddress) {
    const url = new URL(window.location.href);
    url.searchParams.set('event', activeEventId);
    history.replaceState({}, '', url);
  }
}

async function loadPodiumPhotos() {
  const response = await fetch('../data/podiums-config.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Podium uploads are not configured.');
  const config = await response.json();
  podiumWebAppUrl = String(config.webAppUrl || '').trim();
  if (!podiumWebAppUrl) throw new Error('Podium uploads are not configured.');
  $('podiumUploadLink').href = podiumUploadUrl();
  $('podiumUploadLink').hidden = false;
  const url = new URL(podiumWebAppUrl);
  url.searchParams.set('action', 'podium-list');
  url.searchParams.set('callback', 'cobraPodiumPhotos');
  const payload = await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = window.setTimeout(() => {
      delete window.cobraPodiumPhotos;
      script.remove();
      reject(new Error('The podium photograph feed timed out.'));
    }, 15000);
    window.cobraPodiumPhotos = value => {
      window.clearTimeout(timer);
      delete window.cobraPodiumPhotos;
      script.remove();
      resolve(value);
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      delete window.cobraPodiumPhotos;
      script.remove();
      reject(new Error('The podium photograph feed could not be loaded.'));
    };
    script.src = url.href;
    document.head.appendChild(script);
  });
  if (!payload?.ok) throw new Error(payload?.error || 'The podium photograph feed could not be loaded.');
  podiumPhotoByRaceId = new Map((payload.photos || []).map(photo => [String(photo.raceId), photo]));
}

function openPhoto(photo) {
  const isMobile = window.matchMedia('(max-width: 800px)').matches;
  const canUseFullscreen = Boolean(document.fullscreenEnabled && $('podiumLightbox').requestFullscreen);
  if (isMobile && !canUseFullscreen) {
    window.open(photo.dataset.fullImage, '_blank', 'noopener');
    return;
  }
  $('podiumLightboxImage').src = photo.dataset.fullImage;
  $('podiumLightboxImage').alt = photo.dataset.photoTitle;
  $('podiumLightboxTitle').textContent = photo.dataset.photoTitle;
  $('podiumLightboxCaption').textContent = photo.dataset.photoCaption || '';
  $('podiumLightboxCaption').hidden = !photo.dataset.photoCaption;
  $('podiumLightboxOriginal').href = photo.dataset.originalImage;
  $('podiumLightbox').hidden = false;
  document.body.classList.add('podium-lightbox-open');
  $('podiumLightboxClose').focus();
  if (isMobile && canUseFullscreen) {
    $('podiumLightbox').requestFullscreen().catch(() => {});
  }
}

function closePhoto() {
  $('podiumLightbox').hidden = true;
  $('podiumLightboxImage').removeAttribute('src');
  document.body.classList.remove('podium-lightbox-open');
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
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
    const [response] = await Promise.all([
      fetch('../data/dashboard.json', { cache: 'no-store' }),
      loadPodiumPhotos().catch(error => console.warn(error.message))
    ]);
    if (!response.ok) throw new Error(`Unable to load statistics (${response.status})`);
    data = await response.json();
    driverByKey = new Map(data.drivers.map(driver => [driver.k, driver.n]));
    events = data.events
      .filter(event => eventFinals(event.i).length)
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

$('finalsGrid').addEventListener('click', event => {
  const photo = event.target.closest('.podium-photo.has-photo');
  if (photo) openPhoto(photo);
});
$('podiumLightboxClose').addEventListener('click', closePhoto);
$('podiumLightbox').addEventListener('click', event => { if (event.target === $('podiumLightbox')) closePhoto(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('podiumLightbox').hidden) closePhoto(); });

init();
