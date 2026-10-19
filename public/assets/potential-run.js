// Estimate a timed run using the opening start-to-loop crossing plus the seven quickest complete laps.
export function potentialRun(driver, durationSeconds) {
  const recorded=(driver?.laps||[]).filter(l=>Number.isInteger(l.lap)&&Number.isFinite(l.seconds)&&l.seconds>0);
  const opening=recorded.find(l=>l.lap===1);
  const fullLaps=recorded.filter(l=>l.lap>1);
  if(!opening||fullLaps.length<7||!Number.isFinite(durationSeconds)||durationSeconds<=0)return '—';
  const average=fullLaps.map(l=>l.seconds).sort((a,b)=>a-b).slice(0,7).reduce((sum,time)=>sum+time,0)/7;
  // LiveRC counts the start-to-loop crossing as Lap 1. The race then finishes
  // on the first projected full lap completed at or after the time limit.
  const projectedFullLaps=Math.max(0,Math.ceil((durationSeconds-opening.seconds)/average-1e-10));
  const count=1+projectedFullLaps;
  const milliseconds=Math.round((opening.seconds+projectedFullLaps*average)*1000);
  const minutes=Math.floor(milliseconds/60000);
  const seconds=((milliseconds%60000)/1000).toFixed(3).padStart(6,'0');
  return `${count}/${minutes}:${seconds}`;
}
