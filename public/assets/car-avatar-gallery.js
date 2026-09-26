const classOrder = ['2-Wheel Drive Buggy', '4-Wheel Drive Buggy', 'Trucks', 'Vintage', 'Junior Racers', 'default'];
function imagesFor(entry) {
  const entries = typeof entry === 'string' ? [['default', entry]] : entry && typeof entry === 'object' ? Object.entries(entry) : [];
  return entries.filter(([, path]) => typeof path === 'string' && /^assets\/(?:car-avatars\/[A-Z0-9_-]+|matt-hodges-car)\.png$/.test(path))
    .sort(([a], [b]) => (classOrder.indexOf(a) < 0 ? 99 : classOrder.indexOf(a)) - (classOrder.indexOf(b) < 0 ? 99 : classOrder.indexOf(b)) || a.localeCompare(b));
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
async function initialise() {
  const status = document.getElementById('galleryStatus');
  try {
    const responses = await Promise.all([fetch('../data/driver-directory.json', { cache: 'no-cache' }), fetch('../data/car-avatars.json', { cache: 'no-cache' })]);
    if (responses.some(response => !response.ok)) throw new Error('Unable to load the driver gallery. Please refresh to try again.');
    const [dashboard, manifest] = await Promise.all(responses.map(response => response.json()));
    if (!Array.isArray(dashboard.drivers) || !manifest || typeof manifest !== 'object') throw new Error('The driver gallery is unavailable. Please try again later.');
    const drivers = dashboard.drivers.filter(driver => /^[A-Za-z0-9_-]+$/.test(String(driver.k)) && driver.n && driver.k !== 'BOB-BOBTECH-GELSTHARP')
      .map(driver => ({ ...driver, images: imagesFor(manifest[driver.k]) }))
      .sort((a,b) => Number(Boolean(b.images.length)) - Number(Boolean(a.images.length)) || a.n.localeCompare(b.n, 'en-GB'));
    const search = document.getElementById('driverSearch');
    const render = () => {
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
            image.src = '../' + path;
            image.alt = driver.n + ' — ' + label;
            image.loading = 'lazy';
            image.width = 320;
            image.height = 200;
            image.addEventListener('error', () => {
              image.replaceWith(element('p', 'car-image-unavailable', 'Image unavailable'));
            }, { once: true });
            figure.append(image, element('figcaption', '', label));
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
