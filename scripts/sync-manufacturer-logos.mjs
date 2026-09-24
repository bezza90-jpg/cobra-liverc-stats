import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The 300 × 300 artwork is hosted by LiveRC. Save local copies for SVG
// composition: browsers do not reliably load remote images within <img src=SVG>.
const logoUrls = {
  'team-associated': 'https://assets.liveracemedia.com/manufacturers/chassis/team-associated.png',
  schumacher: 'https://assets.liveracemedia.com/manufacturers/chassis/schumacher.png'
};
const destination = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/assets/manufacturers');
await mkdir(destination, { recursive: true });
for (const [name, url] of Object.entries(logoUrls)) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!response.ok || !String(response.headers.get('content-type') || '').toLowerCase().includes('image/png')) throw new Error(`HTTP ${response.status} or non-PNG content`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 400000 || bytes.length < 100 || !bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) throw new Error('Unexpected logo file');
    const output = path.join(destination, `${name}.png`);
    let existing = null;
    try { existing = await readFile(output); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!existing?.equals(bytes)) await writeFile(output, bytes);
    console.log(`${name}: LiveRC logo ready (${bytes.readUInt32BE(16)} × ${bytes.readUInt32BE(20)})`);
  } catch (error) {
    console.warn(`${name}: could not refresh LiveRC logo; keeping any existing copy (${error.message})`);
  }
}
