const $ = id => document.getElementById(id);
const status = message => { $('avatarStatus').textContent = message; };
let drivers = [];
let previewUrl = '';
let selectedDriver = null;
let activeMatch = -1;
let pendingNonce = '';
let uploadTimer = 0;

function closeMatches() {
  $('driverMatches').hidden = true;
  $('driverSearch').setAttribute('aria-expanded', 'false');
  $('driverSearch').removeAttribute('aria-activedescendant');
  activeMatch = -1;
}

function chooseDriver(driver) {
  selectedDriver = driver;
  $('driverSearch').value = driver.n;
  $('driverSearch').setCustomValidity('');
  closeMatches();
}

function highlightMatch(index) {
  const buttons = [...$('driverMatches').querySelectorAll('button')];
  if (!buttons.length) return;
  activeMatch = Math.max(0, Math.min(index, buttons.length - 1));
  buttons.forEach((button, position) => button.setAttribute('aria-selected', String(position === activeMatch)));
  $('driverSearch').setAttribute('aria-activedescendant', buttons[activeMatch].id);
  buttons[activeMatch].scrollIntoView({ block: 'nearest' });
}

function renderDrivers() {
  const query = $('driverSearch').value.trim().toLocaleLowerCase();
  const matches = query ? drivers.filter(driver => driver.n.toLocaleLowerCase().includes(query)).slice(0, 15) : [];
  $('driverMatches').replaceChildren();
  if (!drivers.length || !query || (selectedDriver && selectedDriver.n === $('driverSearch').value)) {
    closeMatches();
    return;
  }
  if (!matches.length) {
    const message = document.createElement('p');
    message.textContent = 'No matching driver. Try a different part of the name.';
    $('driverMatches').append(message);
  }
  matches.forEach((driver, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = `avatarDriverMatch${index}`;
    button.role = 'option';
    button.setAttribute('aria-selected', 'false');
    button.textContent = driver.n;
    button.addEventListener('pointerdown', event => event.preventDefault());
    button.addEventListener('click', () => chooseDriver(driver));
    $('driverMatches').append(button);
  });
  activeMatch = -1;
  $('driverSearch').removeAttribute('aria-activedescendant');
  $('driverMatches').hidden = false;
  $('driverSearch').setAttribute('aria-expanded', 'true');
}

async function initialise() {
  try {
    const [dashboardResponse, configResponse] = await Promise.all([
      fetch('../data/dashboard.json', { cache: 'no-store' }),
      fetch('../data/avatar-upload-config.json', { cache: 'no-store' })
    ]);
    if (!dashboardResponse.ok || !configResponse.ok) throw new Error('The driver list or upload settings could not be loaded.');
    const [dashboard, config] = await Promise.all([dashboardResponse.json(), configResponse.json()]);
    drivers = (dashboard.drivers || []).filter(driver => /^[A-Za-z0-9_-]+$/.test(String(driver.k)) && driver.n)
      .map(driver => ({ k: String(driver.k), n: String(driver.n) }))
      .sort((a, b) => a.n.localeCompare(b.n, 'en-GB'));
    if (!drivers.length) throw new Error('No drivers are available yet.');
    const endpoint = String(config.webAppUrl || '');
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint)) {
      throw new Error('Photo uploading is being connected. Please try again shortly.');
    }
    $('avatarForm').action = endpoint;
    $('submitAvatar').disabled = false;
    $('driverSearch').setCustomValidity('Choose your name from the matching list.');
    status('Choose your driver, class and car photo.');
  } catch (error) {
    $('driverSearch').placeholder = 'Drivers unavailable';
    status(error.message);
  }
}

$('driverSearch').addEventListener('input', () => {
  selectedDriver = null;
  $('driverSearch').setCustomValidity('Choose your name from the matching list.');
  const exact = drivers.filter(driver => driver.n.toLocaleLowerCase() === $('driverSearch').value.trim().toLocaleLowerCase());
  if (exact.length === 1) chooseDriver(exact[0]);
  else renderDrivers();
});
$('driverSearch').addEventListener('focus', renderDrivers);
$('driverSearch').addEventListener('blur', () => setTimeout(closeMatches, 150));
$('driverSearch').addEventListener('keydown', event => {
  if (event.key === 'Escape') { closeMatches(); return; }
  const buttons = [...$('driverMatches').querySelectorAll('button')];
  if ($('driverMatches').hidden || !buttons.length) return;
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    highlightMatch(event.key === 'ArrowDown' ? activeMatch + 1 : activeMatch < 0 ? buttons.length - 1 : activeMatch - 1);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    buttons[activeMatch < 0 ? 0 : activeMatch].click();
  }
});
$('carPhoto').addEventListener('change', () => {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  const file = $('carPhoto').files[0];
  $('photoPreview').hidden = !file;
  if (file) {
    previewUrl = URL.createObjectURL(file);
    $('previewImage').src = previewUrl;
  }
});
$('flipPhoto').addEventListener('change', () => $('previewImage').classList.toggle('flipped', $('flipPhoto').checked));
$('avatarForm').addEventListener('submit', event => {
  event.preventDefault();
  if (!$('avatarForm').reportValidity()) return;
  if (!selectedDriver) { $('driverSearch').focus(); status('Choose your name from the matching list.'); return; }
  const photo = $('carPhoto').files[0];
  if (!photo || !/^image\/(?:jpeg|png|webp)$/.test(photo.type) || photo.size > 6_000_000) {
    status('Choose a JPG, PNG or WebP photo smaller than 6 MB.');
    return;
  }
  $('submitAvatar').disabled = true;
  status('Preparing your photo for COBRA approval…');
  const reader = new FileReader();
  reader.onerror = () => { $('submitAvatar').disabled = false; status('The photo could not be read. Please try again.'); };
  reader.onload = () => {
    pendingNonce = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    $('submittedDriverKey').value = selectedDriver.k;
    $('submittedClassName').value = $('className').value;
    $('submittedFlip').value = $('flipPhoto').checked ? 'yes' : 'no';
    $('submittedFileName').value = photo.name.slice(0, 140);
    $('submittedFileType').value = photo.type;
    $('fileBase64').value = String(reader.result).split(',')[1] || '';
    $('clientNonce').value = pendingNonce;
    status('Sending your photo securely to COBRA…');
    clearTimeout(uploadTimer);
    uploadTimer = setTimeout(() => {
      if (!pendingNonce) return;
      $('submitAvatar').disabled = false;
      status('The upload did not return a result. Please check your connection and try again.');
      pendingNonce = '';
    }, 90000);
    $('avatarForm').submit();
  };
  reader.readAsDataURL(photo);
});

window.addEventListener('message', event => {
  const trustedGoogle = event.origin === 'https://script.google.com' || /^https:\/\/[a-z0-9-]+\.googleusercontent\.com$/i.test(event.origin);
  const result = event.data;
  if (!trustedGoogle || !result || result.type !== 'cobra-avatar-upload' || !pendingNonce || result.nonce !== pendingNonce) return;
  clearTimeout(uploadTimer);
  pendingNonce = '';
  $('submitAvatar').disabled = false;
  status(String(result.message || (result.ok ? 'Photo received.' : 'The upload could not be completed.')));
  if (result.ok) {
    $('avatarForm').reset();
    selectedDriver = null;
    $('driverSearch').setCustomValidity('Choose your name from the matching list.');
    $('photoPreview').hidden = true;
    $('previewImage').classList.remove('flipped');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
  }
});

initialise();
