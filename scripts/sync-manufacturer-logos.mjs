import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The Brand column on LiveRC's heat sheets contains each driver's chassis logo.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.join(root, 'public/assets/manufacturers');
const dataPath = path.join(root, 'public/data/liverc-chassis.json');
const origin = 'https://cobracardiff.liverc.com';
const imageOrigin = 'https://assets.liveracemedia.com';
const decode = value => String(value || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
const plain = html => decode(String(html || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const key = name => plain(name).toUpperCase().replace(/^\d+\s+/, '').replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
const logo = source => {
  try {
    const url = new URL(decode(source), origin);
    if (url.origin !== imageOrigin || !/^\/manufacturers\/chassis\/[a-z0-9-]+\.png$/i.test(url.pathname)) return null;
    return { slug: path.basename(url.pathname, '.png').toLowerCase(), url: url.href };
  } catch { return null; }
};
async function get(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'COBRA statistics updater/2.0' }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response;
}
const events = JSON.parse(await readFile(path.join(root, 'data/raw/events.json'), 'utf8'));
let previous = {};
try { previous = JSON.parse(await readFile(dataPath, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const found = {};
const imageUrls = new Map();
const sorted = [...events].sort((a, b) => String(b.eventDate || b.date).localeCompare(String(a.eventDate || a.date)));
for (const event of sorted) {
  try {
    const page = await (await get(event.sourceUrl)).text();
    const links = [...page.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)]
      .map(match => new URL(decode(match[1]), origin))
      .filter(url => url.origin === origin && url.searchParams.get('p') === 'view_heat_sheet');
    if (!links.length) continue;
    const html = await (await get(links[0])).text();
    for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...row[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map(cell => cell[1]);
      if (cells.length < 3 || !/^\d+$/.test(plain(cells[0]))) continue;
      const driver = key(cells[1]);
      const source = cells[2].match(/<img\b[^>]*src=["']([^"']+)["']/i)?.[1];
      const image = logo(source);
      if (!driver || !image || found[driver]) continue;
      const alt = cells[2].match(/<img\b[^>]*alt=["']([^"']+)["']/i)?.[1];
      const name = plain(alt) || image.slug.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join(' ');
      found[driver] = { name, slug: image.slug };
      imageUrls.set(image.slug, image.url);
    }
  } catch (error) { console.warn(`LiveRC chassis: skipped event ${event.liveRcEventId} (${error.message})`); }
}
const brands = { ...previous, ...found };
await mkdir(destination, { recursive: true });
for (const slug of ['team-associated', 'schumacher']) {
  if (!imageUrls.has(slug)) imageUrls.set(slug, `${imageOrigin}/manufacturers/chassis/${slug}.png`);
}
for (const [slug, url] of imageUrls) {
  try {
    const bytes = Buffer.from(await (await get(url)).arrayBuffer());
    if (bytes.length < 100 || bytes.length > 400000 || !bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) throw new Error('Invalid PNG');
    await writeFile(path.join(destination, `${slug}.png`), bytes);
  } catch (error) { console.warn(`LiveRC chassis: could not update ${slug} (${error.message})`); }
}
await writeFile(dataPath, `${JSON.stringify(brands, null, 2)}\n`);
console.log(`LiveRC chassis: ${Object.keys(found).length} drivers found; ${Object.keys(brands).length} recorded.`);
