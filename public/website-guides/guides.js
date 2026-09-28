// Keep mobile playback deliberate and prevent several soundtracks playing together.
const videos = [...document.querySelectorAll('video')];
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
