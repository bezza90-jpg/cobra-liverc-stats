import test from 'node:test';
import assert from 'node:assert/strict';
import {addSiteShell} from './site-shell.mjs';
test('shared navigation supports repository and domain roots, preserving Wix booking and GPW links',()=>{
  for(const base of ['./','../','../../../','../../../../']) {
    const html=addSiteShell('<html><head></head><body><main>Race</main></body></html>',base);
    assert.equal(addSiteShell(html,base),html);
    assert.match(html,/https:\/\/www.cobracardiff.co.uk\/grand-prix-wales/);
    assert.match(html,/https:\/\/www.cobracardiff.co.uk\/event-list/);
    for(const route of ['?tracker=1','schedule/?type=sword','virtual-race-replay/','website-guides/']) assert.ok(html.includes('href="'+base+route+'"'));
    assert.equal((html.match(/class="cobra-site-header"/g)||[]).length,1);
  }
});
