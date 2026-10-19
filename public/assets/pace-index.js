export const MIN_PACE_LAPS = 5;
export const MIN_RANKED_PACE_ROUNDS = 5;

function lapSeconds(value) {
  const match = String(value ?? '').trim().match(/^(?:(\d+):)?(\d+(?:\.\d+)?)/);
  return match ? (Number(match[1] || 0) * 60) + Number(match[2]) : NaN;
}

function completedLaps(value) {
  const match = String(value ?? '').match(/^\s*(\d+)\s*\//);
  return match ? Number(match[1]) : 0;
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function buildPaceIndex(data) {
  const groups = new Map();
  for (const run of data?.raceResults || []) {
    const race = data.raceById?.[run[0]];
    if (!race || race.f || !/^Qualifier(?: Round)?\b/i.test(race.r || '') || completedLaps(run[3]) < MIN_PACE_LAPS) continue;
    const lap = lapSeconds(run[5]);
    if (!Number.isFinite(lap) || lap <= 0) continue;
    const key = `${race.e}|${race.c}|${race.r}`;
    if (!groups.has(key)) groups.set(key, {eventId: race.e, date: race.d, className: race.c, round: race.r, drivers: new Map()});
    const previous = groups.get(key).drivers.get(run[1]);
    if (!previous || lap < previous) groups.get(key).drivers.set(run[1], lap);
  }
  const points = [];
  for (const group of groups.values()) {
    const raw = [...group.drivers.entries()];
    if (raw.length < 2) continue;
    const fieldMedian = median(raw.map(([, lap]) => lap));
    const eligible = raw.filter(([, lap]) => lap >= fieldMedian * .6 && lap <= fieldMedian * 1.8);
    if (eligible.length < 2) continue;
    const benchmark = median(eligible.map(([, lap]) => lap).sort((a, b) => a - b).slice(0, 3));
    for (const [driverKey, lap] of eligible) points.push({eventId:group.eventId,date:group.date,className:group.className,round:group.round,driverKey,lap,benchmark,value:100*benchmark/lap,fieldSize:eligible.length});
  }
  return points;
}

export function paceSummary(points) {
  const values = points.map(point => point.value).filter(Number.isFinite);
  return {average:values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null,rounds:values.length,established:values.length>=MIN_RANKED_PACE_ROUNDS};
}
