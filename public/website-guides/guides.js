// Keep mobile playback deliberate and prevent several soundtracks playing together.
const videos = [...document.querySelectorAll('video')];
const mobileScreen = window.matchMedia('(max-width: 767px)');
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
  video.addEventListener('play', () => {
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
