const allowedAvatar = /^assets\/(?:car-avatars\/[A-Z0-9_-]+|matt-hodges-car)\.png$/;
let catalogue;
let preview;

const escapeAttribute = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

export function resultAvatarCell(driverKey, className = '') {
  return `<td class="result-avatar-cell" data-avatar-driver="${escapeAttribute(driverKey)}" data-avatar-class="${escapeAttribute(className)}" aria-label="Avatar"></td>`;
}

function catalogueData() {
  return catalogue ||= Promise.all([
    fetch(new URL('../data/car-avatars.json', import.meta.url), {cache:'no-cache'}).then(response => response.ok ? response.json() : {}),
    fetch(new URL('../data/car-avatar-source-revisions.json', import.meta.url), {cache:'no-cache'}).then(response => response.ok ? response.json() : {}).catch(() => ({}))
  ]).catch(() => [{},{}]);
}

function ensurePreview() {
  if (preview) return preview;
  preview = document.createElement('img');
  preview.className = 'result-avatar-preview';
  preview.alt = '';
  preview.hidden = true;
  document.body.append(preview);
  return preview;
}

function showPreview(image) {
  const floating = ensurePreview();
  const rect = image.getBoundingClientRect();
  const width = Math.min(260, window.innerWidth - 24);
  const height = window.innerWidth <= 620 ? 140 : 170;
  floating.src = image.currentSrc || image.src;
  floating.style.width = `${width}px`;
  floating.style.height = `${height}px`;
  floating.style.left = `${Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2))}px`;
  floating.style.top = `${rect.bottom + height + 12 < window.innerHeight ? rect.bottom + 8 : Math.max(12, rect.top - height - 8)}px`;
  floating.hidden = false;
}

export async function hydrateResultAvatars(root = document) {
  const cells = [...root.querySelectorAll('.result-avatar-cell:not([data-avatar-ready])')];
  if (!cells.length) return;
  const [manifest, revisions] = await catalogueData();
  for (const cell of cells) {
    cell.dataset.avatarReady = 'true';
    const key = cell.dataset.avatarDriver;
    const className = cell.dataset.avatarClass;
    const record = manifest[key];
    const path = typeof record === 'string' ? record : record?.[className] || record?.default || (Object.values(record || {}).filter(Boolean).length === 1 ? Object.values(record).find(Boolean) : '');
    if (!allowedAvatar.test(path || '')) continue;
    const file = path.split('/').pop();
    const revision = revisions[`${key}|${className}`] || revisions[`${key}|default`] || '';
    const query = revision ? `?v=${encodeURIComponent(revision)}` : '';
    const image = document.createElement('img');
    image.className = 'result-avatar';
    image.src = `../assets/car-avatar-thumbnails/${file.replace(/\.png$/i,'.webp')}${query}`;
    image.dataset.fallback = `../${path}${query}`;
    image.alt = '';
    image.width = 52;
    image.height = 32;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.tabIndex = 0;
    image.title = 'Enlarge car avatar';
    image.addEventListener('pointerenter', () => showPreview(image));
    image.addEventListener('pointerleave', () => { if (preview) preview.hidden = true; });
    image.addEventListener('focus', () => showPreview(image));
    image.addEventListener('blur', () => { if (preview) preview.hidden = true; });
    image.addEventListener('error', () => {
      if (image.dataset.fallback) { image.src = image.dataset.fallback; delete image.dataset.fallback; }
      else image.remove();
    });
    cell.append(image);
  }
}
