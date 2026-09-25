(() => {
  'use strict';
  const gallery = document.getElementById('aboutGallery');
  const form = document.getElementById('aboutUpload');
  const status = document.getElementById('uploadMessage');
  if (!gallery || !form) return;
  const slots = [...gallery.querySelectorAll('figure[data-slot]')];
  const captions = slots.map(node => node.querySelector('figcaption').textContent);
  const render = (index, image, caption) => {
    if (!Number.isInteger(index) || index < 0 || index >= slots.length || !image) return;
    const figure = slots[index];
    const img = new Image();
    img.loading = 'lazy';
    img.alt = caption || captions[index];
    img.src = image;
    figure.firstElementChild.replaceWith(img);
    figure.querySelector('figcaption').textContent = caption || captions[index];
  };
  fetch('../data/about-gallery.json', {cache: 'no-store'}).then(response => {
    if (!response.ok) throw new Error('Gallery settings unavailable');
    return response.json();
  }).then(config => {
    const local = Array.isArray(config.slots) ? config.slots : [];
    const approved = data => {
      if (!Array.isArray(data)) return;
      data.forEach((entry, index) => {
        if (!local[index]?.image) render(index, entry?.image, entry?.caption);
      });
    };
    local.forEach((entry, index) => render(index, entry?.image ? '../' + entry.image : '', entry?.caption));
    const endpoint = String(config.webAppUrl || '');
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/?#]+\/exec$/.test(endpoint)) {
      status.textContent = 'Photo submissions will open once the COBRA upload service is connected.';
      form.querySelector('button').disabled = true;
      return;
    }
    const callback = 'cobraAboutPhotos_' + Math.random().toString(36).slice(2);
    window[callback] = approved;
    const feed = document.createElement('script');
    feed.src = endpoint + '?action=list&callback=' + encodeURIComponent(callback);
    feed.onerror = () => { delete window[callback]; };
    document.head.append(feed);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const file = form.elements.photo.files[0];
      if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 6_000_000) {
        status.textContent = 'Choose a JPG, PNG or WebP file under 6 MB.';
        return;
      }
      const button = form.querySelector('button');
      button.disabled = true;
      status.textContent = 'Preparing your photo…';
      try {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const submission = document.createElement('form');
        submission.method = 'POST';
        submission.action = endpoint;
        submission.target = '_blank';
        submission.style.display = 'none';
        const fields = {slot: form.elements.slot.value, caption: form.elements.caption.value, filename: file.name, mime: file.type, photo: dataUrl.split(',')[1], permission: 'yes'};
        for (const [name, value] of Object.entries(fields)) {
          const input = document.createElement('input');
          input.type = 'hidden'; input.name = name; input.value = value;
          submission.append(input);
        }
        document.body.append(submission);
        submission.submit();
        submission.remove();
        status.textContent = 'A new tab will confirm your submission. Your photo appears after approval.';
        form.reset();
      } catch (_) { status.textContent = 'Could not read the photo. Please try again.'; }
      finally { button.disabled = false; }
    });
  }).catch(() => { status.textContent = 'Photo submissions are temporarily unavailable.'; form.querySelector('button').disabled = true; });
})();
