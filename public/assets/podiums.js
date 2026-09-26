const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const formatDate = value => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00Z`));
const naturalSort = new Intl.Collator('en-GB', { numeric: true, sensitivity: 'base' });

let data;
let events = [];
let activeEventId = '';
let driverByKey = new Map();
let podiumPhotoByRaceId = new Map();
let podiumPhotoOverrides = new Map();
let podiumOverridesReady = false;
let podiumWebAppUrl = '';
let carAvatars = {};
let driverManufacturers = {};
let livercChassis = {};

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

function podiumIllustration(rows, photoName, className) {
  const places = [2, 1, 3].map(place => {
    const row = rows.find(result => Number(result[2]) === place);
    const key = String(row?.[1] || '');
    const name = driverByKey.get(key) || key || 'Awaiting result';
    const entry = carAvatars[key];
    const avatar = typeof entry === 'string' ? entry : entry && typeof entry === 'object'
      ? entry[className] || entry.default || (Object.values(entry).filter(Boolean).length === 1 ? Object.values(entry).find(Boolean) : '') : '';
    const chassis = livercChassis[key];
    const manufacturer = String(chassis?.name || driverManufacturers[key] || '').trim();
    const slug = String(chassis?.slug || manufacturer.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    const validAvatar = typeof avatar === 'string' && /^assets\/(?:car-avatars\/[A-Z0-9_-]+|matt-hodges-car)\.png$/.test(avatar);
    const source = validAvatar ? `../${avatar}` : slug ? `../assets/manufacturers/${slug}.png` : '../assets/cobra-logo.png';
    const fallback = manufacturer || 'COBRA';
    return `<div class="podium-illustration-place podium-illustration-${place}">
      <span class="podium-illustration-rank">${place}${place === 1 ? 'st' : place === 2 ? 'nd' : 'rd'}</span>
      <div class="podium-illustration-art"><img src="${escapeHtml(source)}" alt="${escapeHtml(validAvatar ? `${name} car` : manufacturer ? `${manufacturer} chassis logo` : 'COBRA club logo')}" loading="lazy"><span hidden>${escapeHtml(fallback)}</span></div>
      <strong>${escapeHtml(name)}</strong>
    </div>`;
  }).join('');
  return `<div class="podium-illustration" aria-label="Illustrated podium showing the first three drivers">
    <div class="podium-illustration-title">COBRA PODIUM</div>
    <div class="podium-illustration-places">${places}</div>
    <small>Race podium</small>
  </div>`;
}

function finalCard([raceId, race]) {
  const photoName = `${race.e}-${raceId}-podium.jpg`;
  const approvedPhoto = podiumPhotoByRaceId.get(String(raceId));
  const override = podiumPhotoOverrides.get(String(raceId));
  const hidePhoto = !podiumOverridesReady || override?.hidden === true;
  const replacement = typeof override?.image === 'string' && /^podium-photos\/[a-zA-Z0-9-]+\.(?:jpg|jpeg|png|webp)$/.test(override.image)
    ? new URL(`../${override.image}`, import.meta.url).href : '';
  const originalPhotoUrl = replacement || approvedPhoto?.imageUrl || `../podium-photos/${encodeURIComponent(photoName)}`;
  const photoUrl = hidePhoto ? '' : approvedPhoto && !replacement ? resizedDriveImage(originalPhotoUrl, 900) : originalPhotoUrl;
  const fullPhotoUrl = approvedPhoto && !replacement ? resizedDriveImage(originalPhotoUrl, 2400) : originalPhotoUrl;
  const photoSrcset = approvedPhoto && !replacement
    ? `${resizedDriveImage(originalPhotoUrl, 480)} 480w, ${resizedDriveImage(originalPhotoUrl, 900)} 900w, ${resizedDriveImage(originalPhotoUrl, 1400)} 1400w`
    : '';
  const originalUrl = replacement || approvedPhoto?.viewUrl || photoUrl;
  const photoTitle = `${race.c} ${race.n} podium`;
  const caption = approvedPhoto?.caption || '';
  const rows = raceTopThree(raceId);
  const results = rows.length
    ? rows.map(podiumRow).join('')
    : '<tr><td colspan="4" class="podium-no-results">No classified top-three result is available.</td></tr>';
  return `<article class="podium-card">
    <div class="podium-photo" data-full-image="${escapeHtml(fullPhotoUrl)}" data-original-image="${escapeHtml(originalUrl)}" data-photo-title="${escapeHtml(photoTitle)}" data-photo-caption="${escapeHtml(caption)}">
      ${hidePhoto ? '' : `<img src="${escapeHtml(photoUrl)}"${photoSrcset ? ` srcset="${escapeHtml(photoSrcset)}" sizes="(max-width: 650px) calc(100vw - 32px), (max-width: 1100px) 50vw, 520px"` : ''} alt="${escapeHtml(photoTitle)}" loading="lazy" decoding="async"><button class="podium-photo-expand" type="button">Enlarge photo</button>`}
      ${podiumIllustration(rows, photoName, race.c)}
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

function podiumUploadUrl(eventId = '') {
  if (!podiumWebAppUrl) return '';
  const url = new URL(podiumWebAppUrl);
  url.searchParams.set('page', 'podiums');
  if (eventId) url.searchParams.set('eventId', String(eventId));
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
  if (podiumWebAppUrl) $('podiumUploadLink').href = podiumUploadUrl(activeEventId);
  $('eventSelect').value = activeEventId;
  $('finalsGrid').innerHTML = finals.length ? finals.map(finalCard).join('') : '<div class="panel empty-state">No finals were found for this event.</div>';
  document.querySelectorAll('.podium-photo > img').forEach(image => {
    const markLoaded = () => {
      const photo = image.closest('.podium-photo');
      photo.classList.add('has-photo');
      photo.querySelector('.podium-illustration > small').textContent = 'Hover or tap to see rostrum photo';
      photo.tabIndex = 0;
      photo.setAttribute('role', 'button');
      photo.setAttribute('aria-label', 'Show rostrum photo: ' + photo.dataset.photoTitle);
      photo.setAttribute('aria-pressed', 'false');
    };
    const markFailed = () => {
      const photo = image.closest('.podium-photo');
      photo.querySelector('.podium-photo-expand')?.remove();
      image.remove();
    };
    image.addEventListener('load', markLoaded);
    image.addEventListener('error', markFailed);
    if (image.complete) image.naturalWidth ? markLoaded() : markFailed();
  });
  document.querySelectorAll('.podium-illustration-art img').forEach(image => {
    const showLabel = () => { image.hidden = true; image.nextElementSibling.hidden = false; };
    image.addEventListener('error', showLabel);
    if (image.complete && !image.naturalWidth) showLabel();
  });
  document.querySelectorAll('[data-event-id]').forEach(button => button.setAttribute('aria-current', String(button.dataset.eventId) === activeEventId ? 'true' : 'false'));
  if (updateAddress) {
    const url = new URL(window.location.href);
    url.searchParams.set('event', activeEventId);
    history.replaceState({}, '', url);
  }
}

async function loadPodiumPhotos() {
  const response = await fetch('../data/podiums-config.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error('Podium uploads are not configured.');
  const config = await response.json();
  podiumWebAppUrl = String(config.webAppUrl || '').trim();
  if (!podiumWebAppUrl) throw new Error('Podium uploads are not configured.');
  $('podiumUploadLink').href = podiumUploadUrl(activeEventId);
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

async function loadPodiumOverrides() {
  const response = await fetch('../data/podium-photo-overrides.json', { cache: 'no-cache' });
  if (!response.ok) return;
  const changes = await response.json();
  if (changes && typeof changes === 'object' && !Array.isArray(changes)) podiumPhotoOverrides = new Map(Object.entries(changes));
}

async function loadIllustrationData() {
  const files = await Promise.all(['car-avatars.json', 'driver-manufacturers.json', 'liverc-chassis.json'].map(async name => {
    try {
      const response = await fetch(`../data/${name}`, { cache: 'no-cache' });
      return response.ok ? await response.json() : {};
    } catch { return {}; }
  }));
  carAvatars = files[0] && typeof files[0] === 'object' ? files[0] : {};
  driverManufacturers = files[1] && typeof files[1] === 'object' ? files[1] : {};
  livercChassis = files[2] && typeof files[2] === 'object' ? files[2] : {};
}

function openPhoto(photo) {
  if (!window.matchMedia('(max-width: 800px)').matches) {
    window.open(photo.dataset.fullImage, '_blank', 'noopener,noreferrer');
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
  if (document.fullscreenEnabled && $('podiumLightbox').requestFullscreen) {
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
    const artworkReady = Promise.all([
      loadPodiumOverrides().then(() => { podiumOverridesReady = true; }).catch(error => console.warn(error.message)),
      loadIllustrationData()
    ]);
    const response = await fetch('../data/podium-results.json', { cache: 'no-cache' });
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
    await artworkReady;
    renderEvent(activeEventId, false);
    loadPodiumPhotos().then(() => {
      // Preserve the selected event; only rebuild once the photographs arrive.
      renderEvent(activeEventId, false);
    }).catch(error => console.warn(error.message));
  } catch (error) {
    $('eventTitle').textContent = 'Gallery unavailable';
    $('eventMeta').textContent = error.message;
    $('finalsGrid').innerHTML = `<div class="panel empty-state">${escapeHtml(error.message)}</div>`;
  }
}

$('finalsGrid').addEventListener('click', event => {
  const photo = event.target.closest('.podium-photo.has-photo');
  if (!photo) return;
  if (event.target.closest('.podium-photo-expand')) { openPhoto(photo); return; }
  const shown = photo.classList.toggle('show-photo');
  photo.setAttribute('aria-pressed', String(shown));
});
$('finalsGrid').addEventListener('keydown', event => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.podium-photo.has-photo')) {
    event.preventDefault();
    event.target.click();
  }
});
$('podiumLightboxClose').addEventListener('click', closePhoto);
$('podiumLightbox').addEventListener('click', event => { if (event.target === $('podiumLightbox')) closePhoto(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('podiumLightbox').hidden) closePhoto(); });

init();
