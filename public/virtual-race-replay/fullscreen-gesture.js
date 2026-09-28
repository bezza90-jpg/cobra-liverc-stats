export function swipeView(dx, dy) {
  if (Math.abs(dx) < 60 || Math.abs(dx) <= Math.abs(dy) * 1.5) return null;
  return dx < 0 ? 'timings' : 'track';
}
