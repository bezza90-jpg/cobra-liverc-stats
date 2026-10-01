import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
const check = process.argv.includes('--check');
const marker = '<!-- Cloudflare Web Analytics -->';
const snippet = `${marker}<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"8bd96a91178344ddb3c5078533d44dde"}'></script><!-- End Cloudflare Web Analytics -->`;

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? htmlFiles(target) : entry.name === 'index.html' ? [target] : [];
  }))).flat();
}

for (const file of await htmlFiles(publicRoot)) {
  const html = await readFile(file, 'utf8');
  const cleaned = html.replace(/<!-- Cloudflare Web Analytics -->[\s\S]*?<!-- End Cloudflare Web Analytics -->/g, '');
  const updated = cleaned.replace('</head>', `${snippet}</head>`);
  if (updated === html) continue;
  if (check) throw new Error(`Cloudflare analytics is missing or out of date in ${path.relative(publicRoot, file)}; run npm run build:analytics.`);
  await writeFile(file, updated);
}

console.log(`Cloudflare analytics ${check ? 'checked' : 'built'} for every published page.`);
