// Estimate a timed run using the seven quickest complete laps, without mutating results.
export function potentialRun(driver, durationSeconds) {
  const laps = (driver?.laps || []).filter(l => Number.isInteger(l.lap) && l.lap > 1 && Number.isFinite(l.seconds) && l.seconds > 0);
  if (laps.length < 7 || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return '—';
  const average = laps.map(l => l.seconds).sort((a, b) => a - b).slice(0, 7).reduce((sum, time) => sum + time, 0) / 7;
  // A timed race finishes on the first completed lap at or after the time limit.
  const count = Math.ceil(durationSeconds / average - 1e-10);
  const milliseconds = Math.round(count * average * 1000);
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = ((milliseconds % 60000) / 1000).toFixed(3).padStart(6, '0');
  return `${count}/${minutes}:${seconds}`;
}
