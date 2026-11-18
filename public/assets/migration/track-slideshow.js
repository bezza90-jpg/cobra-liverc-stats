const hero = document.querySelector('[data-track-slideshow]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
if (hero) {
  const slide = hero.querySelector('.track-slide img');
  const mobileSource = hero.querySelector('.track-slide source');
  const toggle = hero.querySelector('.track-slide-toggle');
  const mobile = window.matchMedia(mobileSource.media);
  const photos = [
    '518556/01', '494442/05', '518556/02', '490436/01',
    '518556/03', '487182/05', '518556/04', '485726/01',
    '518556/05', '481748/06',
  ].map(name => ({
    mobile: '/track-photo-thumbnails/' + name + '.webp',
    desktop: '/assets/migration/track-slides/' + name.replace('/', '-') + '.webp',
  }));
  let index = 0;
  let timer;
  let paused = false;
  let generation = 0;
  let visible = !window.IntersectionObserver;

  function schedule() {
    clearTimeout(timer);
    const current = ++generation;
    toggle.hidden = reducedMotion.matches;
    if (paused || reducedMotion.matches || document.hidden || !visible) return;
    timer = setTimeout(() => {
      const next = (index + 1) % photos.length;
      const image = new Image();
      image.onload = () => {
        if (generation !== current) return;
        mobileSource.srcset = photos[next].mobile;
        slide.src = photos[next].desktop;
        index = next;
        schedule();
      };
      image.onerror = () => {
        if (generation !== current) return;
        index = next;
        schedule();
      };
      image.fetchPriority = 'low';
      image.src = mobile.matches ? photos[next].mobile : photos[next].desktop;
    }, 6000);
  }

  toggle.addEventListener('click', () => {
    paused = !paused;
    toggle.textContent = paused ? 'Play photos' : 'Pause photos';
    schedule();
  });
  reducedMotion.addEventListener('change', schedule);
  mobile.addEventListener('change', schedule);
  document.addEventListener('visibilitychange', schedule);
  if (window.IntersectionObserver) {
    const observer = new IntersectionObserver(([entry]) => {
      if (visible === entry.isIntersecting) return;
      visible = entry.isIntersecting;
      schedule();
    });
    observer.observe(hero);
  }
  schedule();
}
