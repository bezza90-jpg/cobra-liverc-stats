// Explicitly confirmed identities. Raw LiveRC records remain unchanged.
const aliases = {'PAUL-CURTIS':'BRUCE','PAUL-BRUCE-CURTIS':'BRUCE'};
export const canonicalDriverKey = key => aliases[key] || key;
export const canonicalDriverName = (key,name) => canonicalDriverKey(key)==='BRUCE' ? 'Bruce' : name;
export function mergeDriverRows(rows, identity) {
 const result=[], bruce=new Map();
 for(const row of rows){
  const key=canonicalDriverKey(row.driverKey);
  if(key!=='BRUCE'){result.push(row);continue;}
  const canonical={...row,driverKey:key,driverName:'Bruce'};
  const id=identity(canonical);
  if(!bruce.has(id) || row.driverKey==='BRUCE') bruce.set(id,canonical);
 }
 return [...result,...bruce.values()];
}
