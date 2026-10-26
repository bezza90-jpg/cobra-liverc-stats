import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const roots = [
  {directory:fileURLToPath(new URL('../public/data/', import.meta.url)), label:'public/data'},
  {directory:fileURLToPath(new URL('../data/raw/', import.meta.url)), label:'data/raw'},
];
const reportOnly = process.argv.includes('--report-only');
const restricted = new Set([
  'address', 'birthdate', 'cardnumber', 'dateofbirth', 'dob', 'email', 'ipaddress',
  'paymentdetails', 'phone', 'postcode', 'securitycode', 'telephone', 'token',
  'transponder',
]);

function normalise(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function jsonFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return jsonFiles(target);
    return entry.name.endsWith('.json') ? [target] : [];
  }))).flat();
}

function collectRestrictedKeys(value, result = new Map(), location = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectRestrictedKeys(item, result, `${location}[${index}]`));
    return result;
  }
  if (!value || typeof value !== 'object') return result;
  for (const [key, child] of Object.entries(value)) {
    const normalised = normalise(key);
    if (restricted.has(normalised)) {
      const record = result.get(key) || { count: 0, firstLocation: `${location}.${key}` };
      record.count += 1;
      result.set(key, record);
    }
    collectRestrictedKeys(child, result, `${location}.${key}`);
  }
  return result;
}

const findings = [];
for (const {directory,label} of roots) for (const file of await jsonFiles(directory)) {
  let data;
  try {
    data = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    findings.push({ file, label, directory, parseError: error.message });
    continue;
  }
  const keys = collectRestrictedKeys(data);
  if (keys.size) findings.push({ file, label, directory, keys });
}

if (!findings.length) {
  console.log('Repository privacy audit passed: no restricted field names were found in public or imported data.');
  process.exit(0);
}

console.error('Public-data privacy audit found fields requiring review. Values are intentionally not printed.');
for (const finding of findings) {
  const relative = `${finding.label}/${path.relative(finding.directory, finding.file).replaceAll('\\', '/')}`;
  if (finding.parseError) {
    console.error(`- ${relative}: invalid JSON (${finding.parseError})`);
    continue;
  }
  const summary = [...finding.keys.entries()]
    .map(([key, detail]) => `${key} (${detail.count}, first at ${detail.firstLocation})`)
    .join('; ');
  console.error(`- ${relative}: ${summary}`);
}

console.error('Move private operational fields behind authenticated access or document and approve a necessary public exception before deployment.');
if (!reportOnly) process.exitCode = 1;
