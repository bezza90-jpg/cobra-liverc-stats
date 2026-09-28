// Load only requested cars; immutable revision URLs retain normal browser caching.
export function createAvatarLoader({fetcher = fetch, createImage = () => new Image(), base = import.meta.url, onLoad = () => {}} = {}) {
  const images = new Map(), pending = new Map(), profilePending = new Map();
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
  function loadAll(key) {
    if (profilePending.has(key)) return profilePending.get(key);
    const request = loadCatalogue().then(async ([manifest, revisions]) => {
      const entry = manifest[key];
      let entries = typeof entry === 'string' ? [['default',entry]] : Object.entries(entry || {});
      entries = entries.filter(([,path]) => typeof path === 'string' && /^assets\/(?:car-avatars\/[A-Z0-9_-]+|matt-hodges-car)\.png$/.test(path));
      // The default is a fallback, not an additional racing class.
      if (entries.some(([cls])=>cls !== 'default')) entries = entries.filter(([cls])=>cls !== 'default');
      entries.sort(([a],[b])=>classes.indexOf(a)-classes.indexOf(b));
      return (await Promise.all(entries.map(([className,path])=>new Promise(resolve=>{
        const image=createImage(); image.decoding='async';
        image.onload=()=>resolve({className,image,displaySrc:fitAvatarImage(image)}); image.onerror=()=>resolve(null);
        const url=new URL('../'+path,base);
        const revision=revisions[key+'|'+className];
        if(revision) url.searchParams.set('v',String(revision));
        image.src=url.href;
      })))).filter(Boolean);
    }).catch(()=>{profilePending.delete(key); return [];});
    profilePending.set(key,request);
    return request;
  }
  return {images, load, loadAll};
}

// Crop only fully transparent margins for display; retain the original upload.
export function fitAvatarImage(image) {
  if (typeof document === 'undefined' || !image.naturalWidth) return image.src;
  try {
    const canvas=document.createElement('canvas');
    canvas.width=image.naturalWidth; canvas.height=image.naturalHeight;
    const context=canvas.getContext('2d',{willReadFrequently:true});
    context.drawImage(image,0,0);
    const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
    let left=canvas.width,top=canvas.height,right=-1,bottom=-1;
    for(let y=0;y<canvas.height;y++) for(let x=0;x<canvas.width;x++) {
      if(pixels[(y*canvas.width+x)*4+3] > 0) {left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    }
    if(right<left) return image.src;
    const width=right-left+1,height=bottom-top+1;
    image.avatarAspect = width / height;
    canvas.width=width;canvas.height=height;
    context.drawImage(image,left,top,width,height,0,0,width,height);
    return canvas.toDataURL('image/png');
  } catch { return image.src; }
}
