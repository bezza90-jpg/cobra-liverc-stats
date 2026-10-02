// Explicit driver aliases managed in Site Manager. Raw results are retained.
const aliases = {"PAUL-CURTIS": {"driverKey": "BRUCE", "displayName": "BRUCE (PAUL CURTIS)", "profileName": "Bruce"}, "PAUL-BRUCE-CURTIS": {"driverKey": "BRUCE", "displayName": "BRUCE (PAUL CURTIS)", "profileName": "Bruce"}, "BOBTECH": {"driverKey": "BOBTECH", "displayName": "Bob \"Bobtech\" Gelstharp", "profileName": "Bob \"Bobtech\" Gelstharp"}, "BOB-GELSTHARP": {"driverKey": "BOBTECH", "displayName": "Bob \"Bobtech\" Gelstharp", "profileName": "Bob \"Bobtech\" Gelstharp"}, "BOB-BOBTECH-GELSTHARP": {"driverKey": "BOBTECH", "displayName": "Bob \"Bobtech\" Gelstharp", "profileName": "Bob \"Bobtech\" Gelstharp"}, "NATHAN-NOTLEY-NATHAN-NOTLEY": {"driverKey": "NATHAN-NOTLEY", "displayName": "NATHAN NOTLEY", "profileName": "Nathan Notley"}};

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
