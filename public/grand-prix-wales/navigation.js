(() => {
  const links = Array.from(document.querySelectorAll(
    '.gpw-section-nav a[href], .hub-grid a[href], a.back-link[href]'
  ));
  const prefetched = new Set();

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

  function prefetch(link) {
    const url = sameSiteUrl(link);
    if (!url || url.href === location.href.split('#')[0] || prefetched.has(url.href)) return;
    prefetched.add(url.href);
    const hint = document.createElement('link');
    hint.rel = 'prefetch';
    hint.as = 'document';
    hint.href = url.href;
    document.head.appendChild(hint);
  }

  for (const link of links) {
    link.addEventListener('pointerenter', () => prefetch(link), { passive: true });
    link.addEventListener('touchstart', () => prefetch(link), { passive: true });
    link.addEventListener('focus', () => prefetch(link), { passive: true });
    link.addEventListener('click', () => {
      const url = sameSiteUrl(link);
      if (!url || url.href === location.href.split('#')[0]) return;
      document.documentElement.classList.add('gpw-navigating');
      document.body.setAttribute('aria-busy', 'true');
    });
  }

  const warmNextPages = () => links.forEach(prefetch);
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(warmNextPages, { timeout: 1500 });
  } else {
    window.setTimeout(warmNextPages, 700);
  }
})();
