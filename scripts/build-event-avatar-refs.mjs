import {copyFile, mkdir, readFile, readdir, unlink, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {juniorPublicName, publicAvatarReference} from './lib/public-entry-data.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const publicRoot = path.join(root, 'public');
const data = name => path.join(publicRoot, 'data', name);
const targetDirectory = path.join(publicRoot, 'assets', 'event-avatar-refs');
const classOrder = ['2-Wheel Drive Buggy', '4-Wheel Drive Buggy', 'Trucks', 'Vintage', 'Junior Racers', 'default'];

async function json(file, fallback = {}) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}

function classSlug(className) {
  return className.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function writeJson(file, value) {
  const output = JSON.stringify(value, null, 2) + '\n';
  const current = await readFile(file, 'utf8').catch(error => error.code === 'ENOENT' ? '' : Promise.reject(error));
  if (current !== output) await writeFile(file, output);
}

export async function buildEventAvatarReferences() {
  const avatars = await json(data('car-avatars.json'));
  const directory = await json(data('driver-directory.json'), {drivers:[]});
  await mkdir(targetDirectory, {recursive:true});
  const manifest = {};
  const retained = new Set();

  const candidates = new Map();
  const driverKeyByRef = new Map();
  for (const driver of directory.drivers || []) {
    if (!avatars[driver.k]) continue;
    driverKeyByRef.set(publicAvatarReference(driver.k), driver.k);
    const label = juniorPublicName(driver.n).toUpperCase();
    const values = candidates.get(label) || [];
    values.push(driver.k);
    candidates.set(label, values);
  }
  let repaired = 0;
  const usedRefs = new Set();
  for (const filename of ['next-event-entries.json', 'wix-current-event-entries.json']) {
    const file = data(filename), feed = await json(file, null);
    if (!feed) continue;
    for (const entry of feed.entries || []) {
      if (entry.className !== 'Junior Racers') continue;
      if (entry.avatarRef && !driverKeyByRef.has(entry.avatarRef)) delete entry.avatarRef;
      if (!entry.avatarRef) {
        const matches = candidates.get(String(entry.driverName || '').trim().toUpperCase()) || [];
        if (matches.length === 1) { entry.avatarRef = publicAvatarReference(matches[0]); repaired += 1; }
      }
      if (entry.avatarRef) usedRefs.add(entry.avatarRef);
    }
    await writeJson(file, feed);
  }

  for (const avatarRef of [...usedRefs].sort()) {
    const driverKey = driverKeyByRef.get(avatarRef);
    if (!driverKey) continue;
    const record = typeof avatars[driverKey] === 'string' ? {default:avatars[driverKey]} : avatars[driverKey] || {};
    for (const className of classOrder) {
      const sourcePath = record[className];
      if (typeof sourcePath !== 'string' || !/^assets\/car-avatars\/[A-Z0-9_-]+\.png$/.test(sourcePath)) continue;
      const source = path.join(publicRoot, 'assets', 'car-avatar-thumbnails', path.basename(sourcePath, '.png') + '.webp');
      const bytes = await readFile(source);
      const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
      const filename = `${avatarRef}-${classSlug(className)}-${digest}.webp`;
      await copyFile(source, path.join(targetDirectory, filename));
      retained.add(filename);
      manifest[avatarRef] ||= {};
      manifest[avatarRef][className] = `assets/event-avatar-refs/${filename}`;
    }
  }

  for (const filename of await readdir(targetDirectory)) {
    if (/^[0-9a-f]{20}-[a-z0-9-]+-[0-9a-f]{12}\.webp$/.test(filename) && !retained.has(filename)) await unlink(path.join(targetDirectory, filename));
  }
  await writeJson(data('event-avatar-refs.json'), manifest);
  console.log(`Prepared ${Object.keys(manifest).length} anonymous event-avatar references; repaired ${repaired} junior entry links.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildEventAvatarReferences();
