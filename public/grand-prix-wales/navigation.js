(() => {
  const navGroup = document.querySelector('.gpw-section-nav > div');
  if (navGroup && !navGroup.querySelector('.gpw-entries-link')) {
    const entriesLink = document.createElement('a');
    entriesLink.className = 'gpw-entries-link';
    entriesLink.href = '/grand-prix-wales/#entries';
    entriesLink.textContent = 'Confirmed entries';
    const homeLink = navGroup.querySelector('a');
    if (homeLink) homeLink.insertAdjacentElement('afterend', entriesLink);
    else navGroup.prepend(entriesLink);
  }

  const links = Array.from(document.querySelectorAll(
    '.gpw-section-nav a[href], .hub-grid a[href], a.back-link[href]'
  ));

  function sameSiteUrl(link) {
    try {
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return null;
      url.hash = '';
      return url;
    } catch {
      return null;
    }
  }

  for (const link of links) {
    link.addEventListener('click', () => {
      const url = sameSiteUrl(link);
      if (!url || url.href === location.href.split('#')[0]) return;
      document.documentElement.classList.add('gpw-navigating');
      document.body.setAttribute('aria-busy', 'true');
    });
  }

  // Shared site-shell navigation owns deliberate, browser-managed prefetching.
  // Do not preload the entire GPW hub or start requests on touch/focus here:
  // those legacy requests can compete with the navigation itself.
  window.addEventListener('pageshow', () => {
    document.documentElement.classList.remove('gpw-navigating');
    document.body.removeAttribute('aria-busy');
  });
})();
