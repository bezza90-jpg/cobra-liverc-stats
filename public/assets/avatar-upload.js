const $ = id => document.getElementById(id);
const status = message => { $('avatarStatus').textContent = message; };
let drivers = [];
let previewUrl = '';

function renderDrivers() {
  const selected = $('driverKey').value;
  const query = $('driverSearch').value.trim().toLocaleLowerCase();
  const matches = drivers.filter(driver => driver.n.toLocaleLowerCase().includes(query));
  $('driverKey').replaceChildren(new Option(query && !matches.length ? 'No matching driver' : 'Choose your name', ''));
  for (const driver of matches) $('driverKey').add(new Option(driver.n, driver.k));
  if (matches.some(driver => driver.k === selected)) $('driverKey').value = selected;
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
    renderDrivers();
    status('Choose your driver, class and car photo.');
  } catch (error) {
    $('driverKey').replaceChildren(new Option('Drivers unavailable', ''));
    status(error.message);
  }
}

$('driverSearch').addEventListener('input', renderDrivers);
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
    $('submittedDriverKey').value = $('driverKey').value;
    $('submittedClassName').value = $('className').value;
    $('submittedFlip').value = $('flipPhoto').checked ? 'yes' : 'no';
    $('submittedFileName').value = photo.name.slice(0, 140);
    $('submittedFileType').value = photo.type;
    $('fileBase64').value = String(reader.result).split(',')[1] || '';
    status('Sending your photo securely to COBRA…');
    $('avatarForm').submit();
  };
  reader.readAsDataURL(photo);
});

initialise();
