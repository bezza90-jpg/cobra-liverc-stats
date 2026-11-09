const hero = document.querySelector('[data-track-slideshow]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
if (hero) {
  const slide = hero.querySelector('.track-slide');
  const toggle = hero.querySelector('.track-slide-toggle');
  const photos = [
    '518556/01.jpg', '494442/05.jpg', '518556/02.jpg', '490436/01.jpg',
    '518556/03.jpg', '487182/05.jpg', '518556/04.jpg', '485726/01.jpg',
    '518556/05.jpg', '481748/06.jpg',
  ].map(photo => '/track-photos/' + photo);
  let index = 0;
  let timer;
  let paused = false;
  let generation = 0;

  function schedule() {
    clearTimeout(timer);
    const current = ++generation;
    toggle.hidden = reducedMotion.matches;
    if (paused || reducedMotion.matches || document.hidden) return;
    timer = setTimeout(() => {
      const next = (index + 1) % photos.length;
      const image = new Image();
      image.onload = () => {
        if (generation !== current) return;
        slide.style.backgroundImage = 'url(' + photos[next] + ')';
        index = next;
        schedule();
      };
      image.onerror = () => {
        if (generation !== current) return;
        index = next;
        schedule();
      };
      image.src = photos[next];
    }, 6000);
  }

  toggle.addEventListener('click', () => {
    paused = !paused;
    toggle.textContent = paused ? 'Play photos' : 'Pause photos';
    schedule();
  });
  reducedMotion.addEventListener('change', schedule);
  document.addEventListener('visibilitychange', schedule);
  schedule();
}
