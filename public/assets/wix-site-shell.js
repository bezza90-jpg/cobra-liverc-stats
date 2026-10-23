import {initSiteHeader,initBackToTop,initNavigationPrefetch} from './site-shell.js?v=6';

const markup="<!-- cobra-shell:start --><header class=\"cobra-site-header\"><div class=\"cobra-header-inner\"><a class=\"cobra-site-logo\" href=\"https://www.cobracardiff.co.uk/\" aria-label=\"COBRA home\"><img src=\"https://racehub.cobracardiff.co.uk/assets/cobra-header-logo.png\" width=\"271\" height=\"69\" alt=\"COBRA\" fetchpriority=\"high\"></a><a class=\"cobra-book-in\" href=\"https://racehub.cobracardiff.co.uk/book-in/\">Book In</a><details class=\"cobra-mobile-menu\"><summary aria-label=\"Open site menu\">☰ <span>Menu</span></summary><nav class=\"cobra-site-menu\" aria-label=\"Site\"><div class=\"cobra-mobile-replay-links\" aria-label=\"Virtual race replays\"><strong>Virtual race replay</strong><a href=\"https://racehub.cobracardiff.co.uk/virtual-race-replay/\">▶ 2D Replay</a><a href=\"https://racehub.cobracardiff.co.uk/virtual-race-replay/3d.html\">◆ 3D Replay</a></div><a href=\"https://www.cobracardiff.co.uk/\">Home</a><details class=\"cobra-menu-group\"><summary>Events</summary><div><a href=\"https://racehub.cobracardiff.co.uk/event/\">Current event</a><a href=\"https://www.cobracardiff.co.uk/event-list\">Events &amp; booking</a><a href=\"https://racehub.cobracardiff.co.uk/track-gallery/\">Track gallery</a></div></details><details class=\"cobra-menu-group\"><summary>Race Day</summary><div><a href=\"https://racehub.cobracardiff.co.uk/schedule/\">Club race schedule</a><a href=\"https://racehub.cobracardiff.co.uk/briefing/\">Drivers briefing</a><a href=\"https://racehub.cobracardiff.co.uk/schedule/?type=sword\">SWORD race schedule</a></div></details><details class=\"cobra-menu-group\"><summary>Results</summary><div><a href=\"https://racehub.cobracardiff.co.uk/club/\">Club Series</a><a href=\"https://racehub.cobracardiff.co.uk/sword/\">SWORD Championship</a><a href=\"https://racehub.cobracardiff.co.uk/podiums/\">Podium gallery</a><a href=\"https://racehub.cobracardiff.co.uk/\">Race statistics</a><a href=\"https://racehub.cobracardiff.co.uk/virtual-race-replay/\">2D Virtual Replay</a><a href=\"https://racehub.cobracardiff.co.uk/virtual-race-replay/3d.html\">3D Virtual Replay</a></div></details><details class=\"cobra-menu-group\"><summary>COBRA Data</summary><div><a href=\"https://racehub.cobracardiff.co.uk/car-avatars/\">Driver car avatars</a><a href=\"https://racehub.cobracardiff.co.uk/?tracker=1\">Driver distance tracker</a><a href=\"https://racehub.cobracardiff.co.uk/setups/\">Setups &amp; tips</a><a href=\"https://racehub.cobracardiff.co.uk/avatar-upload/\">Upload car avatar</a><a href=\"https://racehub.cobracardiff.co.uk/virtual-race-replay/\">2D Virtual Replay</a><a href=\"https://racehub.cobracardiff.co.uk/virtual-race-replay/3d.html\">3D Virtual Replay</a></div></details><details class=\"cobra-menu-group\"><summary>About COBRA</summary><div><a href=\"https://racehub.cobracardiff.co.uk/about/\">About &amp; location</a><a href=\"https://racehub.cobracardiff.co.uk/club-news/\">Club news</a><a href=\"https://www.cobracardiff.co.uk/media\">Media</a><a href=\"https://racehub.cobracardiff.co.uk/track-gallery/\">Track gallery</a><a href=\"https://racehub.cobracardiff.co.uk/website-guides/\">Help &amp; Website Guides</a></div></details></nav></details><a class=\"cobra-gpw-logo\" href=\"https://www.cobracardiff.co.uk/grand-prix-wales\"><img src=\"https://racehub.cobracardiff.co.uk/assets/gpw-logo.webp\" width=\"99\" height=\"59\" alt=\"Grand Prix of Wales event logo\" decoding=\"async\"></a></div></header><!-- cobra-shell:end -->";
const stylesheet=new URL('./site-shell.css?v=6',import.meta.url).href;

if(!document.querySelector('link[data-cobra-wix-shell]')){
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href=stylesheet;
  link.dataset.cobraWixShell='';
  document.head.append(link);
}

const install=()=>{
  if(document.querySelector('.cobra-site-header')) return;
  const original=document.querySelector('header:not([data-cobra-original-header])');
  if(!original) return;
  const template=document.createElement('template');
  template.innerHTML=markup;
  const replacement=template.content.querySelector('.cobra-site-header');
  replacement.style.gridArea=getComputedStyle(original).gridArea;
  original.before(replacement);
  original.setAttribute('data-cobra-original-header','');
  original.style.setProperty('display','none','important');
  initSiteHeader(replacement);
  initBackToTop();
  initNavigationPrefetch();
};

new MutationObserver(install).observe(document.documentElement,{subtree:true,childList:true});
install();
