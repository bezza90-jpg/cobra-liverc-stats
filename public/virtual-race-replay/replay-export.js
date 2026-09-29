const MIME_TYPES = [
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm'
];

export function recordingFormat(MediaRecorderClass = globalThis.MediaRecorder) {
  if (!MediaRecorderClass) return null;
  const mimeType = MIME_TYPES.find(type => MediaRecorderClass.isTypeSupported?.(type)) || '';
  return { mimeType, extension: mimeType.startsWith('video/mp4') ? 'mp4' : 'webm' };
}

export function replayFilename(parts, extension) {
  const stem = parts.filter(Boolean).join('-').normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return `${stem || 'cobra-race-replay'}.${extension}`;
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function dataUrl(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load replay image (${response.status}).`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Could not prepare replay image.'));
    reader.readAsDataURL(blob);
  });
}

async function inlineImageSources(svg) {
  const sources = [...new Set([...svg.querySelectorAll('image')].map(image => image.getAttribute('href')).filter(Boolean))];
  const pairs = await Promise.all(sources.map(async source => [source, await dataUrl(new URL(source, location.href))]));
  return new Map(pairs);
}

function exportSvg(svg, inlineSources) {
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', '1579');
  clone.setAttribute('height', '987');
  clone.querySelectorAll('image').forEach(image => {
    const source = image.getAttribute('href');
    if (inlineSources.has(source)) image.setAttribute('href', inlineSources.get(source));
  });
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = `
    #route{fill:none;stroke:#151d18aa;stroke-width:25;stroke-linecap:round;stroke-linejoin:round}
    .centreline{fill:none;stroke:#baff7770;stroke-width:2;stroke-dasharray:14 18}
    .timing{stroke:#fff;stroke-width:7;stroke-dasharray:7 7}
    .loop-label{font:750 21px system-ui;fill:#fff;paint-order:stroke;stroke:#102016;stroke-width:4px;stroke-linejoin:round}
    .car-number{fill:#071209;stroke:#fff;stroke-width:2px;paint-order:stroke;font:bold 17px system-ui;text-anchor:middle;dominant-baseline:central}
    .retirement-fire{display:none}.car.retired .retirement-fire{display:block}.car.dim{opacity:.85}
  `;
  clone.prepend(style);
  return new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' });
}

async function drawFrame(context, canvas, background, svg, inlineSources, title, timeLabel) {
  context.fillStyle = '#0a100d';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(background, 0, 0, canvas.width, canvas.height);
  const svgUrl = URL.createObjectURL(exportSvg(svg, inlineSources));
  const overlay = new Image();
  overlay.src = svgUrl;
  try {
    await overlay.decode();
    context.drawImage(overlay, 0, 0, canvas.width, canvas.height);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
  const barHeight = 62;
  context.fillStyle = 'rgba(7,18,11,.88)';
  context.fillRect(0, 0, canvas.width, barHeight);
  context.fillStyle = '#85ed40';
  context.font = '700 18px system-ui';
  context.fillText('COBRA · VIRTUAL RACE REPLAY', 24, 25);
  context.fillStyle = '#fff';
  context.font = '600 18px system-ui';
  context.fillText(title, 24, 50, canvas.width - 190);
  context.font = '700 26px system-ui';
  context.textAlign = 'right';
  context.fillText(timeLabel, canvas.width - 24, 40);
  context.textAlign = 'left';
}

export async function downloadReplayVideo({
  duration, speed, renderAt, svg, background, title, filenameParts, onProgress
}) {
  const format = recordingFormat();
  if (!format || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error('Video downloads are not supported by this browser. Please use current Chrome or Edge.');
  }
  onProgress?.({ state: 'preparing', message: 'Preparing car images…' });
  if (!background.complete) await background.decode();
  const inlineSources = await inlineImageSources(svg);
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 800;
  const context = canvas.getContext('2d', { alpha: false });
  const stream = canvas.captureStream(20);
  const recorder = new MediaRecorder(stream, format.mimeType ? { mimeType: format.mimeType, videoBitsPerSecond: 5_000_000 } : undefined);
  const chunks = [];
  recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
  const stopped = new Promise((resolve, reject) => {
    recorder.onstop = resolve;
    recorder.onerror = event => reject(event.error || new Error('The replay recorder stopped unexpectedly.'));
  });
  recorder.start(1000);
  const started = performance.now();
  const outputDuration = duration / speed;
  let lastProgress = -1;
  try {
    while (true) {
      const elapsed = (performance.now() - started) / 1000;
      const raceTime = Math.min(duration, elapsed * speed);
      renderAt(raceTime);
      await drawFrame(context, canvas, background, svg, inlineSources, title, `${Math.floor(raceTime / 60)}:${(raceTime % 60).toFixed(1).padStart(4, '0')}`);
      const second = Math.floor(elapsed);
      if (second !== lastProgress) {
        lastProgress = second;
        onProgress?.({ state: 'recording', elapsed, outputDuration, raceTime, duration });
      }
      if (raceTime >= duration) break;
      await wait(50);
    }
  } finally {
    recorder.stop();
    stream.getTracks().forEach(track => track.stop());
  }
  await stopped;
  const blob = new Blob(chunks, { type: recorder.mimeType || format.mimeType || 'video/webm' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = replayFilename(filenameParts, format.extension);
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  onProgress?.({ state: 'complete', message: `Downloaded ${link.download}` });
  return link.download;
}
