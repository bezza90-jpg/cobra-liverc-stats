import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {addSiteShell} from './site-shell.mjs';
test('shared navigation supports repository and domain roots, preserving Wix booking and GPW links',()=>{
  for(const base of ['./','../','../../../','../../../../']) {
    const html=addSiteShell('<html><head></head><body><main>Race</main></body></html>',base);
    assert.equal(addSiteShell(html,base),html);
    assert.match(html,/https:\/\/www.cobracardiff.co.uk\/grand-prix-wales/);
    assert.match(html,/https:\/\/www.cobracardiff.co.uk\/event-list/);
    for(const route of ['?tracker=1','schedule/?type=sword','virtual-race-replay/','virtual-race-replay/3d.html','track-gallery/','website-guides/']) assert.ok(html.includes('href="'+base+route+'"'));
    assert.match(html,/2D Virtual Replay<\/a><a[^>]+>3D Virtual Replay<\/a>/);
    assert.equal((html.match(/class="cobra-site-header"/g)||[]).length,1);
  }
});
test('3D replay keeps the complete responsive site menu',()=>{
  const html=readFileSync(new URL('../public/virtual-race-replay/3d.html',import.meta.url),'utf8');
  assert.match(html,/class="cobra-mobile-menu"/);
  assert.match(html,/class="cobra-site-menu"/);
  assert.match(html,/data-cobra-shell type="module" src="\.\.\/assets\/site-shell\.js\?v=4"/);
  assert.match(html,/class="cobra-gpw-logo"/);
});
