import {entryIdentity} from './event-entry-identity.js';
import {compareEntryNames} from './event-entry-order.js';
function installStyles() {
  if (document.querySelector('link[data-event-entries-styles]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '../assets/event-entries.css?v=2';
  link.dataset.eventEntriesStyles = '';
  document.head.append(link);
}

function entrySection(type = '') {
  const section = document.createElement('section');
  section.className = 'panel event-entries-panel';
  section.dataset.eventEntries = '';
  if (type) section.dataset.eventType = type;
  section.innerHTML = '<div class="event-entries-heading"><div><p class="eyebrow">Next meeting</p><h2 data-entry-title>Event entries</h2><p data-entry-summary>Loading entries from LiveRC…</p></div></div><div data-entry-content></div>';
  return section;
}

function installSection() {
  if (document.querySelector('[data-event-entries]')) return;
  const path = location.pathname.replace(/\/+$/, '');
  const main = document.querySelector('main');
  if (!main) return;
  if (path.endsWith('/event')) {
    const section = entrySection();
    const firstPanel = main.querySelector(':scope > .panel');
    firstPanel?.after(section);
  } else if (path.endsWith('/schedule')) {
    const section = entrySection('query');
    const firstPanel = main.querySelector(':scope > .panel');
    firstPanel?.after(section);
  } else if (document.body.dataset.championship) {
    const section = entrySection(document.body.dataset.championship);
    const standings = main.querySelector('.championship-panel');
    standings?.before(section);
  }
}

installStyles();
installSection();
const roots = [...document.querySelectorAll('[data-event-entries]')];

const countryNames = {
  GB: 'United Kingdom', 'GB-WLS': 'Wales', IE: 'Ireland', FR: 'France', DE: 'Germany', ES: 'Spain', IT: 'Italy', NL: 'Netherlands', BE: 'Belgium', US: 'United States'
};

function countryFlag(code = '') {
  const normal = String(code).toUpperCase();
  if (normal === 'GB-WLS') return '\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}';
  if (!/^[A-Z]{2}$/.test(normal)) return '🌐';
  return [...normal].map(letter => String.fromCodePoint(127397 + letter.charCodeAt(0))).join('');
}

function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function expectedType(root) {
  if (root.dataset.eventType !== 'query') return root.dataset.eventType || '';
  return new URLSearchParams(location.search).get('type') === 'sword' ? 'sword' : 'club';
}

function render(root, data) {
  const type = expectedType(root);
  if (type && data.type && type !== data.type) {
    root.hidden = true;
    return;
  }
  root.hidden = false;
  const title = root.querySelector('[data-entry-title]');
  const summary = root.querySelector('[data-entry-summary]');
  const content = root.querySelector('[data-entry-content]');
  title.textContent = data.title || 'Next COBRA event';
  const eventDate = data.date ? new Date(data.date + 'T12:00:00Z').toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'long', year:'numeric', timeZone:'UTC'}) : '';
  summary.textContent = `${data.entries.length} ${data.entries.length === 1 ? 'entry' : 'entries'} published in LiveRC${eventDate ? ` · ${eventDate}` : ''}`;
  content.replaceChildren();
  if (!data.entries.length) {
    content.append(element('p', 'event-entries-empty', 'Entries will appear here when they are published in LiveRC.'));
    return;
  }

  const controls = element('div', 'event-entry-controls');
  const search = element('input', 'event-entry-search');
  search.type = 'search';
  search.placeholder = 'Find a driver, class or chassis';
  search.setAttribute('aria-label', 'Filter event entries');
  const source = element('a', 'event-entry-source', 'View in LiveRC ↗');
  source.href = data.sourceUrl;
  source.target = '_blank';
  source.rel = 'noopener';
  controls.append(search, element('span', 'event-entry-order', 'Drivers A–Z by surname'), source);
  content.append(controls);

  const classes = element('div', 'event-entry-classes');
  const groups = new Map();
  for (const entry of data.entries) {
    if (!groups.has(entry.className)) groups.set(entry.className, []);
    groups.get(entry.className).push(entry);
  }
  for (const [className, entries] of groups) {
    entries.sort(compareEntryNames);
    const group = element('details', 'event-entry-class');
    group.open = true;
    const heading = element('summary');
    heading.append(element('span', '', className), element('strong', '', String(entries.length)));
    const wrap = element('div', 'event-entry-table-wrap');
    const table = element('table', 'event-entry-table');
    const head = document.createElement('thead');
    head.innerHTML = '<tr><th scope="col">Country</th><th scope="col">No.</th><th scope="col">Driver</th><th scope="col">Chassis</th><th scope="col">Transponder</th></tr>';
    const body = document.createElement('tbody');
    for (const [index, entry] of entries.entries()) {
      const row = document.createElement('tr');
      row.dataset.search = `${entry.driverName} ${entry.bookingName || ''} ${entry.className} ${entry.chassis} ${entry.transponder}`.toLowerCase();
      const country = document.createElement('td');
      const flag = String(entry.countryCode).toUpperCase() === 'GB' ? element('img', 'event-entry-flag-image') : element('span', 'event-entry-flag', countryFlag(entry.countryCode));
      if (flag.tagName === 'IMG') { flag.src = '../assets/gb-flag.svg'; flag.alt = 'United Kingdom'; flag.width = 32; flag.height = 16; }
      flag.title = countryNames[entry.countryCode] || entry.countryCode || 'Country not listed';
      flag.setAttribute('aria-label', flag.title);
      country.dataset.label = 'Country';
      country.append(flag);
      const driver = document.createElement('td');
      driver.dataset.label = 'Driver';
      const profile = element('a', '', entry.driverName);
      profile.href = `../?driver=${encodeURIComponent(entry.driverKey)}&returnTo=${encodeURIComponent(location.pathname + location.search + location.hash)}`;
      driver.append(profile);
      const chassis = element('td');
      const slug = {'team associated':'team-associated','associated':'team-associated','schumacher':'schumacher','kyosho':'kyosho','xray':'xray','yokomo':'yokomo','tlr':'tlr','team losi racing':'tlr','sworkz':'sworkz','agama':'agama','tamiya':'tamiya','pr':'pr','pr racing':'pr','r1 wurks':'r1-wurks'}[String(entry.chassis || '').trim().toLowerCase()];
      if (slug) {
        const logo = element('img', 'event-entry-chassis-logo');
        logo.src = '../assets/manufacturers/' + slug + '.png'; logo.alt = entry.chassis; logo.title = entry.chassis; logo.loading = 'lazy';
        logo.addEventListener('error', () => { chassis.textContent = entry.chassis; }, {once:true});
        chassis.append(logo);
      } else { chassis.textContent = entry.chassis || 'Not listed'; }
      chassis.dataset.label = 'Chassis';
      if (!entry.chassis) chassis.classList.add('event-entry-missing');
      const transponder = element('td', 'event-entry-transponder', entry.transponder || 'Not listed');
      transponder.dataset.label = 'Transponder';
      const number = element('td', 'event-entry-number', String(index + 1));
      number.dataset.label = 'No.';
      row.append(country, number, driver, chassis, transponder);
      body.append(row);
    }
    table.append(head, body);
    wrap.append(table);
    group.append(heading, wrap);
    classes.append(group);
  }
  content.append(classes);
  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    for (const row of classes.querySelectorAll('tbody tr')) row.hidden = !!query && !row.dataset.search.includes(query);
    for (const group of classes.querySelectorAll('details')) {
      const visible = [...group.querySelectorAll('tbody tr')].some(row => !row.hidden);
      group.hidden = !visible;
      if (query && visible) group.open = true;
    }
  });
}

if (roots.length) {
  Promise.all([
    fetch('../data/next-event-entries.json', {cache:'no-cache'}).then(response => { if (!response.ok) throw Error('Entries unavailable'); return response.json(); }),
    fetch('../data/car-avatar-driver-aliases.json', {cache:'no-cache'}).then(response => response.ok ? response.json() : {}).catch(() => ({}))
  ]).then(([data,aliases]) => roots.forEach(root => render(root, {...data, entries:data.entries.map(entry => entryIdentity(entry,aliases))})))
    .catch(() => roots.forEach(root => {
      const summary = root.querySelector('[data-entry-summary]');
      if (summary) summary.textContent = 'Entries are temporarily unavailable. Please check LiveRC.';
    }));
}
