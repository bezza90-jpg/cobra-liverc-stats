import {eventSpaces} from './event-capacity.js';
import {nextMeeting} from './event-calendar.js?v=20260926-midnight';
import {entryIdentity} from './event-entry-identity.js';
import {compareEntryNames} from './event-entry-order.js';
const allowedAvatar = /^assets\/(?:car-avatars\/[A-Z0-9_-]+|matt-hodges-car)\.png$/;
function entryAvatar(avatars, revisions, entry) {
  const record = avatars?.[entry.driverKey];
  const juniorClasses = ['2-Wheel Drive Buggy', '4-Wheel Drive Buggy', 'Junior Racers', 'default'];
  const className = typeof record === 'string'
    ? 'default'
    : entry.className === 'Junior Racers'
      ? juniorClasses.find(candidate => typeof record?.[candidate] === 'string')
      : (typeof record?.[entry.className] === 'string' ? entry.className : 'default');
  const path = typeof record === 'string' ? record : record?.[className];
  if (typeof path !== 'string' || !allowedAvatar.test(path)) return null;
  const revision = revisions?.[entry.driverKey + '|' + className];
  const query = revision ? '?v=' + encodeURIComponent(revision) : '';
  return {src:'../assets/car-avatar-thumbnails/' + path.split('/').pop().replace(/\.png$/i,'.webp') + query, fallback:'../' + path + query};
}
function installStyles() {
  if (document.querySelector('link[data-event-entries-styles]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '../assets/event-entries.css?v=8';
  link.dataset.eventEntriesStyles = '';
  document.head.append(link);
}

function entrySection(type = '') {
  const section = document.createElement('section');
  section.className = 'panel event-entries-panel';
  section.dataset.eventEntries = '';
  section.id = 'eventEntries';
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
    section.querySelector('.eyebrow').textContent = 'Entries';
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

function render(root, data, capacity = {}, calendar = {}, avatars = {}, revisions = {}) {
  const currentEventPage = location.pathname.replace(/\/+$/, '').endsWith('/event');
  const type = expectedType(root);
  const activeSeason = document.body.dataset.activeChampionshipSeason || '';
  const currentSeason = document.body.dataset.currentChampionshipSeason || '';
  if (document.body.dataset.championship && activeSeason && currentSeason && activeSeason !== currentSeason) {
    root.hidden = true;
    return;
  }
  if (type && data.type && type !== data.type) {
    root.hidden = true;
    return;
  }
  root.hidden = false;
  const title = root.querySelector('[data-entry-title]');
  const summary = root.querySelector('[data-entry-summary]');
  const content = root.querySelector('[data-entry-content]');
  title.textContent = currentEventPage ? 'Driver entries' : (data.title || 'Next COBRA event');
  const eventDate = data.date ? new Date(data.date + 'T12:00:00Z').toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'long', year:'numeric', timeZone:'UTC'}) : '';
  summary.textContent = `${data.entries.length} ${data.entries.length === 1 ? 'entry' : 'entries'} published in LiveRC${!currentEventPage && eventDate ? ` · ${eventDate}` : ''}`;
  content.replaceChildren();
  const meeting = nextMeeting(calendar.events || [], type);
  const spaces = eventSpaces(data, meeting, capacity);
  if (spaces.length) {
    const panel = element('section', 'event-spaces');
    panel.setAttribute('aria-label','Remaining race-class spaces');
    panel.append(element('h3','','Race-class spaces'));
    const cards = element('div','event-space-cards');
    for (const item of spaces) {
      const card = element('div','event-space-card');
      const label = {'Junior Racers':'Junior heat','4-Wheel Drive Buggy':'4WD','2-Wheel Drive Buggy':'2WD'}[item.name] || item.name;
      card.append(element('strong','',label),element('b','',item.remaining ? `${item.remaining} spaces remaining` : 'Class full'),element('span','',`${item.entered} entered or reserved / ${item.limit} spaces`));
      cards.append(card);
    }
    panel.append(cards);
    const checked = new Date(data.updatedAt);
    const stamp = Number.isNaN(checked.getTime()) ? '' : ` Last refreshed ${checked.toLocaleString('en-GB',{timeZone:'Europe/London'})} (UK time).`;
    panel.append(element('p','',`Based on current Wix bookings and published LiveRC entries${spaces.some(item=>item.confirmed) ? ', with race-control confirmed entries' : ''}.${stamp} New bookings normally appear after the next automatic update. Club-driver reservations are included where configured. Check availability when booking. Under-16s racing with seniors count in their car class.`));
    if (!currentEventPage && /^https:\/\/www\.cobracardiff\.co\.uk\/event-details-1\//.test(meeting.bookingUrl || '')) {
      const booking=element('a','event-entry-source','Book this event ↗');
      booking.href=meeting.bookingUrl; booking.target='_blank'; booking.rel='noopener'; panel.append(booking);
    }
    const eventSummary = currentEventPage ? document.querySelector('main.info-main > .panel') : null;
    (eventSummary || content).append(panel);
  }
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
  const savedControls=element('div','remember-driver');
  const label=element('label','','My driver (on this device)');
  const picker=element('select');picker.setAttribute('aria-label','Choose my driver');
  picker.append(new Option('Choose your name',''));
  const drivers=[...new Map(data.entries.map(e=>[e.driverKey,e.driverName])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
  for(const [key,name] of drivers) picker.append(new Option(name,key));
  let remembered='';try{remembered=localStorage.getItem('cobra-my-driver')||'';}catch{}
  if(drivers.some(([key])=>key===remembered)) picker.value=remembered;
  const remember=element('button','','Remember me'),mine=element('button','','Show my entries'),all=element('button','','Show all'),forget=element('button','','Forget me');
  for(const b of [remember,mine,all,forget]) b.type='button';
  const message=element('span');message.setAttribute('role','status');
  mine.disabled=!picker.value;
  picker.addEventListener('change',()=>{mine.disabled=!picker.value;});
  remember.addEventListener('click',()=>{if(!picker.value){message.textContent='Choose your name first.';return;}try{localStorage.setItem('cobra-my-driver',picker.value);message.textContent='Saved on this device.';}catch{message.textContent='This browser cannot save your choice; Show my entries still works.';}});
  mine.addEventListener('click',()=>{search.value=drivers.find(([key])=>key===picker.value)?.[1]||'';search.dispatchEvent(new Event('input'));});
  all.addEventListener('click',()=>{search.value='';search.dispatchEvent(new Event('input'));});
  forget.addEventListener('click',()=>{try{localStorage.removeItem('cobra-my-driver');picker.value='';mine.disabled=true;search.value='';search.dispatchEvent(new Event('input'));message.textContent='Saved choice removed.';}catch{message.textContent='Could not remove the saved choice in this browser.';}});
  label.append(picker);savedControls.append(label,remember,mine,all,forget,message);content.append(savedControls);

  const classes = element('div', 'event-entry-classes');
  const avatarPreview = element('img', 'event-entry-avatar-preview');
  avatarPreview.alt = '';
  avatarPreview.hidden = true;
  content.append(avatarPreview);
  const showAvatarPreview = image => {
    const rect = image.getBoundingClientRect();
    const width = Math.min(260, window.innerWidth - 24);
    const height = 170;
    avatarPreview.src = image.currentSrc || image.src;
    avatarPreview.style.width = `${width}px`;
    avatarPreview.style.left = `${Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2))}px`;
    avatarPreview.style.top = `${rect.bottom + height + 12 < window.innerHeight ? rect.bottom + 8 : Math.max(12, rect.top - height - 8)}px`;
    avatarPreview.hidden = false;
  };
  const hideAvatarPreview = () => { avatarPreview.hidden = true; };
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
    head.innerHTML = '<tr><th scope="col">Country</th><th scope="col">No.</th><th scope="col">Driver</th><th scope="col" class="event-entry-avatar-heading">Avatar</th><th scope="col">Chassis</th><th scope="col">Transponder</th></tr>';
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
      const avatarCell = document.createElement('td');
      avatarCell.className = 'event-entry-avatar-cell';
      avatarCell.dataset.label = 'Avatar';
      const avatar = entryAvatar(avatars, revisions, entry);
      if (avatar) {
        const image = element('img', 'event-entry-avatar');
        image.src = avatar.src;
        image.dataset.fallback = avatar.fallback;
        image.alt = '';
        image.loading = 'eager';
        image.fetchPriority = 'auto';
        image.decoding = 'async';
        image.width = 52;
        image.height = 32;
        image.tabIndex = 0;
        image.title = `Enlarge ${entry.driverName}'s car avatar`;
        image.addEventListener('pointerenter', () => showAvatarPreview(image));
        image.addEventListener('pointerleave', hideAvatarPreview);
        image.addEventListener('focus', () => showAvatarPreview(image));
        image.addEventListener('blur', hideAvatarPreview);
        image.addEventListener('error', () => {
          if (image.dataset.fallback) {
            image.src = image.dataset.fallback;
            delete image.dataset.fallback;
            if (!avatarPreview.hidden) avatarPreview.src = image.src;
          } else image.remove();
        });
        avatarCell.append(image);
      }
      const driver = document.createElement('td');
      driver.dataset.label = 'Driver';
      const driverIdentity = element('span', 'event-entry-driver');
      const profile = element('a', '', entry.driverName);
      profile.href = `../?driver=${encodeURIComponent(entry.driverKey)}&returnTo=${encodeURIComponent(location.pathname + location.search + location.hash)}`;
      driverIdentity.append(profile);
      driver.append(driverIdentity);
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
      row.append(country, number, driver, avatarCell, chassis, transponder);
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
    ,fetch('../data/event-capacities.json', {cache:'no-cache'}).then(r=>r.ok?r.json():{}).catch(()=>({}))
    ,fetch('../data/event-calendar.json', {cache:'no-cache'}).then(r=>r.ok?r.json():{}).catch(()=>({}))
    ,fetch('../data/car-avatars.json', {cache:'no-cache'}).then(r=>r.ok?r.json():{}).catch(()=>({}))
    ,fetch('../data/car-avatar-source-revisions.json', {cache:'no-cache'}).then(r=>r.ok?r.json():{}).catch(()=>({}))
  ]).then(([data,aliases,capacity,calendar,avatars,revisions]) => roots.forEach(root => render(root, {...data, entries:data.entries.map(entry => entryIdentity(entry,aliases))},capacity,calendar,avatars,revisions)))
    .catch(() => roots.forEach(root => {
      const summary = root.querySelector('[data-entry-summary]');
      if (summary) summary.textContent = 'Entries are temporarily unavailable. Please check LiveRC.';
    }));
}
