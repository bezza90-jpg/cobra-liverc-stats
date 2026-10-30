import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {addSiteShell} from './site-shell.mjs';
test('shared navigation supports repository and domain roots, preserving Wix booking and GPW links',()=>{
  for(const base of ['./','../','../../../','../../../../']) {
    const html=addSiteShell('<html><head></head><body><main>Race</main></body></html>',base);
    assert.equal(addSiteShell(html,base),html);
    assert.match(html,/https:\/\/www.cobracardiff.co.uk\/grand-prix-wales/);
    assert.match(html,/https:\/\/www.cobracardiff.co.uk\/event-list/);
    assert.match(html,/https:\/\/racehub.cobracardiff.co.uk\/privacy\//);
    for(const route of ['?tracker=1','schedule/?type=sword','virtual-race-replay/','virtual-race-replay/3d.html','track-gallery/','website-guides/','privacy/']) assert.ok(html.includes('href="'+base+route+'"'));
    assert.match(html,/2D Virtual Replay<\/a><a[^>]+>3D Virtual Replay<\/a>/);
    assert.equal((html.match(/class="cobra-site-header"/g)||[]).length,1);
  }
});
test('3D replay keeps the complete responsive site menu',()=>{
  const html=readFileSync(new URL('../public/virtual-race-replay/3d.html',import.meta.url),'utf8');
  assert.match(html,/class="cobra-mobile-menu"/);
  assert.match(html,/class="cobra-site-menu"/);
  assert.match(html,/data-cobra-shell rel="stylesheet" href="\.\.\/assets\/site-shell\.css\?v=8"/);
  assert.match(html,/data-cobra-shell type="module" src="\.\.\/assets\/site-shell\.js\?v=9"/);
  assert.match(html,/class="cobra-gpw-logo"/);
});

test('standalone fallback and booking pages carry the shared privacy footer',()=>{
  for(const relative of ['../public/404.html','../public/book-in/index.html']) {
    const html=readFileSync(new URL(relative,import.meta.url),'utf8');
    assert.match(html,/class="cobra-site-footer"/);
    assert.match(html,/Privacy &amp; cookies/);
  }
});

test('every published page has exactly the same single shared footer',()=>{
  const root=new URL('../public/',import.meta.url);
  const pages=[];
  const walk=directory=>{
    for(const entry of readdirSync(directory,{withFileTypes:true})){
      if(entry.isDirectory()&&entry.name==='source'&&directory.pathname.includes('/assets/cutout-studio/')) continue;
      const url=new URL(entry.name+(entry.isDirectory()?'/':''),directory);
      if(entry.isDirectory()) walk(url);
      else if(entry.name.endsWith('.html')) pages.push(url);
    }
  };
  walk(root);
  assert.ok(pages.length>20);
  for(const page of pages){
    const html=readFileSync(page,'utf8');
    assert.equal((html.match(/<footer\b/g)||[]).length,1,`${page.pathname} must contain one footer`);
    assert.equal((html.match(/data-cobra-shared-footer="1"/g)||[]).length,1,`${page.pathname} must use the shared footer`);
    for(const phrase of ['South Wales TQ HQ','BRCA.org Affiliated Club','Privacy &amp; cookies','Beryl Media Productions']) {
      assert.ok(html.includes(phrase),`${page.pathname} is missing ${phrase}`);
    }
  }
});

test('shared controls preserve their viewport position during partial rerenders',()=>{
  const source=readFileSync(new URL('../public/assets/site-shell.js',import.meta.url),'utf8');
  assert.match(source,/function initViewportStability/);
  assert.match(source,/root\.addEventListener\('click', event => preserve\(event\.target\), true\)/);
  assert.match(source,/event\.target\?\.matches\?\.\('select'\)/);
  assert.match(source,/window\.scrollBy\(\{ top: movement, behavior: 'auto' \}\)/);
  assert.match(source,/\.cobra-back-to-top,\[data-allow-scroll\]/);
});

test('shared shell prefetches only after deliberate hover in browsers with managed speculation',()=>{
  const source=readFileSync(new URL('../public/assets/site-shell.js',import.meta.url),'utf8');
  assert.match(source,/HTMLScriptElement\.supports\?\.\('speculationrules'\)/);
  assert.match(source,/rules\.type = 'speculationrules'/);
  assert.match(source,/eagerness: 'immediate'/);
  assert.match(source,/if \(!supportsSpeculationRules\) return/);
  assert.doesNotMatch(source,/rel = 'prefetch'/);
  assert.match(source,/connection\?\.saveData/);
  assert.match(source,/effectiveType/);
  assert.match(source,/url\.origin !== location\.origin/);
  assert.match(source,/setTimeout\(\(\) => prefetch\(event\.target\), 300\)/);
  assert.doesNotMatch(source,/addEventListener\('pointerdown'/);
  assert.doesNotMatch(source,/addEventListener\('focusin'/);
});

test('standalone pages use the shared Club Series hero branding',()=>{
  const css=readFileSync(new URL('../public/assets/site-shell.css',import.meta.url),'utf8');
  const news=readFileSync(new URL('../public/club-news/index.html',import.meta.url),'utf8');
  const replay2d=readFileSync(new URL('../public/virtual-race-replay/index.html',import.meta.url),'utf8');
  const replay3d=readFileSync(new URL('../public/virtual-race-replay/3d.html',import.meta.url),'utf8');
  assert.match(css,/\.cobra-branded-hero/);
  assert.match(css,/linear-gradient\(115deg,rgba\(4,11,7,\.98\) 0 44%/);
  assert.match(news,/news-hero cobra-branded-hero/);
  assert.match(replay2d,/<header class="cobra-branded-hero">/);
  assert.match(replay3d,/intro cobra-branded-hero/);
});

test('the Events menu ends with the track gallery',()=>{
  const html=addSiteShell('<html><head></head><body><main>Race</main></body></html>','./');
  const events=html.match(/<details class="cobra-menu-group"><summary>Events<\/summary><div>(.*?)<\/div><\/details>/s)?.[1]||'';
  assert.match(events,/Events &amp; booking/);
  assert.match(events,/Track gallery<\/a>$/);
});

test('mobile menu promotes both virtual replay views without removing grouped links',()=>{
  const html=addSiteShell('<html><head></head><body><main>Race</main></body></html>','../');
  const css=readFileSync(new URL('../public/assets/site-shell.css',import.meta.url),'utf8');
  assert.match(html,/class="cobra-mobile-replay-links"/);
  assert.match(html,/href="\.\.\/virtual-race-replay\/">▶ 2D Replay<\/a>/);
  assert.match(html,/href="\.\.\/virtual-race-replay\/3d\.html">◆ 3D Replay<\/a>/);
  assert.equal((html.match(/2D Virtual Replay<\/a>/g)||[]).length,2);
  assert.equal((html.match(/3D Virtual Replay<\/a>/g)||[]).length,2);
  assert.match(css,/\.cobra-mobile-replay-links\{display:grid/);
  assert.match(css,/max-height:calc\(100dvh - 70px\)/);
});


test('privacy page explains public driver data, junior safeguards, payments, retention and storage',()=>{
  const html=readFileSync(new URL('../public/privacy/index.html',import.meta.url),'utf8');
  for(const phrase of [
    'Privacy &amp; Cookie Policy',
    'first name and surname initial',
    'chassis and an approved car avatar',
    'PayPal processes payment',
    'Cloudflare Web Analytics',
    'localStorage',
    'sessionStorage',
    'How long we keep information',
    'Information Commissioner'
  ]) assert.ok(html.includes(phrase), 'Missing privacy notice text: '+phrase);
});
