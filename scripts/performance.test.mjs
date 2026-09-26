import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const read = relative => readFile(new URL('../' + relative, import.meta.url), 'utf8');

test('smaller championship data preserves standings for every season and class', async () => {
  const full = JSON.parse(await read('public/data/dashboard.json'));
  const slim = JSON.parse(await read('public/data/championship-results.json'));
  const configs = JSON.parse(await read('public/data/championships.json'));
  const source = (await read('public/assets/championship.js')).replace(/init\(\);\s*$/, '');
  const calculate = data => {
    const context = vm.createContext({ data, configs, Intl, URL });
    return vm.runInContext(source + `
      state.data = data;
      data.driverByKey = Object.fromEntries(data.drivers.map(driver => [driver.k, driver.n]));
      const snapshots = [];
      for (const config of Object.values(configs)) {
        state.config = config;
        for (const season of availableSeasons()) {
          state.activeSeason = season;
          for (const cls of config.classes) {
            const events = championshipEvents(cls);
            snapshots.push([config.title, season, cls, calculateStandings(cls, events).map(row => ({...row, countedIds: [...row.countedIds]}))]);
          }
        }
      }
      JSON.stringify(snapshots);
    `, context);
  };
  for (const key of ['meta', 'events', 'drivers', 'eventResults']) assert.deepEqual(slim[key], full[key]);
  const fullBytes = Buffer.byteLength(JSON.stringify(full));
  const slimBytes = Buffer.byteLength(JSON.stringify(slim));
  assert.ok(slimBytes < fullBytes / 2);
  assert.equal(calculate(slim), calculate(full));
  console.log('Championship payload: ' + fullBytes + ' -> ' + slimBytes + ' bytes (' + (100 * (1 - slimBytes / fullBytes)).toFixed(1) + '% smaller).');
});

async function loader() {
  const nodes = [];
  const context = vm.createContext({
    window: {}, setTimeout, clearTimeout,
    document: { createElement: tag => ({ tag, remove() { this.removed = true; } }), head: { append(...items) { nodes.push(...items); } } }
  });
  vm.runInContext((await read('public/assets/load-map.js')).replace('export function', 'function'), context);
  return { context, nodes, load: () => vm.runInContext('loadMap()', context) };
}
test('map waits for both assets, shares concurrent requests and reuses loaded assets', async () => {
  const { context, nodes, load } = await loader();
  assert.equal(nodes.length, 0);
  const pending = load();
  assert.equal(load(), pending);
  assert.equal(nodes.length, 2);
  let complete = false;
  pending.then(() => { complete = true; });
  context.window.L = {};
  nodes[1].onload();
  await Promise.resolve();
  assert.equal(complete, false);
  nodes[0].onload();
  assert.equal(await pending, context.window.L);
  assert.equal(load(), pending);
  assert.equal(nodes.length, 2);
});
test('failed map request can be retried', async () => {
  const { context, nodes, load } = await loader();
  const failed = load();
  nodes[1].onerror();
  await assert.rejects(failed, /could not be loaded/);
  assert.ok(nodes.slice(0, 2).every(node => node.removed));
  const retry = load();
  context.window.L = {};
  nodes[2].onload();
  nodes[3].onload();
  await retry;
});
