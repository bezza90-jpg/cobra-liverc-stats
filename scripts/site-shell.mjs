import { readFileSync } from 'node:fs';
import {clubConfig} from './club-config.mjs';
const menu = JSON.parse(readFileSync(new URL('../docs/wix-menu-reference.json', import.meta.url), 'utf8'));
const routes = {
  'current-event':'event/', 'club-schedule':'schedule/', 'sword-schedule':'schedule/?type=sword',
  'drivers-briefing':'briefing/', 'club-series-tables':'club/', 'sword-tables':'sword/',
  'Podium-Gallery':'podiums/', 'race-stats':'', 'virtual-race-replay':'virtual-race-replay/',
  'virtual-race-replay/3d.html':'virtual-race-replay/3d.html',
  'driver-car-avatars':'car-avatars/', 'driver-distance-tracker':'?tracker=1',
  'drivers-setups':'setups/', 'upload-car-avatar':'avatar-upload/', 'about-cobra':'about/',
  'club-news':'club-news/', 'track-gallery':'track-gallery/',
  'website-guides':'website-guides/'
};
const featureByRoute={
  'current-event':'currentEvent','club-schedule':'schedules','sword-schedule':'schedules','drivers-briefing':'briefing',
  'club-series-tables':'championships','sword-tables':'championships','Podium-Gallery':'podiums','race-stats':'results',
  'virtual-race-replay':'replays','virtual-race-replay/3d.html':'replays','driver-car-avatars':'avatars',
  'driver-distance-tracker':'distanceTracker','drivers-setups':'setups','upload-car-avatar':'avatars',
  'club-news':'clubNews','track-gallery':'trackGallery','website-guides':'guides'
};
const escape = value => value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const brandLabel = (value,config) => String(value || '').replaceAll('COBRA',config.shortName);
const analyticsMarkup = config => config.analytics?.cloudflareToken ? `<!-- Cloudflare Web Analytics --><script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${escape(config.analytics.cloudflareToken)}"}'></script><!-- End Cloudflare Web Analytics -->` : '';
const themeStyle = config => Object.entries(config.theme).map(([key,value])=>`--club-${key.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase())}:${value}`).join(';');
export function siteHeader(base = './',config=clubConfig) {
  const link = ({label,url}) => {
    const key = new URL(url).pathname.replace(/^\/|\/$/g,'');
    if (featureByRoute[key] && !config.features[featureByRoute[key]]) return '';
    let href = Object.hasOwn(routes,key) ? base + routes[key] : url;
    if (key==='') href=config.urls.home;
    else if (key==='event-list') href=config.urls.events;
    else if (key==='media') href=config.urls.media;
    else if (key==='contact') href=config.urls.contact;
    return `<a href="${escape(href)}">${escape(brandLabel(label,config))}</a>`;
  };
  const replayLinks = config.features.replays ? `<div class="cobra-mobile-replay-links" aria-label="Virtual race replays"><strong>Virtual race replay</strong><a href="${base}virtual-race-replay/">▶ 2D Replay</a><a href="${base}virtual-race-replay/3d.html">◆ 3D Replay</a></div>` : '';
  const groups=menu.map(group=>{
    if (group.label==='Home') return link(group.links[0]);
    const links=group.links.map(link).filter(Boolean).join('');
    return links ? `<details class="cobra-menu-group"><summary>${escape(brandLabel(group.label,config))}</summary><div>${links}</div></details>` : '';
  }).join('');
  const partner=config.features.grandPrixWales && config.logos.partner && config.logos.partnerUrl ? `<a class="cobra-gpw-logo" href="${escape(config.logos.partnerUrl)}"><img src="${base}${escape(config.logos.partner)}" width="99" height="59" alt="${escape(config.logos.partnerAlt || '')}" decoding="async"></a>` : '';
  return `<!-- cobra-shell:start --><header class="cobra-site-header" data-club-id="${escape(config.id)}" data-edition="${escape(config.edition)}" style="${themeStyle(config)}"><div class="cobra-header-inner"><a class="cobra-site-logo" href="${escape(config.urls.home)}" aria-label="${escape(config.shortName)} home"><img src="${base}${escape(config.logos.header)}" width="271" height="69" alt="${escape(config.logos.headerAlt)}" fetchpriority="high"></a><a class="cobra-book-in" href="${escape(config.urls.events)}">Book In</a><details class="cobra-mobile-menu"><summary aria-label="Open site menu">☰ <span>Menu</span></summary><nav class="cobra-site-menu" aria-label="Site">${replayLinks}${groups}</nav></details>${partner}</div></header><!-- cobra-shell:end -->`;
}
export function siteFooter(base = './',config=clubConfig) {
  const social=[['Facebook',config.social?.facebook],['YouTube',config.social?.youtube]].filter(([,url])=>url).map(([label,url])=>`<a href="${escape(url)}">${label}</a>`).join('');
  return `<!-- cobra-footer:start --><footer class="cobra-site-footer" style="${themeStyle(config)}"><a href="${escape(config.urls.home)}"><img src="${base}${escape(config.logos.footer)}" width="220" height="56" alt="${escape(config.shortName)} home" loading="lazy" decoding="async"></a><p>${escape(config.footer.strapline).replaceAll('\n','<br>')}</p><p>${escape(config.footer.description)}</p><nav aria-label="Footer"><a href="${base}website-guides/">Help &amp; Website Guides</a>${social}</nav><p>© ${new Date().getFullYear()} ${escape(config.shortName)}. ${escape(config.footer.credit)}. All rights reserved.</p></footer><!-- cobra-footer:end -->`;
}
export function addSiteShell(html, base='./',config=clubConfig) {
  html = html.replace(/<!-- cobra-shell:start -->[\s\S]*?<!-- cobra-shell:end -->/g,'')
    .replace(/<!-- cobra-footer:start -->[\s\S]*?<!-- cobra-footer:end -->/g,'')
    .replace(/<!-- Cloudflare Web Analytics -->[\s\S]*?<!-- End Cloudflare Web Analytics -->/g,'')
    .replace(/<link[^>]+data-cobra-shell[^>]*>/g,'').replace(/<script[^>]+data-cobra-shell[^>]*><\/script>/g,'');
  return html.replace('</head>',`<link data-cobra-shell rel="stylesheet" href="${base}assets/club-theme.css?v=1"><link data-cobra-shell rel="stylesheet" href="${base}assets/site-shell.css?v=6"><script data-cobra-shell type="module" src="${base}assets/site-shell.js?v=8" defer></script>${analyticsMarkup(config)}</head>`)
    .replace(/<body\b[^>]*>/,match=>match+siteHeader(base,config)).replace('</body>',siteFooter(base,config)+'</body>');
}
