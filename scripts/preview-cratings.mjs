import {readFile,mkdir,writeFile} from 'node:fs/promises';
const data=JSON.parse(await readFile(new URL('../public/data/dashboard.json',import.meta.url),'utf8'));
const classes=['2-Wheel Drive Buggy','4-Wheel Drive Buggy','Vintage','Trucks','Junior Racers'];
const poolNames=['Legacy senior','Overall 2WD + 4WD',...classes];
const matches=(cls,pool)=>pool==='Legacy senior'?cls!=='Junior Racers':pool==='Overall 2WD + 4WD'?cls==='2-Wheel Drive Buggy'||cls==='4-Wheel Drive Buggy':cls===pool;
const lapSeconds=value=>{const str=String(value??'').trim(),clock=str.match(/^(\d+):(\d{2}(?:\.\d+)?)(?:\s|$)/);return clock?Number(clock[1])*60+Number(clock[2]):Number.parseFloat(str)};
const laps=run=>Number(String(run?.[3]||'').match(/^(\d+)\//)?.[1]||0);
const time=run=>{const s=String(run?.[3]||''),v=s.includes('/')?s.slice(s.indexOf('/')+1):s,m=v.match(/^(\d+):(\d+(?:\.\d+)?)/);return m?Number(m[1])*60+Number(m[2]):Number.parseFloat(v)||Infinity};
const ratings=pool=>{
 const summaries=new Map(data.drivers.map(d=>[d.k,{name:d.n,key:d.k,total:1500,starts:0}]));
 const byRace=new Map();
 for(const run of data.raceResults){const a=byRace.get(run[0])||[];a.push(run);byRace.set(run[0],a)}
 const races=Object.entries(data.raceById).sort(([idA,a],[idB,b])=>a.d.localeCompare(b.d)||String(a.e).localeCompare(String(b.e),'en',{numeric:true})||String(a.c).localeCompare(String(b.c),'en',{numeric:true})||Number(Boolean(a.f))-Number(Boolean(b.f))||String(a.r).localeCompare(String(b.r),'en',{numeric:true})||idA.localeCompare(idB,'en',{numeric:true}));
 const sessions=[],qualifying=new Map();
 for(const [id,race] of races){
  if(!race.d||race.d<'2022-01-01'||/^Practice\b/i.test(race.r||'')||!matches(race.c,pool))continue;
  const qual=/^Qualifier\s+Round\b/i.test(race.r||'');
  const sessionKey=qual?`${race.d}|${race.e}|${race.c}|${String(race.r).toLowerCase()}`:`race:${id}`;
  let session=qualifying.get(sessionKey);
  if(!session){session={race,qual,field:[]};qualifying.set(sessionKey,session);sessions.push(session)}
  session.field.push(...(byRace.get(id)||[]).filter(run=>Number(run[2])>0&&summaries.has(run[1])));
 }
 for(const {race,qual,field} of sessions){
  if(field.length<2)continue;
  const positions=new Map();
  if(qual)field.slice().sort((a,b)=>laps(b)-laps(a)||time(a)-time(b)||Number(a[2])-Number(b[2])||String(a[1]).localeCompare(String(b[1]))).forEach((r,i)=>positions.set(r,i+1));
  const position=r=>qual?positions.get(r):Number(r[2]);
  const before=new Map(field.map(r=>[r[1],summaries.get(r[1]).total]));
  const pace=new Map(field.filter(r=>laps(r)>=3).map(r=>[r[1],lapSeconds(r[5])]).filter(([,v])=>Number.isFinite(v)&&v>0));
  const k=48*(race.f?1.3:.7)*Math.min(1.5,Math.max(.75,Math.sqrt(field.length/6)));
  const updates=field.map(run=>{
   let actual=0,expected=0;
   for(const other of field){
    if(other===run)continue;
    const finish=position(run)<position(other)?1:position(run)===position(other)?.5:0;
    const a=pace.get(run[1]),b=pace.get(other[1]),lap=Number.isFinite(a)&&Number.isFinite(b)?(a<b?1:a===b?.5:0):finish;
    actual+=.85*finish+.15*lap;
    expected+=1/(1+10**((before.get(other[1])-before.get(run[1]))/400));
   }
   return{key:run[1],change:k*(actual-expected)/(field.length-1)};
  });
  for(const {key,change} of updates){const row=summaries.get(key);row.total=Math.max(100,row.total+change);row.starts++}
 }
 return new Map([...summaries].map(([key,r])=>[key,{...r,rating:1500+(r.total-1500)*(1-Math.exp(-r.starts/12))}]));
};
const results=Object.fromEntries(poolNames.map(p=>[p,ratings(p)]));
const rows=[...results['Legacy senior'].keys()].map(key=>{
 const legacy=results['Legacy senior'].get(key);
 const overall=results['Overall 2WD + 4WD'].get(key);
 const obj={driver:legacy.name,key,legacy:legacy.starts?Math.round(legacy.rating):null,overall:overall.starts?Math.round(overall.rating):null,overallStarts:overall.starts,legacyStarts:legacy.starts};
 for(const cls of classes){const v=results[cls].get(key);obj[cls]=v.starts?Math.round(v.rating):null;obj[cls+' starts']=v.starts}
 obj.change=obj.legacy!==null&&obj.overall!==null?obj.overall-obj.legacy:null;
 return obj;
}).filter(r=>r.legacyStarts||r.overallStarts||classes.some(c=>r[c+' starts'])).sort((a,b)=>(b.overall??-Infinity)-(a.overall??-Infinity));
await mkdir('crating-preview',{recursive:true});
const headers=Object.keys(rows[0]||{});
const quote=x=>'"'+String(x??'').replaceAll('"','""')+'"';
await writeFile('crating-preview/comparison.csv',headers.join(',')+'\n'+rows.map(r=>headers.map(h=>quote(r[h])).join(',')).join('\n')+'\n');
const active=rows.filter(r=>r.overall!==null);
const swings=rows.filter(r=>r.change!==null).sort((a,b)=>Math.abs(b.change)-Math.abs(a.change));
const summary={generatedAt:new Date().toISOString(),source:data.meta,pools:poolNames.map(p=>({name:p,drivers:[...results[p].values()].filter(r=>r.starts>0).length})),topOverall:active.slice(0,20).map(({driver,overall,legacy,change,overallStarts})=>({driver,overall,legacy,change,starts:overallStarts})),largestChanges:swings.slice(0,25).map(({driver,overall,legacy,change,overallStarts})=>({driver,overall,legacy,change,starts:overallStarts})),notes:['Unpublished simulation; existing site ratings remain unchanged','Overall = 2WD plus 4WD only; legacy = all senior classes','Same rating algorithm and confidence weighting as current RaceHub']};
await writeFile('crating-preview/summary.json',JSON.stringify(summary,null,2)+'\n');
console.log('UNPUBLISHED cRATING REVIEW SUMMARY');
console.log(JSON.stringify(summary,null,2));
