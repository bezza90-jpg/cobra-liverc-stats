// Keep mobile playback deliberate and prevent several soundtracks playing together.
const videos = [...document.querySelectorAll('video')];
const mobileScreen = window.matchMedia('(max-width: 767px)');
// Warm only nearby videos, so pressing Play need not start a cold request.
// Browsers may ignore this hint; respect explicit data-saving preferences.
const saveData = navigator.connection?.saveData === true;
const prepareVideo = video => {
  if (video.preload === 'auto') return;
  video.preload = saveData ? 'metadata' : 'auto';
};
const nearbyVideos = typeof IntersectionObserver === 'function' && !saveData
  ? new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      prepareVideo(entry.target);
      nearbyVideos.unobserve(entry.target);
    }
  }, {rootMargin: '200px 0px'}) : null;
for (const video of videos.filter(video => video.dataset.desktopSrc)) {
  const chooseFormat = () => {
    // Keep a started video intact when a phone rotates or a window resizes.
    if (!video.ended && (!video.paused || video.currentTime > 0)) return;
    const format = mobileScreen.matches ? 'mobile' : 'desktop';
    const source = video.querySelector('source');
    const src = video.dataset[`${format}Src`];
    if (source.getAttribute('src') === src) return;
    source.src = src;
    video.poster = video.dataset[`${format}Poster`];
    video.load();
  };
  chooseFormat();
  mobileScreen.addEventListener('change', chooseFormat);
  video.addEventListener('ended', chooseFormat);
}
for (const video of videos) {
  nearbyVideos?.observe(video);
  video.addEventListener('pointerenter', () => prepareVideo(video), {once: true});
  video.addEventListener('focusin', () => prepareVideo(video), {once: true});
  const loading = document.createElement('p');
  loading.className = 'video-loading';
  loading.hidden = true;
  loading.setAttribute('role', 'status');
  loading.textContent = 'Loading video…';
  video.after(loading);
  const showLoading = () => { loading.hidden = video.paused || video.readyState >= 3; };
  video.addEventListener('waiting', showLoading);
  for (const event of ['playing', 'pause', 'ended', 'error']) {
    video.addEventListener(event, () => { loading.hidden = true; });
  }
  video.addEventListener('play', () => {
    showLoading();
    for (const other of videos) if (other !== video) other.pause();
  });
  const message = document.createElement('p');
  message.className = 'video-error';
  message.hidden = true;
  message.setAttribute('role', 'status');
  message.textContent = 'Video unavailable here. Try the download link, or read the quick guide below.';
  video.after(message);
  const showError = () => { message.hidden = false; };
  video.addEventListener('error', showError);
  video.querySelector('source')?.addEventListener('error', showError);
  video.addEventListener('loadeddata', () => { message.hidden = true; });
}
