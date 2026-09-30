// Explicit driver aliases managed in Site Manager. Raw results are retained.
const aliases = {"PAUL-CURTIS": {"driverKey": "BRUCE", "displayName": "BRUCE (PAUL CURTIS)", "profileName": "Bruce"}, "PAUL-BRUCE-CURTIS": {"driverKey": "BRUCE", "displayName": "BRUCE (PAUL CURTIS)", "profileName": "Bruce"}, "BOBTECH": {"driverKey": "BOBTECH", "displayName": "BobTech", "profileName": "BobTech"}, "BOB-GELSTHARP": {"driverKey": "BOBTECH", "displayName": "BobTech", "profileName": "BobTech"}};

export const canonicalDriverKey = key => aliases[key]?.driverKey || key;
const names = Object.fromEntries(Object.values(aliases).map(a => [a.driverKey,a.profileName || a.displayName]));
export const canonicalDriverName = (key,name) => names[canonicalDriverKey(key)] || name;
export function mergeDriverRows(rows, identity) {
 const result=[], merged=new Map();
 for(const row of rows){
  const key=canonicalDriverKey(row.driverKey);
  if(!names[key]){result.push(row);continue;}
  const canonical={...row,driverKey:key,driverName:canonicalDriverName(key,row.driverName)};
  const id=identity(canonical);
  if(!merged.has(id) || row.driverKey===key) merged.set(id,canonical);
 }
 return [...result,...merged.values()];
}
