import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(root, 'public');
const read = async (relative, fallback = {}) => {
  try { return JSON.parse(await readFile(path.join(root, relative), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
};
const dashboard = await read('public/data/dashboard.json', null) || await read('admin/podium-tool/dashboard-cache.json', null);
if (!dashboard?.raceById || !Array.isArray(dashboard.raceResults)) throw new Error('No valid COBRA dashboard is available.');
const avatars = await read('public/data/car-avatars.json');
const manufacturers = await read('public/data/driver-manufacturers.json');
const names = new Map(dashboard.drivers.map(row => [String(row.k), String(row.n)]));
const eventNames = new Map(dashboard.events.map(row => [String(row.i), String(row.n)]));
const results = new Map();
for (const row of dashboard.raceResults) {
  if (Number(row[2]) < 1 || Number(row[2]) > 3) continue;
  const key = String(row[0]);
  if (!results.has(key)) results.set(key, []);
  results.get(key).push(row);
}
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
const shorten = (value, limit) => String(value || '').length > limit ? `${String(value).slice(0, limit - 1)}…` : String(value || '');
const inlineImage = async relative => {
  if (!/^assets\/[A-Za-z0-9/_-]+\.(?:png|webp|jpe?g)$/.test(relative)) return '';
  try {
    const bytes = await readFile(path.join(publicRoot, relative));
    if (bytes.length > 400_000) return '';
    const mime = relative.endsWith('.png') ? 'image/png' : relative.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    return `data:${mime};base64,${bytes.toString('base64')}`;
  } catch (error) { if (error.code === 'ENOENT') return ''; throw error; }
};
const embedded = new Map();
async function driverArt(key) {
  if (embedded.has(key)) return embedded.get(key);
  const avatar = String(avatars[key] || '');
  const manufacturer = String(manufacturers[key] || '').trim();
  const slug = manufacturer.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const image = (avatar && await inlineImage(avatar)) || (slug && await inlineImage(`assets/manufacturers/${slug}.png`)) || '';
  const value = { image, label: manufacturer || 'CAR PHOTO WELCOME', avatar: !!(avatar && image) };
  embedded.set(key, value);
  return value;
}
const output = path.join(publicRoot, 'podium-defaults');
await mkdir(output, { recursive: true });
const written = new Set();
let changed = 0;
for (const [raceId, race] of Object.entries(dashboard.raceById)) {
  if (!race.f || !/^[0-9]+$/.test(raceId)) continue;
  const top = (results.get(raceId) || []).sort((a, b) => Number(a[2]) - Number(b[2]));
  const columns = await Promise.all([1, 2, 3].map(async place => {
    const row = top.find(item => Number(item[2]) === place);
    const key = row ? String(row[1]) : '';
    const name = row ? names.get(key) || key : 'Awaiting result';
    return { place, name, art: key ? await driverArt(key) : { image: '', label: 'NO RESULT YET' } };
  }));
  const cards = columns.map(({ place, name, art }, index) => {
    const x = 34 + index * 389;
    const accent = ['#f7ce67', '#cbd5db', '#dca882'][index];
    const graphic = art.image
      ? `<image xlink:href="${art.image}" x="${x + 35}" y="307" width="318" height="196" preserveAspectRatio="xMidYMid meet"/>`
      : `<rect x="${x + 30}" y="348" width="329" height="102" rx="14" fill="#14291a"/><text x="${x + 194}" y="408" text-anchor="middle" font-size="23" fill="#bce9c5" font-weight="800">${escape(shorten(art.label, 24))}</text>`;
    return `<rect x="${x}" y="209" width="379" height="416" rx="19" fill="#f5f9f5"/><rect x="${x}" y="209" width="379" height="10" rx="5" fill="${accent}"/>
<circle cx="${x + 190}" cy="257" r="26" fill="${accent}"/><text x="${x + 190}" y="267" text-anchor="middle" font-size="27" font-weight="900" fill="#142317">${place}</text>
${graphic}<text x="${x + 190}" y="545" text-anchor="middle" font-size="23" font-weight="900" fill="#13251a">${escape(shorten(name, 24))}</text>
${art.image ? `<text x="${x + 190}" y="581" text-anchor="middle" font-size="16" fill="#496453">${escape(shorten(art.avatar ? 'DRIVER CAR' : art.label, 32))}</text>` : ''}`;
  }).join('');
  const filename = `${race.e}-${raceId}-podium.jpg`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="750" viewBox="0 0 1200 750" role="img" aria-label="Illustrated podium for ${escape(race.n)}">
<rect width="1200" height="750" fill="#07180c"/><path d="M0 0h1200v9H0z" fill="#08a31a"/>
<text x="35" y="72" font-family="Arial,sans-serif" font-size="39" font-weight="900" fill="#fff">COBRA <tspan fill="#85db89">PODIUM</tspan></text>
<text x="35" y="118" font-family="Arial,sans-serif" font-size="26" font-weight="800" fill="#fff">${escape(shorten(race.c, 44))} · ${escape(shorten(race.n, 42))}</text>
<text x="35" y="160" font-family="Arial,sans-serif" font-size="18" fill="#b4d7b9">${escape(shorten(eventNames.get(String(race.e)) || '', 79))} · ${escape(race.d)}</text>
<g font-family="Arial,sans-serif">${cards}</g>
<text x="600" y="669" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" fill="#cce3d1">Illustrated podium · upload the official photograph</text>
<text x="600" y="702" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" fill="#9acfa3">Upload image name: ${escape(filename)}</text>
</svg>\n`;
  const target = path.join(output, `${raceId}.svg`);
  written.add(`${raceId}.svg`);
  let previous = '';
  try { previous = await readFile(target, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (previous !== svg) { await writeFile(target, svg); changed++; }
}
for (const filename of await readdir(output)) if (/^[0-9]+\.svg$/.test(filename) && !written.has(filename)) await unlink(path.join(output, filename));
console.log(`Podium defaults: ${written.size} finals; ${changed} updated.`);
