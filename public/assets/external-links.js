// Match the existing Wix menu destinations when the statistics site is embedded.
const siteRoot = new URL('../', import.meta.url);
const wixPages = new Map([
  ['', 'race-stats'],
  ['sword/', 'sword-tables'],
  ['club/', 'club-series-tables'],
  ['podiums/', 'Podium-Gallery'],
  ['setups/', 'drivers-setups'],
  ['avatar-upload/', 'upload-car-avatar'],
  ['car-avatars/', 'driver-car-avatars'],
  ['event/', 'current-event'],
  ['briefing/', 'drivers-briefing'],
  ['about/', 'about-cobra'],
  ['schedule/', 'club-schedule'],
]);
const embedded = window.self !== window.top;

function prepareLink(link) {
  if (link.hasAttribute('download')) return;
  let destination = new URL(link.href, location.href);
  if (embedded && destination.origin === siteRoot.origin && destination.pathname.startsWith(siteRoot.pathname)) {
    const route = destination.pathname.slice(siteRoot.pathname.length).replace(/index\.html$/, '');
    // Menu links select a section. Preserve filters and event-specific links elsewhere.
    const menuLink = Boolean(link.closest('.results-nav'));
    const tracker = route === '' && destination.searchParams.get('tracker') === '1';
    const wixPage = tracker ? 'driver-distance-tracker' : route === 'schedule/' && destination.searchParams.get('type') === 'sword' ? 'sword-schedule' : wixPages.get(route);
    if (wixPage && (menuLink || ((!destination.search || (tracker && [...destination.searchParams.keys()].every(key => key === 'tracker')) || (route === 'schedule/' && [...destination.searchParams.keys()].every(key => key === 'type'))) && !destination.hash))) {
      destination = new URL(wixPage, 'https://www.cobracardiff.co.uk/');
      link.href = destination.href;
    }
  }
  if (/^https?:$/.test(destination.protocol) && destination.origin !== location.origin) {
    link.target = '_top';
  }
}

// Set real destinations up front so copying links and opening tabs also work.
for (const link of document.querySelectorAll('a[href]')) prepareLink(link);
// Also cover results and booking links inserted or updated after page load.
document.addEventListener('click', event => {
  const link = event.target.closest?.('a[href]');
  if (link) prepareLink(link);
}, { capture: true });
