// Optional artwork configured privately by the COBRA desktop manager.
const page = location.pathname.match(/\/(podiums|setups|sword|club)\/(?:index\.html)?$/)?.[1] || 'stats';
try {
  const response = await fetch(new URL('../data/site-media.json', import.meta.url), { cache: 'no-store' });
  if (response.ok) {
    const media = await response.json();
    const valid = value => typeof value === 'string' && /^assets\/site-images\/[a-z0-9-]+\.(?:png|jpg|jpeg|webp)$/.test(value);
    const hero = media[page]?.hero;
    if (valid(hero)) {
      const imageUrl = new URL(`../${hero}`, import.meta.url);
      if (Number.isSafeInteger(media[page]?.version)) imageUrl.searchParams.set('v', media[page].version);
      const url = imageUrl.href;
      document.querySelector('header.hero')?.style.setProperty('background-image',
        `linear-gradient(115deg,rgba(4,11,7,.92),rgba(4,35,12,.68)),url("${url}")`);
      document.querySelector('header.hero')?.style.setProperty('background-size', 'cover');
      document.querySelector('header.hero')?.style.setProperty('background-position', 'center');
    }
    for (const image of document.querySelectorAll('img[data-cobra-media]')) {
      const asset = media[page]?.[image.dataset.cobraMedia];
      if (valid(asset)) image.src = new URL(`../${asset}`, import.meta.url).href;
    }
  }
} catch {
  // Pages keep their original artwork when the optional media list is absent.
}
