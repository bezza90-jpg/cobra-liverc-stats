import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const appSource = await readFile(new URL('../public/grand-prix-wales/app.js', import.meta.url), 'utf8');

const makeElement = (value = '') => ({
  value,
  textContent: '',
  innerHTML: '',
  children: [],
  listeners: {},
  addEventListener(type, listener) { this.listeners[type] = listener; },
  querySelectorAll() { return []; },
  querySelector() { return null; },
  replaceChildren(...children) { this.children = children; this.value = children[0]?.value || ''; },
  append() {},
  setAttribute() {},
  removeAttribute() {},
  closest() { return null; }
});

test('public GPW entries can be filtered by chassis and country together', async () => {
  const elements = {
    '#entryClasses': makeElement(),
    '#entrySearch': makeElement(),
    '#entryCountry': makeElement(),
    '#entryChassis': makeElement(),
    '#entrySearchStatus': makeElement(),
    '#entryMessage': makeElement(),
    '#classCount': makeElement(),
    '#driverCount': makeElement()
  };
  const entries = [
    { name: 'Alice Driver', className: '2WD', country: 'United Kingdom', chassis: 'XRay' },
    { name: 'Bob Racer', className: '2WD', country: 'Ireland', chassis: 'XRay' },
    { name: 'Cara Pilot', className: '4WD', country: 'Norway', chassis: 'TLR' }
  ];
  const document = {
    body: { append() {} },
    querySelector(selector) { return elements[selector] || null; },
    querySelectorAll() { return []; },
    createElement() { return makeElement(); }
  };
  class Option {
    constructor(text, value) { this.text = text; this.value = value; }
  }
  const fetch = async url => ({
    ok: true,
    async json() {
      return String(url).includes('/api/public-entries') ? { publishedAt: '2026-11-12T12:00:00Z', entries } : {};
    }
  });
  const context = {
    console,
    document,
    fetch,
    Option,
    URL,
    Intl,
    location: { href: 'https://racehub.cobracardiff.co.uk/grand-prix-wales/' },
    window: { matchMedia: () => ({ matches: false }), innerWidth: 1200, innerHeight: 800 },
    setInterval() {}
  };
  vm.runInNewContext(appSource, context);
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.deepEqual(elements['#entryChassis'].children.map(option => option.text), ['All chassis', 'TLR', 'XRay']);
  assert.deepEqual(elements['#entryCountry'].children.map(option => option.text), ['All countries', 'Ireland', 'Norway', 'United Kingdom']);

  elements['#entryChassis'].value = 'xray';
  elements['#entryChassis'].listeners.change();
  assert.match(elements['#entryClasses'].innerHTML, /Alice Driver/);
  assert.match(elements['#entryClasses'].innerHTML, /Bob Racer/);
  assert.doesNotMatch(elements['#entryClasses'].innerHTML, /Cara Pilot/);

  elements['#entryCountry'].value = 'ie';
  elements['#entryCountry'].listeners.change();
  assert.doesNotMatch(elements['#entryClasses'].innerHTML, /Alice Driver/);
  assert.match(elements['#entryClasses'].innerHTML, /Bob Racer/);
  assert.equal(elements['#entrySearchStatus'].textContent, '1 matching class entry.');
});
