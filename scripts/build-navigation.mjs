import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { addSiteShell } from './site-shell.mjs';
const pages = ['', 'sword/', 'club/', 'podiums/', 'setups/', 'event/', 'about/', 'briefing/', 'schedule/', 'avatar-upload/', 'car-avatars/', 'club-news/', 'virtual-race-replay/', 'website-guides/'];
const links = [
  ['', 'Race Stats'], ['sword/', 'SWORD Championship'], ['club/', 'Club Series'],
  ['podiums/', 'Podium Gallery'], ['setups/', 'Setups & Tips'], ['https://www.cobracardiff.co.uk/event-list', 'Events'], ['event/', 'Current Event'],
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
  const base = page ? '../' : './';
  const anchors = links.map(([target, label, cls]) => '<a href="' + (target.startsWith('https://') ? target : base + target) + '"' + (target.startsWith('https://') || target === 'website-guides/' ? ' target="_top"' : '') + (cls ? ' class="' + cls + '"' : '') + (target === page ? ' aria-current="page"' : '') + '>' + label.replace('&', '&amp;') + '</a>').join('');
  const nav = '<nav class="results-nav"' + (page ? '' : ' id="resultsNavigation"') + ' aria-label="COBRA pages">' + anchors + '</nav>';
  const existing = /<nav class="results-nav"[^>]*>[\s\S]*?<\/nav>/;
  let updated = existing.test(html) ? html.replace(existing, nav) : html.replace('<div class="hero-copy">', nav + '\n    <div class="hero-copy">');
  // Wix hides duplicate header navigation. Keep the guide reachable in its visible footer.
  if (page !== 'website-guides/' && updated.includes('</footer>') && !updated.includes('class="website-guides-link"')) {
    updated = updated.replace('</footer>', '<a class="website-guides-link" href="' + base + 'website-guides/" target="_top">Website guides &amp; videos ↗</a></footer>');
  }
  updated = addSiteShell(updated, base);
  if (updated === html) continue;
  if (check) throw new Error('Navigation is out of date in ' + page + 'index.html; run npm run build:navigation.');
  await writeFile(file, updated);
}
console.log('Navigation ' + (check ? 'checked.' : 'built.'));
