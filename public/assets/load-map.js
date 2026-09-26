// Load the optional map only when the distance tracker is opened.
let pending;
export function loadMap() {
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    let remaining = 2;
    const timeout = setTimeout(fail, 15000);
    function fail() {
      clearTimeout(timeout);
      style.onload = script.onload = style.onerror = script.onerror = null;
      style.remove();
      script.remove();
      pending = undefined;
      reject(new Error('The road map could not be loaded. Close it and try again.'));
    }
    function loaded() {
      if (--remaining) return;
      if (!window.L) return fail();
      clearTimeout(timeout);
      resolve(window.L);
    }
    style.onload = script.onload = loaded;
    style.onerror = script.onerror = fail;
    document.head.append(style, script);
  });
  return pending;
}
