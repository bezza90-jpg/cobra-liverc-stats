import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadClubConfig,publicClubConfig,validateClubConfig} from './club-config.mjs';
import {siteHeader,siteFooter} from './site-shell.mjs';

test('COBRA remains the safe default club profile',()=>{
  const config=loadClubConfig();
  assert.equal(config.id,'cobra-cardiff');
  assert.equal(config.shortName,'COBRA');
  assert.equal(config.urls.events,'https://www.cobracardiff.co.uk/event-list');
  assert.deepEqual(config.wix.ticketTypes['2WD Entry'],['2-Wheel Drive Buggy','2WD Transponder Number','2WD Chassis']);
});

test('a standalone club profile drives branding, links and optional partner logo',()=>{
  const config=JSON.parse(readFileSync(new URL('../config/clubs/example-club.json',import.meta.url),'utf8'));
  assert.doesNotThrow(()=>validateClubConfig(config));
  assert.equal(publicClubConfig(config).wix,undefined);
  assert.match(siteHeader('./',config),/data-club-id="example-rc-club"/);
  assert.match(siteHeader('./',config),/href="https:\/\/www\.example-rc-club\.co\.uk\/event-list">Book In/);
  assert.match(siteHeader('./',config),/>EXAMPLE Data</);
  assert.doesNotMatch(siteHeader('./',config),/cobra-gpw-logo/);
  assert.match(siteFooter('./',config),/Managed RaceHub service/);
});

test('club profiles reject unsafe or incomplete Wix mappings',()=>{
  const config=structuredClone(loadClubConfig());
  config.wix.ticketTypes['Broken']=['2-Wheel Drive Buggy'];
  assert.throws(()=>validateClubConfig(config),/must define class, transponder field and chassis field/);
});

test('basic edition exposes booking and results without premium navigation',()=>{
  const config=loadClubConfig(new URL('../config/clubs/basic-club.json',import.meta.url));
  const html=siteHeader('./',config);
  assert.match(html,/Book In/);
  assert.match(html,/Race statistics/);
  for (const premium of ['SWORD Championship','Podium gallery','Virtual Race Replay','Driver car avatars','Setups &amp; tips']) assert.doesNotMatch(html,new RegExp(premium));
  assert.match(html,/data-edition="basic"/);
});
