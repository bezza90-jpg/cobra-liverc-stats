import {fitAvatarImage} from './avatar-loader.js';
const classOrder = ['2-Wheel Drive Buggy', '4-Wheel Drive Buggy', 'Trucks', 'Vintage', 'Junior Racers', 'default'];
function imagesFor(entry) {
  let entries = typeof entry === 'string' ? [['default', entry]] : entry && typeof entry === 'object' ? Object.entries(entry) : [];
  if (entries.some(([cls, path]) => ['2-Wheel Drive Buggy', '4-Wheel Drive Buggy'].includes(cls) && typeof path === 'string' && /^assets\/(?:car-avatars\/[A-Z0-9_-]+|matt-hodges-car)\.png$/.test(path))) entries = entries.filter(([cls]) => cls !== 'default');
  return entries.filter(([, path]) => typeof path === 'string' && /^assets\/(?:car-avatars\/[A-Z0-9_-]+|matt-hodges-car)\.png$/.test(path))
    .sort(([a], [b]) => (classOrder.indexOf(a) < 0 ? 99 : classOrder.indexOf(a)) - (classOrder.indexOf(b) < 0 ? 99 : classOrder.indexOf(b)) || a.localeCompare(b));
}
function thumbnailFor(path) {
  const file = path.split('/').pop().replace(/\.png$/i, '.webp');
  return '../assets/car-avatar-thumbnails/' + file;
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
function fitDisplayedCar(image) {
  if (image.src.startsWith('data:')) return;
  const fitted = fitAvatarImage(image);
  if (fitted !== image.src) image.src = fitted;
}
// One shared preview avoids clipping by gallery cards or the viewport edges.
const preview = element('div', 'car-avatar-preview');
preview.hidden = true;
preview.setAttribute('role', 'tooltip');
preview.id = 'carAvatarPreview';
const previewImage = element('img');
previewImage.addEventListener('load', () => fitDisplayedCar(previewImage));
const previewCaption = element('p');
preview.append(previewImage, previewCaption);
document.body.append(preview);
let previewOwner = null;
function hidePreview() {
  if (previewOwner) previewOwner.removeAttribute('aria-describedby');
  previewOwner = null;
  preview.hidden = true;
}
function showPreview(button, image) {
  hidePreview();
  previewOwner = button;
  button.setAttribute('aria-describedby', preview.id);
  previewImage.src = image.dataset.fullSrc || image.src;
  previewImage.alt = image.alt;
  previewCaption.textContent = image.alt;
  preview.hidden = false;
  const rect = button.getBoundingClientRect();
  const box = preview.getBoundingClientRect();
  const margin = 12;
  const left = Math.max(margin, Math.min(innerWidth - box.width - margin, rect.left + rect.width / 2 - box.width / 2));
  const below = rect.bottom + margin;
  const top = below + box.height <= innerHeight - margin ? below : Math.max(margin, rect.top - box.height - margin);
  preview.style.left = left + 'px';
  preview.style.top = top + 'px';
}
document.addEventListener('keydown', event => { if (event.key === 'Escape') hidePreview(); });
document.addEventListener('pointerdown', event => { if (previewOwner && !previewOwner.contains(event.target)) hidePreview(); });
window.addEventListener('scroll', hidePreview, true);
window.addEventListener('resize', hidePreview);
async function initialise() {
  const status = document.getElementById('galleryStatus');
  try {
    const revisionRequest = fetch('../data/car-avatar-source-revisions.json', {cache:'no-store'}).then(response => response.ok ? response.json() : {}).catch(() => ({}));
    const aliasRequest = fetch('../data/car-avatar-driver-aliases.json', {cache:'no-store'}).then(response => response.ok ? response.json() : {}).catch(() => ({}));
    const responses = await Promise.all([fetch('../data/driver-directory.json', {cache:'no-store'}), fetch('../data/car-avatars.json', {cache:'no-store'})]);
    if (responses.some(response => !response.ok)) throw new Error('Unable to load the driver gallery. Please refresh to try again.');
    const [dashboard, manifest] = await Promise.all(responses.map(response => response.json()));
    // Images retain their filename when re-reviewed; a revision prevents stale cutouts.
    const [revisions, aliases] = await Promise.all([revisionRequest, aliasRequest]);
    if (!Array.isArray(dashboard.drivers) || !manifest || typeof manifest !== 'object') throw new Error('The driver gallery is unavailable. Please try again later.');
    const aliasEntries = Object.entries(aliases).filter(([source, value]) => /^[A-Z0-9_-]+$/.test(source) && value && /^[A-Z0-9_-]+$/.test(value.driverKey));
    const aliasBySource = new Map(aliasEntries);
    const displayByCanonical = new Map(aliasEntries.map(([, value]) => [value.driverKey, value.displayName || value.driverKey]));
    const canonicalDrivers = new Map();
    for (const driver of dashboard.drivers) {
      if (!/^[A-Za-z0-9_-]+$/.test(String(driver.k)) || !driver.n || driver.k === 'BOB-BOBTECH-GELSTHARP') continue;
      const target = aliasBySource.get(driver.k)?.driverKey || driver.k;
      if (!canonicalDrivers.has(target) || driver.k === target) canonicalDrivers.set(target, { ...driver, k: target, n: displayByCanonical.get(target) || driver.n });
    }
    const sourceRevision = (driverKey, className) => {
      if (revisions[driverKey + '|' + className]) return revisions[driverKey + '|' + className];
      for (const [source, value] of aliasEntries) if (value.driverKey === driverKey && revisions[source + '|' + className]) return revisions[source + '|' + className];
      return '';
    };
    const drivers = [...canonicalDrivers.values()]
      .map(driver => ({ ...driver, images: imagesFor(manifest[driver.k]) }))
      .sort((a,b) => Number(Boolean(b.images.length)) - Number(Boolean(a.images.length)) || a.n.localeCompare(b.n, 'en-GB'));
    const search = document.getElementById('driverSearch');
    const render = () => {
    hidePreview();
    const query = search.value.trim().toLocaleLowerCase('en-GB');
    const matches = query ? drivers.filter(driver => driver.n.toLocaleLowerCase('en-GB').includes(query)) : drivers.filter(driver => driver.images.length);
    const fragment = document.createDocumentFragment();
    for (const [hasImages, title] of [[true, 'Drivers with car avatars'], [false, 'Drivers without car avatars']]) {
      const group = matches.filter(driver => Boolean(driver.images.length) === hasImages);
      if (!group.length) continue;
      const section = element('section', 'car-gallery-section');
      section.append(element('h2', '', title));
      const list = element('ul', 'car-driver-list');
      for (const driver of group) {
        const row = element('li', 'panel car-driver');
        row.append(element('h3', '', driver.n));
        if (driver.images.length) {
          const cars = element('div', 'car-image-grid');
          for (const [className, path] of driver.images) {
            const label = className === 'default' ? 'General car avatar' : className;
            const figure = element('figure', 'car-image-card');
            const image = element('img');
            const revision = sourceRevision(driver.k, className);
            image.loading = 'lazy';
            image.decoding = 'async';
            image.addEventListener('load', () => fitDisplayedCar(image));
            const revisionQuery = revision ? '?v=' + encodeURIComponent(revision) : '';
            image.src = thumbnailFor(path) + revisionQuery;
            image.dataset.fullSrc = '../' + path + revisionQuery;
            image.alt = driver.n + ' — ' + label;
            image.loading = 'lazy';
            image.width = 320;
            image.height = 200;
            image.addEventListener('error', () => {
              if (image.dataset.thumbnailFallback !== 'true' && image.src !== image.dataset.fullSrc) {
                image.dataset.thumbnailFallback = 'true';
                image.src = image.dataset.fullSrc;
                return;
              }
              if (previewOwner === zoomButton) hidePreview();
              zoomButton.disabled = true;
              image.replaceWith(element('p', 'car-image-unavailable', 'Image unavailable'));
            }, { once: true });
            const zoomButton = element('button', 'car-avatar-zoom');
            zoomButton.type = 'button';
            zoomButton.setAttribute('aria-label', 'Enlarge ' + image.alt);
            zoomButton.append(image);
            zoomButton.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') showPreview(zoomButton, image); });
            zoomButton.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse' && document.activeElement !== zoomButton) hidePreview(); });
            zoomButton.addEventListener('focus', () => showPreview(zoomButton, image));
            zoomButton.addEventListener('blur', hidePreview);
            zoomButton.addEventListener('click', () => showPreview(zoomButton, image));
            figure.append(zoomButton, element('figcaption', '', label));
            cars.append(figure);
          }
          row.append(cars);
        } else row.append(element('p', 'car-no-avatar', 'No car avatar yet'));
        list.append(row);
      }
      section.append(list);
      fragment.append(section);
    }
    document.getElementById('driverGallery').replaceChildren(fragment);
    const withImages = drivers.filter(driver => driver.images.length).length;
    status.textContent = query ? (matches.length ? matches.length + ' matching drivers' : 'No drivers match that name. Try another name.') : (drivers.length ? drivers.length + ' drivers · ' + withImages + ' with car avatars. Search to find any driver.' : 'No drivers are available yet.');
    };
    search.disabled = false;
    search.addEventListener('input', render);
    render();
  } catch (error) { status.textContent = error.message; }
}
initialise();
