// Load only requested cars; immutable revision URLs retain normal browser caching.
export function createAvatarLoader({fetcher = fetch, createImage = () => new Image(), base = import.meta.url, onLoad = () => {}} = {}) {
  const images = new Map(), pending = new Map();
  let catalogue;
  const classes = ['default', '2-Wheel Drive Buggy', '4-Wheel Drive Buggy', 'Trucks', 'Vintage', 'Junior Racers'];
  const loadCatalogue = () => catalogue ||= Promise.all([
    fetcher(new URL('../data/car-avatars.json', base), {cache: 'no-cache'}).then(r => {if (!r.ok) throw Error('Avatar list unavailable'); return r.json();}),
    fetcher(new URL('../data/car-avatar-source-revisions.json', base), {cache: 'no-cache'}).then(r => r.ok ? r.json() : {}).catch(() => ({}))
  ]).catch(error => {catalogue = null; throw error;});
  function load(key) {
    if (images.has(key)) return Promise.resolve(images.get(key));
    if (pending.has(key)) return pending.get(key);
    const request = loadCatalogue().then(([manifest, revisions]) => {
      const entry = manifest[key];
      const cls = typeof entry === 'string' ? 'default' : classes.find(c => entry?.[c]);
      const path = typeof entry === 'string' ? entry : entry?.[cls];
      if (typeof path !== 'string' || !/^assets\/(?:car-avatars\/[A-Z0-9_-]+|matt-hodges-car)\.png$/.test(path)) return null;
      return new Promise(resolve => {
        const image = createImage();
        image.decoding = 'async';
        image.onload = () => {images.set(key, image); onLoad(key, image); resolve(image);};
        image.onerror = () => resolve(null);
        const url = new URL('../' + path, base);
        const revision = revisions[key + '|' + cls];
        if (revision) url.searchParams.set('v', String(revision));
        image.src = url.href;
      });
    }).catch(() => {pending.delete(key); return null;});
    pending.set(key, request);
    return request;
  }
  return {images, load};
}
