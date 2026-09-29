const names = new Intl.Collator('en-GB', {sensitivity: 'base', numeric: true});
function parts(value) {
  const name = String(value || '').replace(/\([^)]*\)/g, '').trim().replace(/\s+/g, ' ');
  return {full: name, surname: name.split(' ').at(-1) || ''};
}
export function compareEntryNames(a, b) {
  const left = parts(a.driverName), right = parts(b.driverName);
  return names.compare(left.surname, right.surname) || names.compare(left.full, right.full)
    || names.compare(String(a.driverKey || ''), String(b.driverKey || ''));
}
