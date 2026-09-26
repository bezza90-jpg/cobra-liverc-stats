import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const pages = ['', 'sword/', 'club/', 'podiums/', 'setups/', 'event/', 'about/', 'briefing/', 'schedule/', 'avatar-upload/'];
const links = [
  ['', 'Race Stats'], ['sword/', 'SWORD Championship'], ['club/', 'Club Series'],
  ['podiums/', 'Podium Gallery'], ['setups/', 'Setups & Tips'], ['https://www.cobracardiff.co.uk/event-list', 'Events'], ['event/', 'Current Event'],
  ['about/', 'About & location'], ['briefing/', 'Drivers Briefing'],
  ['?tracker=1', 'Driver Distance Tracker', 'tracker-nav-button'],
  ['avatar-upload/', 'Upload car avatar', 'avatar-nav-button']
];
const check = process.argv.includes('--check');
for (const page of pages) {
  const file = fileURLToPath(new URL('../public/' + page + 'index.html', import.meta.url));
  const html = await readFile(file, 'utf8');
  const base = page ? '../' : './';
  const anchors = links.map(([target, label, cls]) => '<a href="' + (target.startsWith('https://') ? target : base + target) + '"' + (target.startsWith('https://') ? ' target="_top"' : '') + (cls ? ' class="' + cls + '"' : '') + (target === page ? ' aria-current="page"' : '') + '>' + label.replace('&', '&amp;') + '</a>').join('');
  const nav = '<nav class="results-nav"' + (page ? '' : ' id="resultsNavigation"') + ' aria-label="COBRA pages">' + anchors + '</nav>';
  const existing = /<nav class="results-nav"[^>]*>[\s\S]*?<\/nav>/;
  const updated = existing.test(html) ? html.replace(existing, nav) : html.replace('<div class="hero-copy">', nav + '\n    <div class="hero-copy">');
  if (updated === html) continue;
  if (check) throw new Error('Navigation is out of date in ' + page + 'index.html; run npm run build:navigation.');
  await writeFile(file, updated);
}
console.log('Navigation ' + (check ? 'checked.' : 'built.'));
