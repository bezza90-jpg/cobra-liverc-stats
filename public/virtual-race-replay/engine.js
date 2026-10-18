export function prepare(driver){let sum=0;const crossings=[0,...driver.laps.map(l=>sum+=l.seconds)];const normal=driver.laps.slice(1).map(l=>l.seconds).sort((a,b)=>a-b);return{...driver,crossings,total:sum,typical:normal[Math.floor(normal.length/2)]||sum};}
export function positionAt(driver,time){const c=driver.crossings,t=Math.max(0,time);if(t>=driver.total)return{progress:driver.laps.length,completed:driver.laps.length,lap:driver.laps.length,finished:true,lapTime:driver.laps.at(-1).seconds};let index=0;while(index+1<c.length&&c[index+1]<=t)index++;const span=c[index+1]-c[index];return{progress:index+(t-c[index])/span,completed:index,lap:index+1,finished:false,lapTime:span};}
export function ordered(drivers,time){return drivers.map(d=>({driver:d,...positionAt(d,time)})).sort((a,b)=>b.progress-a.progress||a.driver.finalPosition-b.driver.finalPosition);}
export function finishFraction(driver,drivers,spacing=.006){const order=[...drivers].sort((a,b)=>a.finalPosition-b.finalPosition||a.number-b.number),slot=order.findIndex(item=>item.id===driver.id);return Math.max(1,order.length-slot)*spacing%1;}
export function timeAtProgress(driver,progress){if(progress>driver.laps.length)return null;const i=Math.floor(progress);return i>=driver.laps.length?driver.total:driver.crossings[i]+(progress-i)*(driver.crossings[i+1]-driver.crossings[i]);}
export function raceTimeAtPosition(position){const driver=position.driver,completed=Math.min(position.completed,driver.laps.length);return position.finished?(Number.isFinite(Number(driver.officialTime))?Number(driver.officialTime):driver.total):(driver.crossings[completed]||0);}
export function raceTimingAtPosition(position){const completed=position.finished?position.driver.laps.length:Math.min(position.completed,position.driver.laps.length);return`${completed} / ${raceTimeAtPosition(position).toFixed(2)}`;}
export function lapPerformanceAtPosition(position){const delta=position.lapTime-position.driver.typical,slow=!position.finished&&position.lap>1&&position.lapTime>position.driver.typical*1.1;return{lapTime:`${position.lapTime.toFixed(3)}s`,comparison:position.lap===1&&!position.finished?'Opening lap':`${delta>=0?'+':''}${delta.toFixed(2)}s${slow?' · slower lap':''}`,slow};}

// Finals approach the first crossing from their grid. Heat runs share a
// simultaneous loop start and use each driver's recorded elapsed lap times.
export function visualFraction(driver,time,pace){
 const opening=driver.laps[0].seconds,t=Math.max(0,time);
 if(t<opening&&Number.isFinite(driver.startFraction)){
  const start=pace.timeAtDistance(driver.startFraction);
  const u=t/opening,ramp=Math.min(.12,1/opening);
  const moving=(u<ramp?u*u/(2*ramp):u-ramp/2)/(1-ramp/2);
  return pace(start+(1-start)*moving);
 }
 return pace(positionAt(driver,t).progress%1);
}
