const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const naturalSort = new Intl.Collator('en-GB', { numeric: true, sensitivity: 'base' });
const formatDate = value => value ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`)) : '';
const normaliseName = value => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');

let dashboard;
let config;
let setups = [];
let filteredSetups = [];
let eventById = new Map();

function validAppsScriptUrl(value) {
  return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec(?:\?.*)?$/.test(String(value || '').trim());
}

function podiumLink(setup) {
  if (!setup.eventId || !dashboard) return '';
  const driverKey = setup.driverKey || dashboard.drivers.find(driver => normaliseName(driver.n) === normaliseName(setup.driverName))?.k;
  if (!driverKey) return '';
  const podiumRaceIds = new Set(Object.entries(dashboard.raceById)
    .filter(([, race]) => race.f && String(race.e) === String(setup.eventId))
    .map(([raceId]) => String(raceId)));
  const hasPodium = dashboard.raceResults.some(result => podiumRaceIds.has(String(result[0])) && result[1] === driverKey && Number(result[2]) >= 1 && Number(result[2]) <= 3);
  return hasPodium ? `../podiums/?event=${encodeURIComponent(setup.eventId)}` : '';
}

function safeDrivePreview(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'drive.google.com' ? url.href : '';
  } catch {
    return '';
  }
}

function setupCard(setup) {
  const event = eventById.get(String(setup.eventId || ''));
  const eventUrl = event?.u || setup.eventUrl || '';
  const podiumUrl = podiumLink(setup);
  const previewUrl = safeDrivePreview(setup.previewUrl);
  const model = setup.model ? `<span>${escapeHtml(setup.model)}</span>` : '';
  const eventLabel = event ? `${formatDate(event.d)} — ${event.n}` : (setup.eventName || 'General setup');
  const notes = setup.notes ? `<p class="setup-notes">${escapeHtml(setup.notes).replace(/\n/g, '<br>')}</p>` : '<p class="setup-notes setup-no-notes">No additional setup notes were supplied.</p>';
  const eventLink = eventUrl ? `<a class="event-link" href="${escapeHtml(eventUrl)}" target="_blank" rel="noopener">Event results ↗</a>` : '';
  const podium = podiumUrl ? `<a class="event-link setup-podium-link" href="${escapeHtml(podiumUrl)}">View event podiums 🏆</a>` : '';
  const download = setup.viewUrl ? `<a class="event-link" href="${escapeHtml(setup.viewUrl)}" target="_blank" rel="noopener">Open setup sheet ↗</a>` : '';
  return `<article class="setup-card">
    <div class="setup-preview">
      ${previewUrl ? `<iframe src="${escapeHtml(previewUrl)}" title="${escapeHtml(setup.driverName)} ${escapeHtml(setup.className)} setup preview" loading="lazy" allow="autoplay"></iframe>` : '<div class="setup-file-placeholder"><strong>Setup sheet</strong><span>Preview unavailable</span></div>'}
    </div>
    <div class="setup-card-copy">
      <div class="setup-tags"><span>${escapeHtml(setup.brand)}</span><span>${escapeHtml(setup.className)}</span></div>
      <h3>${escapeHtml(setup.driverName)}</h3>
      ${model}
      <p class="setup-event-name">${escapeHtml(eventLabel)}</p>
      ${notes}
      <div class="setup-links">${download}${eventLink}${podium}</div>
      <small class="setup-published">Shared ${escapeHtml(formatDate(setup.reviewedAt || setup.submittedAt))}</small>
    </div>
  </article>`;
}

function render() {
  const query = $('setupSearch').value.trim().toLowerCase();
  const brand = $('setupBrand').value;
  const className = $('setupClass').value;
  const eventId = $('setupEvent').value;
  filteredSetups = setups.filter(setup => {
    const haystack = [setup.driverName, setup.brand, setup.model, setup.className, setup.eventName, setup.notes].join(' ').toLowerCase();
    return (!query || haystack.includes(query)) && (!brand || setup.brand === brand) && (!className || setup.className === className) && (!eventId || String(setup.eventId || '') === eventId);
  });
  filteredSetups.sort((a, b) => String(b.reviewedAt || b.submittedAt).localeCompare(String(a.reviewedAt || a.submittedAt)) || naturalSort.compare(a.driverName, b.driverName));
  $('setupResultCount').textContent = `${filteredSetups.length} ${filteredSetups.length === 1 ? 'setup' : 'setups'} shown`;
  $('setupGrid').innerHTML = filteredSetups.length ? filteredSetups.map(setupCard).join('') : '<div class="panel empty-state">No approved setup sheets match these filters yet.</div>';
}

function populateFilters() {
  const brands = [...new Set(setups.map(setup => setup.brand).filter(Boolean))].sort(naturalSort.compare);
  $('setupBrand').innerHTML = '<option value="">All manufacturers</option>' + brands.map(brand => `<option>${escapeHtml(brand)}</option>`).join('');
  const setupEvents = [...new Set(setups.map(setup => String(setup.eventId || '')).filter(Boolean))]
    .map(id => eventById.get(id) || { i: id, n: setups.find(item => String(item.eventId) === id)?.eventName || id, d: '' })
    .sort((a, b) => String(b.d).localeCompare(String(a.d)));
  $('setupEvent').innerHTML = '<option value="">All events</option>' + setupEvents.map(event => `<option value="${escapeHtml(event.i)}">${escapeHtml(event.d ? `${formatDate(event.d)} — ${event.n}` : event.n)}</option>`).join('');
}

function loadApprovedSetups(url) {
  return new Promise((resolve, reject) => {
    const callback = `cobraSetups_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const timer = window.setTimeout(() => finish(new Error('The setup library took too long to respond.')), 15000);
    function finish(error, value) {
      window.clearTimeout(timer);
      delete window[callback];
      script.remove();
      error ? reject(error) : resolve(value);
    }
    window[callback] = payload => payload?.ok ? finish(null, payload.setups || []) : finish(new Error(payload?.error || 'Unable to load setup library.'));
    const endpoint = new URL(url);
    endpoint.searchParams.set('action', 'list');
    endpoint.searchParams.set('callback', callback);
    endpoint.searchParams.set('_', Date.now());
    script.onerror = () => finish(new Error('Unable to connect to the setup library.'));
    script.src = endpoint.href;
    document.head.appendChild(script);
  });
}

function openUpload() {
  if (!validAppsScriptUrl(config?.appsScriptUrl)) {
    $('setupUploadUnavailable').hidden = false;
    $('setupUploadUnavailable').textContent = 'Setup uploading is awaiting its one-time Google Drive connection.';
    $('setupUploadFrame').hidden = true;
  } else {
    $('setupUploadUnavailable').hidden = true;
    $('setupUploadFrame').hidden = false;
    if (!$('setupUploadFrame').src) {
      const uploadUrl = new URL(config.appsScriptUrl);
      uploadUrl.searchParams.set('view', 'upload');
      $('setupUploadFrame').src = uploadUrl.href;
    }
  }
  $('setupUploadDialog').showModal();
}

async function init() {
  [$('openUpload'), $('openUploadBottom')].forEach(button => button.addEventListener('click', openUpload));
  $('closeUpload').addEventListener('click', () => $('setupUploadDialog').close());
  $('setupUploadDialog').addEventListener('click', event => { if (event.target === $('setupUploadDialog')) $('setupUploadDialog').close(); });
  ['setupSearch', 'setupBrand', 'setupClass', 'setupEvent'].forEach(id => $(id).addEventListener(id === 'setupSearch' ? 'input' : 'change', render));
  $('resetSetupFilters').addEventListener('click', () => {
    $('setupSearch').value = '';
    $('setupBrand').value = '';
    $('setupClass').value = '';
    $('setupEvent').value = '';
    render();
  });
  window.addEventListener('message', event => {
    if (event.data?.type === 'cobra-setup-submitted') {
      $('setupConnectionNotice').hidden = false;
      $('setupConnectionNotice').textContent = 'Thank you — the setup has been submitted for approval.';
    }
  });

  try {
    const [dashboardResponse, configResponse] = await Promise.all([
      fetch('../data/dashboard.json', { cache: 'no-store' }),
      fetch('../data/setups-config.json', { cache: 'no-store' })
    ]);
    if (!dashboardResponse.ok) throw new Error('Unable to load COBRA event data.');
    dashboard = await dashboardResponse.json();
    config = configResponse.ok ? await configResponse.json() : {};
    eventById = new Map(dashboard.events.map(event => [String(event.i), event]));

    if (validAppsScriptUrl(config.appsScriptUrl)) {
      setups = await loadApprovedSetups(config.appsScriptUrl);
    } else {
      $('setupConnectionNotice').hidden = false;
      $('setupConnectionNotice').textContent = 'The page is ready. Complete the one-time Google Drive connection to enable submissions and published setups.';
    }
    $('setupTotal').textContent = setups.length.toLocaleString('en-GB');
    populateFilters();
    render();
  } catch (error) {
    $('setupConnectionNotice').hidden = false;
    $('setupConnectionNotice').textContent = error.message;
    $('setupTotal').textContent = '0';
    setups = [];
    populateFilters();
    render();
  }
}

init();
