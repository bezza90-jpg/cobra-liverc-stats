export const validTransponder = value => /^[0-9]{7}$/.test(String(value)) && String(value)!=='1234567';
const key = row => `${String(row.driverName).trim().replace(/\s+/g,' ').toUpperCase()}|${row.className}`;
export function transponderHistory(entries, today = new Date().toISOString().slice(0,10)) {
  const latest = new Map();
  for (const row of entries.slice().sort((a,b)=>String(a.eventDate).localeCompare(String(b.eventDate)))) {
    if (!row.eventDate || row.eventDate>=today || !validTransponder(row.transponder)) continue;
    latest.set(key(row), {driverName:row.driverName,className:row.className,transponder:String(row.transponder),eventDate:row.eventDate});
  }
  return [...latest.values()];
}
export function usePreviousTransponders(entries, history) {
  const known = new Map(history.map(row=>[key(row),row.transponder]));
  return entries.map(row=>({...row,transponder:validTransponder(row.transponder)?row.transponder:known.get(key(row))||'',
    transponderSource:validTransponder(row.transponder)?'wix':known.get(key(row))?'history':'none'}));
}
