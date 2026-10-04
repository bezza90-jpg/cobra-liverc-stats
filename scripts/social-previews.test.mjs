import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root=new URL('../public/',import.meta.url);
for(const route of ['','podiums','sword','club','about','briefing','car-avatars','setups','schedule','website-guides','avatar-upload','club-news']){
 test(`${route||'statistics'} has one explicit page screenshot preview`,()=>{
  const folder=route?route+'/':'';const html=readFileSync(new URL(folder+'index.html',root),'utf8');
  const matches=[...html.matchAll(/<meta property="og:image" content="([^"]+)"/g)];assert.equal(matches.length,1);
  assert.equal(matches[0][1],`https://racehub.cobracardiff.co.uk/${folder}page-preview-20261004.png`);
  assert.match(html,/<meta name="twitter:card" content="summary_large_image">/);
  const image=new URL(folder+'page-preview-20261004.png',root);assert(existsSync(image));
  const bytes=readFileSync(image);assert.equal(bytes.readUInt32BE(16),1200);assert.equal(bytes.readUInt32BE(20),630);
 });
}
