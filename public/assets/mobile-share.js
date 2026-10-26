const boundRoots = new WeakSet();

export function facebookComposerUrl(url) {
  return 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url);
}

export function canUseNativeShare(navigatorObject = globalThis.navigator, windowObject = globalThis.window) {
  if (typeof navigatorObject?.share !== 'function') return false;
  const touchDevice = Number(navigatorObject.maxTouchPoints) > 0;
  const coarsePointer = Boolean(windowObject?.matchMedia?.('(pointer: coarse)')?.matches);
  return touchDevice || coarsePointer;
}

export function nativeSharePayload(url, title = 'COBRA RaceHub') {
  return {
    title,
    text: 'COBRA RaceHub race result',
    url
  };
}

export function bindMobileShareLinks(
  root = globalThis.document,
  navigatorObject = globalThis.navigator,
  windowObject = globalThis.window
) {
  if (!root?.addEventListener || boundRoots.has(root)) return;
  boundRoots.add(root);
  root.addEventListener('click', async event => {
    const link = event.target?.closest?.('[data-native-share-url]');
    if (!link || !root.contains?.(link) || !canUseNativeShare(navigatorObject, windowObject)) return;
    event.preventDefault();
    try {
      await navigatorObject.share(nativeSharePayload(link.dataset.nativeShareUrl, link.dataset.shareTitle || 'COBRA RaceHub'));
    } catch (error) {
      if (error?.name !== 'AbortError') windowObject?.location?.assign?.(link.href);
    }
  });
}

if (typeof document !== 'undefined') bindMobileShareLinks(document);
