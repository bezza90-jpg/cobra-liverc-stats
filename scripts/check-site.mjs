import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
const site = path.join(root, 'public');
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(path.join(directory, entry.name)) : path.join(directory, entry.name)))).flat();
}
const errors = [];
async function checkReference(file, reference) {
  if (!reference || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\?)/i.test(reference)) return;
  const clean = decodeURIComponent(reference.split(/[?#]/)[0]);
  if (!clean) return;
  const target = clean.startsWith('/') ? path.resolve(site, '.' + clean) : path.resolve(path.dirname(file), clean);
  if (!target.startsWith(site + path.sep) && target !== site) { errors.push('Reference outside public: ' + reference); return; }
  try {
    const info = await stat(target);
    if (info.isDirectory()) await stat(path.join(target, 'index.html'));
  } catch { errors.push(path.relative(site, file) + ': missing ' + reference); }
}
const published = await files(site);
for (const file of published) {
  if (file.endsWith('.html')) {
    const html = await readFile(file, 'utf8');
    for (const match of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)) await checkReference(file, match[1]);
    // Literal fetch URLs resolve against the document, not the script's directory.
    for (const match of html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)) {
      if (/^(?:https?:)?\/\//.test(match[1])) continue;
      const script = path.resolve(path.dirname(file), match[1].split('?')[0]);
      let source;
      try { source = await readFile(script, 'utf8'); } catch { continue; }
      for (const fetch of source.matchAll(/fetch\(\s*['"]([^'"]+)['"]/g)) await checkReference(file, fetch[1]);
    }
  }
  if (file.endsWith('.css')) {
    for (const match of (await readFile(file, 'utf8')).matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g)) await checkReference(file, match[1]);
  }
  if (file.endsWith('.js')) {
    for (const match of (await readFile(file, 'utf8')).matchAll(/from\s+['"](\.[^'"]+)['"]/g)) await checkReference(file, match[1]);
  }
}
for (const file of [...published, ...await files(path.join(root, 'scripts'))].filter(file => /\.(?:js|mjs)$/.test(file))) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) errors.push(result.stderr || result.error?.message || 'Syntax check failed: ' + file);
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('Published page links, assets, literal data fetches and JavaScript syntax passed.');
