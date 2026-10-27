import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { addSiteShell } from './site-shell.mjs';
const shellOnlyPages = ['grand-prix-wales/', 'grand-prix-wales/event-guide/', 'grand-prix-wales/announcements/', 'grand-prix-wales/venue/', 'grand-prix-wales/race-centre/', 'grand-prix-wales/driver-finder/'];
const pages = ['', 'book-in/', 'sword/', 'club/', 'podiums/', 'track-gallery/', 'setups/', 'event/', 'about/', 'briefing/', 'schedule/', 'avatar-upload/', 'car-avatars/', 'club-news/', 'lap-charts/', 'virtual-race-replay/', 'website-guides/', 'privacy/', ...shellOnlyPages];
const links = [
  ['', 'Race Stats'], ['sword/', 'SWORD Championship'], ['club/', 'Club Series'],
  ['podiums/', 'Podium Gallery'], ['track-gallery/', 'Track Gallery'], ['setups/', 'Setups & Tips'], ['https://www.cobracardiff.co.uk/event-list', 'Events'], ['event/', 'Current Event'],
  ['about/', 'About & location'], ['website-guides/', 'Website guides & videos'], ['briefing/', 'Drivers Briefing'],
  ['?tracker=1', 'Driver Distance Tracker', 'tracker-nav-button'],
  ['car-avatars/', 'Driver car avatars'],
  ['virtual-race-replay/', 'New: Virtual Race Replay', 'replay-nav-button'],
  ['avatar-upload/', 'Upload car avatar', 'avatar-nav-button']
];
const check = process.argv.includes('--check');
for (const page of pages) {
  const file = fileURLToPath(new URL('../public/' + page + 'index.html', import.meta.url));
  const html = await readFile(file, 'utf8');
  const depth = page.split('/').filter(Boolean).length;
  const base = depth ? '../'.repeat(depth) : './';
  const anchors = links.map(([target, label, cls]) => '<a href="' + (target.startsWith('https://') ? target : base + target) + '"' + (target.startsWith('https://') || target === 'website-guides/' ? ' target="_top"' : '') + (cls ? ' class="' + cls + '"' : '') + (target === page ? ' aria-current="page"' : '') + '>' + label.replace('&', '&amp;') + '</a>').join('');
  const nav = '<nav class="results-nav"' + (page ? '' : ' id="resultsNavigation"') + ' aria-label="COBRA pages">' + anchors + '</nav>';
  const existing = /<nav class="results-nav"[^>]*>[\s\S]*?<\/nav>/;
  let updated = shellOnlyPages.includes(page) ? html : existing.test(html) ? html.replace(existing, nav) : html.replace('<div class="hero-copy">', nav + '\n    <div class="hero-copy">');
  // Wix hides duplicate header navigation. Keep the guide reachable in its visible footer.
  if (page !== 'website-guides/' && updated.includes('</footer>') && !updated.includes('class="website-guides-link"')) {
    updated = updated.replace('</footer>', '<a class="website-guides-link" href="' + base + 'website-guides/" target="_top">Website guides &amp; videos ↗</a></footer>');
  }
  updated = addSiteShell(updated, base);
  if (updated === html) continue;
  if (check) throw new Error('Navigation is out of date in ' + page + 'index.html; run npm run build:navigation.');
  await writeFile(file, updated);
}
for (const relative of ['virtual-race-replay/3d.html']) {
  const file = fileURLToPath(new URL('../public/' + relative, import.meta.url));
  const html = await readFile(file, 'utf8');
  const updated = addSiteShell(html, '../');
  if (updated === html) continue;
  if (check) throw new Error('Navigation is out of date in ' + relative + '; run npm run build:navigation.');
  await writeFile(file, updated);
}
for (const relative of ['404.html']) {
  const file = fileURLToPath(new URL('../public/' + relative, import.meta.url));
  const html = await readFile(file, 'utf8');
  const updated = addSiteShell(html, './');
  if (updated === html) continue;
  if (check) throw new Error('Navigation is out of date in ' + relative + '; run npm run build:navigation.');
  await writeFile(file, updated);
}
console.log('Navigation ' + (check ? 'checked.' : 'built.'));
