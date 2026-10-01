import { readFileSync } from 'node:fs';
const menu = JSON.parse(readFileSync(new URL('../docs/wix-menu-reference.json', import.meta.url), 'utf8'));
const routes = {
  'current-event':'event/', 'club-schedule':'schedule/', 'sword-schedule':'schedule/?type=sword',
  'drivers-briefing':'briefing/', 'club-series-tables':'club/', 'sword-tables':'sword/',
  'Podium-Gallery':'podiums/', 'race-stats':'', 'virtual-race-replay':'virtual-race-replay/',
  'driver-car-avatars':'car-avatars/', 'driver-distance-tracker':'?tracker=1',
  'drivers-setups':'setups/', 'upload-car-avatar':'avatar-upload/', 'about-cobra':'about/',
  'club-news':'club-news/',
  'website-guides':'website-guides/'
};
const escape = value => value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const analytics = `<!-- Cloudflare Web Analytics --><script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"8bd96a91178344ddb3c5078533d44dde"}'></script><!-- End Cloudflare Web Analytics -->`;
export function siteHeader(base = './') {
  const link = ({label,url}) => {
    const key = new URL(url).pathname.replace(/^\/|\/$/g,'');
    const href = Object.hasOwn(routes,key) ? base + routes[key] : url;
    return `<a href="${escape(href)}">${escape(label)}</a>`;
  };
  return `<!-- cobra-shell:start --><header class="cobra-site-header"><div class="cobra-header-inner"><a class="cobra-site-logo" href="https://www.cobracardiff.co.uk/" aria-label="COBRA home"><img src="${base}assets/cobra-header-logo.png" width="271" height="69" alt="COBRA" fetchpriority="high"></a><a class="cobra-book-in" href="${base}book-in/">Book In</a><details class="cobra-mobile-menu"><summary aria-label="Open site menu">☰ <span>Menu</span></summary><nav class="cobra-site-menu" aria-label="Site">${menu.map(group => group.label==='Home' ? link(group.links[0]) : `<details class="cobra-menu-group"><summary>${escape(group.label)}</summary><div>${group.links.map(link).join('')}</div></details>`).join('')}</nav></details><a class="cobra-gpw-logo" href="https://www.cobracardiff.co.uk/grand-prix-wales"><img src="${base}assets/gpw-logo.webp" width="99" height="59" alt="Grand Prix of Wales event logo"></a></div></header><!-- cobra-shell:end -->`;
}
export function siteFooter(base = './') {
  return `<!-- cobra-footer:start --><footer class="cobra-site-footer"><a href="https://www.cobracardiff.co.uk/"><img src="${base}assets/cobra-header-logo.png" width="220" height="56" alt="COBRA home"></a><p>South Wales TQ HQ<br>BRCA.org Affiliated Club</p><p>Off Road Buggy Racing Club • South Wales</p><nav aria-label="Footer"><a href="${base}website-guides/">Help &amp; Website Guides</a><a href="https://www.facebook.com/groups/cobracardiff">Facebook</a><a href="https://www.youtube.com/@Bezza90">YouTube</a></nav><p>© ${new Date().getFullYear()} COBRA. Beryl Media Productions. All rights reserved.</p></footer><!-- cobra-footer:end -->`;
}
export function addSiteShell(html, base='./') {
  html = html.replace(/<!-- cobra-shell:start -->[\s\S]*?<!-- cobra-shell:end -->/g,'')
    .replace(/<!-- cobra-footer:start -->[\s\S]*?<!-- cobra-footer:end -->/g,'')
    .replace(/<!-- Cloudflare Web Analytics -->[\s\S]*?<!-- End Cloudflare Web Analytics -->/g,'')
    .replace(/<link[^>]+data-cobra-shell[^>]*>/g,'').replace(/<script[^>]+data-cobra-shell[^>]*><\/script>/g,'');
  return html.replace('</head>',`<link data-cobra-shell rel="stylesheet" href="${base}assets/site-shell.css?v=3"><script data-cobra-shell type="module" src="${base}assets/site-shell.js?v=3" defer></script>${analytics}</head>`)
    .replace(/<body\b[^>]*>/,match=>match+siteHeader(base)).replace('</body>',siteFooter(base)+'</body>');
}
