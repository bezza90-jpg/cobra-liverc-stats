import { swipeView } from './fullscreen-gesture.js';
const player = document.querySelector('.player');
const standings = document.querySelector('.standings');
const controls = player.querySelector('.controls');
const bar = player.querySelector('.bar');
const dialog = document.createElement('dialog');
dialog.className = 'replay-fullscreen';
dialog.setAttribute('aria-label', 'Fullscreen race replay');
dialog.innerHTML = `<div class="fullscreen-nav"><div role="group" aria-label="Fullscreen view"><button data-view="track" aria-pressed="true">Track</button><button data-view="timings" aria-pressed="false">Timings</button></div><button class="fullscreen-close" aria-label="Exit fullscreen replay">✕ Close</button></div><p class="swipe-hint">Swipe left for timings · swipe right for track</p><div class="fullscreen-clock"></div><div class="fullscreen-content"><div class="fullscreen-panels"></div></div><div class="fullscreen-controls"></div>`;
document.body.append(dialog);
const content = dialog.querySelector('.fullscreen-content');
const parts = [player, standings, bar, controls];
const homes = parts.map(node => { const marker = document.createComment('Replay home'); node.before(marker); return marker; });
let opener, view = 'track', nativeFullscreen = false, start;
function showView(next) {
  view = next;
  player.inert = view !== 'track';
  standings.inert = view !== 'timings';
  player.setAttribute('aria-hidden', String(view !== 'track'));
  standings.setAttribute('aria-hidden', String(view !== 'timings'));
  dialog.dataset.view = view;
  dialog.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
  content.scrollTop = 0;
}
async function open(next, button) {
  if (dialog.open) { showView(next); return; }
  opener = button;
  dialog.querySelector('.fullscreen-panels').append(player, standings);
  dialog.querySelector('.fullscreen-clock').append(bar);
  dialog.querySelector('.fullscreen-controls').append(controls);
  document.body.classList.add('replay-fullscreen-open');
  showView(next);
  dialog.showModal();
  // iPhone and embedded pages may disallow native fullscreen; the modal still fills the available viewport.
  if (dialog.requestFullscreen && document.fullscreenEnabled) {
    try { await dialog.requestFullscreen(); nativeFullscreen = true; }
    catch { nativeFullscreen = false; }
  }
}
function restore() {
  parts.forEach((node, i) => homes[i].after(node));
  player.inert = false;
  standings.inert = false;
  player.removeAttribute('aria-hidden');
  standings.removeAttribute('aria-hidden');
  document.body.classList.remove('replay-fullscreen-open');
  nativeFullscreen = false;
  opener?.focus();
}
async function close() {
  if (document.fullscreenElement === dialog) {
    try { await document.exitFullscreen(); } catch { /* The modal can still close. */ }
  }
  if (dialog.open) dialog.close();
}
dialog.addEventListener('close', restore);
dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
document.addEventListener('fullscreenchange', () => {
  if (nativeFullscreen && !document.fullscreenElement) { nativeFullscreen = false; if (dialog.open) dialog.close(); }
});
dialog.querySelector('.fullscreen-close').addEventListener('click', close);
dialog.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
for (const [id, next] of [['expandTrack', 'track'], ['expandTimings', 'timings']]) {
  const button = document.getElementById(id);
  button.addEventListener('click', event => {
    const url = new URL(location.href);
    url.searchParams.set('fullscreen', next);
    button.href = url.href;
    if (window.top !== window.self) return; // Escape the main site's constrained iframe in a dedicated tab.
    event.preventDefault();
    open(next, button);
  });
}
dialog.addEventListener('touchstart', event => {
  start = null;
  if (event.touches.length !== 1 || event.target.closest('button, input, select, .fullscreen-controls')) return;
  start = { x: event.touches[0].clientX, y: event.touches[0].clientY };
}, { passive: true });
dialog.addEventListener('touchend', event => {
  if (!start || !event.changedTouches.length) return;
  const dx = event.changedTouches[0].clientX - start.x, dy = event.changedTouches[0].clientY - start.y;
  start = null;
  const next = swipeView(dx, dy);
  if (next) showView(next);
}, { passive: true });
dialog.addEventListener('touchcancel', () => { start = null; });

const initialView = new URL(location.href).searchParams.get('fullscreen');
if (initialView === 'track' || initialView === 'timings') open(initialView, document.getElementById(initialView === 'track' ? 'expandTrack' : 'expandTimings'));
