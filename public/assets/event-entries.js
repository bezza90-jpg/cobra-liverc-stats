import {addReserveActions} from './event-reserves.js';
import {entriesForMeeting,applyConfirmedChassis} from './event-entry-merge.js?v=20261019-capacity-live';
import {eventSpaces} from './event-capacity.js?v=20261029-filled-reserves';
import {nextMeeting} from './event-calendar.js?v=20260926-midnight';
import {entryIdentity} from './event-entry-identity.js';
import {compareEntryNames} from './event-entry-order.js';
const allowedAvatar = /^assets\/(?:car-avatars\/[A-Z0-9_-]+|matt-hodges-car)\.png$/;
const avatarClassName = className => ({
  '2WD': '2-Wheel Drive Buggy',
  '4WD': '4-Wheel Drive Buggy',
  'Stadium Trucks': 'Trucks'
}[className] || className);
function entryAvatar(avatars, revisions, entry, publicAvatars = {}) {
  const requestedClass = avatarClassName(entry.className);
  if (/^[0-9a-f]{20}$/.test(entry.avatarRef || '')) {
    const publicRecord = publicAvatars[entry.avatarRef] || {};
    const publicClass = typeof publicRecord[requestedClass] === 'string' ? requestedClass
      : typeof publicRecord['2-Wheel Drive Buggy'] === 'string' ? '2-Wheel Drive Buggy'
        : typeof publicRecord['4-Wheel Drive Buggy'] === 'string' ? '4-Wheel Drive Buggy' : 'default';
    const publicPath = publicRecord[publicClass];
    if (/^assets\/event-avatar-refs\/[a-z0-9-]+\.webp$/.test(publicPath || '')) return {src:'../' + publicPath, fallback:''};
  }
  const record = avatars?.[entry.driverKey];
  let className = typeof record === 'string' ? 'default' : (typeof record?.[requestedClass] === 'string' ? requestedClass : 'default');
  if (entry.className === 'Junior Racers' && typeof record === 'object' && typeof record?.[className] !== 'string') {
    className = typeof record['2-Wheel Drive Buggy'] === 'string' ? '2-Wheel Drive Buggy'
      : typeof record['4-Wheel Drive Buggy'] === 'string' ? '4-Wheel Drive Buggy'
        : 'default';
  }
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
  link.href = '../assets/event-entries.css?v=17';
  link.dataset.eventEntriesStyles = '';
  document.head.append(link);
}

function entrySection(type = '') {
  const section = document.createElement('section');
  section.className = 'panel event-entries-panel';
  section.dataset.eventEntries = '';
  section.id = 'eventEntries';
  if (type) section.dataset.eventType = type;
  section.innerHTML = '<div class="event-entries-heading"><div><p class="eyebrow">Next meeting</p><h2 data-entry-title>Event entries</h2><p data-entry-summary>Loading confirmed bookings…</p></div></div><div data-entry-content></div>';
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
    standings?.after(section);
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

function render(root, data, capacity = {}, calendar = {}, avatars = {}, revisions = {}, publicAvatars = {}) {
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
  summary.textContent = `${data.entries.length} confirmed ${data.entries.length === 1 ? 'entry' : 'entries'} following successful checkout${!currentEventPage && eventDate ? ` · ${eventDate}` : ''}`;
  let updated = root.querySelector('[data-entry-updated]');
  if (!updated) {
    updated = element('p', 'event-entries-updated');
    updated.dataset.entryUpdated = '';
    summary.after(updated);
  }
  const lastUpdated = new Date(data.updatedAt || '');
  updated.replaceChildren();
  if (Number.isNaN(lastUpdated.getTime())) {
    updated.textContent = 'Last updated: unavailable';
  } else {
    const time = element('time', '', lastUpdated.toLocaleString('en-GB', {
      day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit',
      hourCycle:'h23', timeZone:'Europe/London'
    }));
    time.dateTime = lastUpdated.toISOString();
    updated.append('Last updated: ', time, ' (UK time)');
  }
  content.replaceChildren();
  const meeting = nextMeeting(calendar.events || [], type);
  const spaces = eventSpaces(data, meeting, capacity);
  const spacesByClass = new Map(spaces.map(item => [item.name, item]));
  if (spaces.length && !currentEventPage) {
    const panel = element('section', 'event-spaces');
    panel.setAttribute('aria-label','Remaining race-class spaces');
    panel.append(element('h3','','Race-class spaces'));
    const cards = element('div','event-space-cards');
    for (const item of spaces) {
      const card = element('div','event-space-card');
      card.dataset.className=item.name;
      card.dataset.remaining=String(item.remaining);
      const label = {'Junior Racers':'Junior heat','4-Wheel Drive Buggy':'4WD','2-Wheel Drive Buggy':'2WD'}[item.name] || item.name;
      const occupiedRatio = Math.max(0, Math.min(1, item.entered / item.limit));
      const availabilityClass = item.remaining === 0
        ? 'event-space-status event-space-status--full'
        : 'event-space-status';
      const availability = element('b',availabilityClass,item.remaining ? `${item.remaining} spaces remaining` : 'Class Full');
      if (item.remaining > 0) {
        // Move continuously from green (available), through yellow at 50%,
        // to an increasingly deep orange as the class approaches capacity.
        const hue = Math.round(120 * (1 - occupiedRatio));
        availability.style.setProperty('--capacity-hue',String(hue));
      }
      const capacityScale = element('span','event-capacity-scale');
      const scaleSteps = 15;
      const filledSteps = Math.round(occupiedRatio * scaleSteps);
      capacityScale.setAttribute('role','progressbar');
      capacityScale.setAttribute('aria-label',`${label} ${Math.round(occupiedRatio * 100)}% occupied`);
      capacityScale.setAttribute('aria-valuemin','0');
      capacityScale.setAttribute('aria-valuemax','100');
      capacityScale.setAttribute('aria-valuenow',String(Math.round(occupiedRatio * 100)));
      for (let step = 1; step <= scaleSteps; step += 1) {
        const marker = element('i',step <= filledSteps ? 'is-filled' : '');
        const markerRatio = step / scaleSteps;
        marker.style.setProperty('--capacity-step',String(step));
        marker.style.setProperty('--capacity-step-hue',String(Math.round(120 * (1 - markerRatio))));
        capacityScale.append(marker);
      }
      card.append(element('strong','',label),availability,capacityScale,element('span','',`${item.entered} entered or reserved / ${item.limit} spaces`));
      cards.append(card);
    }
    panel.append(cards);
    addReserveActions(cards,meeting).catch(()=>{});
    const checked = new Date(data.updatedAt);
    const stamp = Number.isNaN(checked.getTime()) ? '' : ` Last refreshed ${checked.toLocaleString('en-GB',{timeZone:'Europe/London'})} (UK time).`;
    panel.append(element('p','',`Based on successful checkouts and race-control published entries.${stamp} New paid bookings appear automatically. Unpublished manual reservations remain private. Check availability when booking. Under-16s racing with seniors count in their car class.`));
    if (!currentEventPage && meeting.bookingEventId && /^[a-f0-9-]{36}$/i.test(meeting.bookingEventId)) {
      const booking=element('a','event-entry-source','Book this event ↗');
      booking.href='https://headless-bkqwbmqsasx-bezza90-1407.wix-site-host.com/booking-preview?event='+encodeURIComponent(meeting.bookingEventId); booking.target='_blank'; booking.rel='noopener'; panel.append(booking);
    }
    const eventSummary = currentEventPage ? document.getElementById('eventTitle')?.closest('.panel') : null;
    (eventSummary || content).append(panel);
  }
  if (!data.entries.length) {
    content.append(element('p', 'event-entries-empty', 'Driver entries will appear here following successful checkout.'));
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
  const drivers=[...new Map(data.entries.filter(e=>e.driverKey).map(e=>[e.driverKey,e.driverName])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
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
    const name = currentEventPage && /^(junior|juniors|junior racers)$/i.test(entry.className) ? 'Junior Racers' : entry.className;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(entry);
  }
  if (currentEventPage && !groups.has('Junior Racers')) groups.set('Junior Racers', []);
  const classOrder = new Map([
    ['2-Wheel Drive Buggy', 0],
    ['2WD', 0],
    ['4-Wheel Drive Buggy', 1],
    ['4WD', 1],
    ['Junior Racers', 2],
    ['Juniors', 2],
    ['Vintage', 3],
    ['Stadium Trucks', 4],
    ['Trucks', 4]
  ]);
  const orderedGroups = [...groups.entries()].sort(([classA], [classB]) => {
    const orderDifference = (classOrder.get(classA) ?? 99) - (classOrder.get(classB) ?? 99);
    return orderDifference || classA.localeCompare(classB);
  });
  const renderedGroups = [];
  for (const [className, entries] of orderedGroups) {
    entries.sort(compareEntryNames);
    const group = element('details', 'event-entry-class');
    group.open = true;
    const heading = element('summary');
    const compactClassName = currentEventPage ? ({
      '2-Wheel Drive Buggy':'2WD',
      '4-Wheel Drive Buggy':'4WD',
      'Junior Racers':'Junior',
      'Vintage':'Vintage',
      'Stadium Trucks':'Trucks',
      'Trucks':'Trucks'
    }[className] || className) : className;
    const titleRow = element('span', 'event-entry-class-title');
    titleRow.append(element('span', '', compactClassName), element('strong', '', String(entries.length)));
    const classCapacity = spacesByClass.get(className) || spacesByClass.get({
      '2-Wheel Drive Buggy':'2WD',
      '4-Wheel Drive Buggy':'4WD',
      'Junior Racers':'Junior',
      'Stadium Trucks':'Trucks'
    }[className]);
    if (currentEventPage && classCapacity?.limit) {
      const occupied = Math.max(classCapacity.entered, entries.length);
      const remaining = Math.max(0, classCapacity.limit - occupied);
      const occupiedPercent = Math.min(100, Math.round(occupied / classCapacity.limit * 100));
      const capacityHeader = element('span', 'event-entry-class-capacity');
      const track = element('span', 'event-entry-class-capacity-track');
      const fill = element('span', 'event-entry-class-capacity-fill');
      fill.style.width = occupiedPercent + '%';
      track.style.setProperty('--event-entry-capacity', occupiedPercent + '%');
      track.setAttribute('role', 'progressbar');
      track.setAttribute('aria-label', compactClassName + ' capacity');
      track.setAttribute('aria-valuemin', '0');
      track.setAttribute('aria-valuemax', '100');
      track.setAttribute('aria-valuenow', String(occupiedPercent));
      track.append(fill);
      const nearlyFull = remaining <= Math.max(2, Math.ceil(classCapacity.limit * .2));
      const status = remaining <= 0 ? 'Class full'
        : nearlyFull ? 'Nearly full'
          : occupiedPercent >= 50 ? 'Filling up' : 'Spaces available';
      capacityHeader.append(track, element('span', 'event-entry-class-capacity-status', status));
      heading.append(capacityHeader);
    }
    heading.append(titleRow);
    const wrap = element('div', 'event-entry-table-wrap');
    const table = element('table', 'event-entry-table');
    const head = document.createElement('thead');
    head.innerHTML = '<tr><th scope="col">Driver</th><th scope="col">Chassis</th><th scope="col">Flag</th><th scope="col" class="event-entry-avatar-heading">Car</th></tr>';
    const body = document.createElement('tbody');
    for (const [index, entry] of entries.entries()) {
      const row = document.createElement('tr');
      row.dataset.search = `${entry.driverName} ${entry.bookingName || ''} ${entry.className} ${entry.chassis}`.toLowerCase();
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
      const avatar = entryAvatar(avatars, revisions, entry, publicAvatars);
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
      if (entry.className === 'Junior Racers') {
        driverIdentity.append(element('span', '', entry.driverName));
      } else {
        const profile = element('a', '', entry.driverName);
        profile.href = `../?driver=${encodeURIComponent(entry.driverKey)}&returnTo=${encodeURIComponent(location.pathname + location.search + location.hash)}`;
        driverIdentity.append(profile);
      }
      driver.append(driverIdentity);
      const chassis = element('td');
      const slug = {'team associated':'team-associated','associated':'team-associated','schumacher':'schumacher','kyosho':'kyosho','xray':'xray','yokomo':'yokomo','losi':'losi','team losi':'losi','tlr':'tlr','team losi racing':'tlr','ttech':'ttech','ttech racing concepts':'ttech','sworkz':'sworkz','agama':'agama','tamiya':'tamiya','pr':'pr','pr racing':'pr','r1 wurks':'r1-wurks'}[String(entry.chassis || '').trim().toLowerCase()];
      if (slug) {
        const logo = element('img', 'event-entry-chassis-logo');
        logo.src = '../assets/manufacturers/' + slug + '.png'; logo.alt = entry.chassis; logo.title = entry.chassis; logo.loading = 'lazy';
        logo.addEventListener('error', () => {
          if (!logo.dataset.retried) {
            logo.dataset.retried = 'true';
            logo.src = '../assets/manufacturers/' + slug + '.png?retry=' + Date.now();
            return;
          }
          chassis.textContent = entry.chassis;
        });
        chassis.append(logo);
      } else { chassis.textContent = entry.chassis || 'Not listed'; }
      chassis.dataset.label = 'Chassis';
      if (!entry.chassis) chassis.classList.add('event-entry-missing');
      row.append(driver, chassis, country, avatarCell);
      body.append(row);
    }
    table.append(head, body);
    wrap.append(table);
    group.append(heading, wrap);
    renderedGroups.push({className, group});
  }
  const vintageGroup = renderedGroups.find(({className}) => className.toLowerCase() === 'vintage');
  const truckGroups = renderedGroups.filter(({className}) => ['trucks', 'stadium trucks'].includes(className.toLowerCase()));
  const junior = currentEventPage && renderedGroups.find(({className}) => className === 'Junior Racers');
  const column = [vintageGroup, ...truckGroups, junior].filter(Boolean);
  const stackedGroups = new Set(column.length > 1 ? column : []);
  for (const rendered of renderedGroups) {
    if (stackedGroups.has(rendered)) {
      if (rendered !== column[0]) continue;
      const stack = element('div', 'event-entry-class-stack');
      stack.append(...column.map(({group}) => group));
      classes.append(stack);
      continue;
    }
    classes.append(rendered.group);
  }
  content.append(classes);
  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    for (const row of classes.querySelectorAll('tbody tr')) row.hidden = !!query && !row.dataset.search.includes(query);
    for (const group of classes.querySelectorAll('details')) {
      const visible = [...group.querySelectorAll('tbody tr')].some(row => !row.hidden);
      group.hidden = !!query && !visible;
      if (query && visible) group.open = true;
    }
  });
}

function showEntriesUnavailable(root) {
  root.querySelector('[data-entry-summary]').textContent = 'Driver entries are temporarily unavailable. Please try again shortly.';
  root.querySelector('[data-entry-content]').replaceChildren();
  root.querySelector('[data-entry-updated]')?.remove();
}

if (roots.length) {
  const fresh = path => `${path}?fresh=${Date.now()}`;
  const optionalData = (path, cache = 'no-cache') =>
    fetch(path, {cache}).then(response => response.ok ? response.json() : {}).catch(() => ({}));
  const calendarReady = optionalData('../data/event-calendar.json');
  const assetsReady = Promise.all([
    fetch(fresh('../data/next-event-entries.json'), {cache:'no-store'}).then(response => {
      if (!response.ok) throw Error('Entries unavailable');
      return response.json();
    }),
    optionalData(fresh('../data/wix-current-event-entries.json'), 'no-store'),
    optionalData('../data/car-avatar-driver-aliases.json'),
    optionalData(fresh('../data/event-capacities.json'), 'no-store'),
    optionalData('../data/car-avatars.json'),
    optionalData('../data/car-avatar-source-revisions.json'),
    optionalData('../data/confirmed-event-chassis.json'),
    optionalData('../data/event-avatar-refs.json')
  ]);
  const feeds = new Map();
  async function loadMeeting(root) {
    const calendar = await calendarReady;
    const meeting = nextMeeting(calendar.events || [], expectedType(root));
    let live = null;
    if (meeting?.date && meeting?.type) {
      const params = new URLSearchParams({type:meeting.type, date:meeting.date});
      const key = params.toString();
      if (!feeds.has(key)) {
        params.set('fresh', String(Date.now()));
        const url = 'https://booking.cobracardiff.co.uk/api/public-meeting-bookings?' + params;
        feeds.set(key, fetch(url, {cache:'no-store'}).then(response => response.ok ? response.json() : null).catch(() => null));
      }
      live = await feeds.get(key);
    }
    return {calendar, meeting, live};
  }

  roots.forEach(root => {
    Promise.all([loadMeeting(root), assetsReady]).then(([
      {calendar, meeting, live}, [data, wix, aliases, capacity, avatars, revisions, confirmed, publicAvatars]
    ]) => {
      const currentPage = location.pathname.replace(/\/+$/, '').endsWith('/event');
      if (currentPage && (!meeting || live?.active !== true || live.date !== meeting.date ||
          live.type !== meeting.type || !Array.isArray(live.entries))) {
        showEntriesUnavailable(root);
        return;
      }
      const identifiedData = {...data, entries:(data.entries || []).map(entry => entryIdentity(entry, aliases))};
      const bookingData = live?.active ? {...live, eventDate:live.date, updatedAt:new Date().toISOString()} : wix;
      const identifiedWix = {...bookingData, entries:(bookingData.entries || []).map(entry => entryIdentity(entry, aliases))};
      const combined = applyConfirmedChassis(entriesForMeeting(identifiedData, identifiedWix, meeting), confirmed);
      render(root, combined, capacity, calendar, avatars, revisions, publicAvatars);
    }).catch(() => showEntriesUnavailable(root));
  });
}
