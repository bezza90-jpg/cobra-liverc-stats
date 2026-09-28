# Website guides and videos

The public page is `public/website-guides/index.html`, with scoped styling in
`guides.css` and single-player playback handling in `guides.js`.

Each of the nine cards has a vertical MP4, JPEG poster, English VTT captions,
written steps, download link and links into the existing features. Videos use
`preload="none"`, native controls and inline playback; no video autoplays.

The media files in `public/website-guides/media/` are 1080 × 1920, H.264 video
at 30 fps with AAC music. Guides 01–05 and 07–09 last 25 seconds; overview 06 lasts 30.
They use captures of the actual live website from 28 September 2026, with a
short recorded replay segment where relevant. The soundtrack is Neon Sprint,
an original synthesized instrumental from the user's existing COBRA demo set.

Download/share copies are in the user's private Google Drive folder:
https://drive.google.com/drive/folders/1yLd_tB6nRcfmNlA0OdUZZX2uOhMYm7g1
The public page serves its own copies, so playback does not depend on Drive
permissions or Drive's embedded video player.

`scripts/build-navigation.mjs` adds the page to shared navigation and the
existing page footers. The footer link is important because Wix hides the
duplicate embedded header. The Wix menu now links About COBRA → Help & Website Guides to
https://www.cobracardiff.co.uk/website-guides, which embeds this page with the
COBRA top menu and footer. The banner matches the shared black-to-green
gradient. Wix navigation remains managed separately from this repository.

The Track Design guide covers the public Track Gallery and replay layouts;
it does not claim a public track editor or skin editor exists. The avatar
guide explains approval and shows an existing published example without
submitting a demonstration photo.

To replace a video, update its MP4, poster and captions together, then check
playback, mobile layout, written steps and the download link. If duration
changes, update the duration in the card. Run the usual site checks and
`node scripts/build-navigation.mjs --check` before publishing.

The first avatar Reel was recaptured after its podium car images loaded,
and replaced in both the public media and the existing Google Drive file.

## Lap charts and comparisons — 28 September 2026

The help page now includes three additional 25-second vertical Reels with electronic music and English captions: 07 Lap Times & Race Positions, 08 Compare Drivers, and 09 Replay Selected Drivers. Each card contains a quick written guide, feature links and an MP4 download. These demonstrate the published site, including lap data, selection-preserving links, Facebook sharing and filtered replay controls. Comparison link previews show the race overview; timing-based movement between crossings is estimated.


## Required capture checks

For every future video, wait for each live page to finish loading before advancing or capturing. Confirm that visible images have loaded, charts contain data, and replay track/car graphics are present. Inspect the resulting screenshot or recorded segment for missing assets, blank placeholders and loading indicators before using it. Reopen and recheck a page if the browser is closed or navigation is interrupted. Preserve the established COBRA opening and closing bumper style across portrait and landscape exports.

### 28 September review
Replaced the Simon Fisher scene in Meet the COBRA Drivers after confirming the live car image loaded. Replaced the existing Drive video in place. Corrected repeated average lap values and labelled fastest-lap lap numbers, including older concatenated values; fastest-lap results use bold purple.

Statistics avatar loading now uses the published image revision instead of a per-visit timestamp, allowing unchanged images to stay cached. Revision and avatar lists load in parallel. This removes unnecessary repeat image downloads; it does not establish the cause of every Wix loading delay.

## Responsive public feature tours (28 September 2026)

Three new tours: full public website tour (152s), Race, compare and replay (75s), and Discover your racing story (91s). Each has separate 1920×1080 desktop and 1080×1920 mobile exports. Under 768px, the player selects the vertical version; otherwise widescreen. Both formats remain downloadable. Resize changes apply after playback ends, or immediately before playback starts; active viewing is never restarted. Original nine quick guides remain vertical.

Tours retain COBRA bumpers and approved Mixkit A Game soundtrack, shorten menu to 3s, use brief crossfades, include actual moving Virtual Replay footage and mobile data close-ups. Captures were checked for loaded images before use.

Bumper revision: matched the supplied Virtual Race Replay reference with a plain dark background, large centred COBRA logo, Website Features Showcase opening title, and a closing logo with cobracardiff.co.uk. All six MP4s and their posters were replaced; video URLs are versioned so returning visitors receive the corrected files. First and last encoded frames inspected, not just the source artwork.

Final timing correction: rebuilt all six showcase exports from clean scenes to remove residual bumper flashes. Opening fades for 0.5s then holds for 4s; buggy showcase holds for 4s; website ending holds for 6s. The simple menu remains 3s, other feature screens 6–8s. Re-captured the race explorer only after event, individual race and all nine driver rows were populated. Exact new durations: 156.5s, 80.5s and 97.5s. All exports decoded and exact 30fps frame counts checked.

Desktop capture correction: all three widescreen tours now use desktop captures for schedule, club standings, Simon Fisher, podiums and historical replay. Confirmed images and data loaded before capture. Mobile exports retain their mobile views and close-ups. Timings and music unchanged.

Virtual Replay now has separate Fullscreen track and Fullscreen timings buttons. Mobile users can swipe left/right between panels with a 280ms slide, or use the Track/Timings buttons. Playback controls and clock remain shared; closing restores the original page. Reduced-motion preferences disable sliding. Where browser fullscreen is unavailable, the replay fills its available page viewport.

All six full/mixed showcase exports include a 16-second fullscreen replay demonstration before the closing logo. Desktop uses desktop views; Reels use mobile views with a sideways panel transition. New durations: full 172.5s, mix one 96.5s, mix two 113.5s.

The full feature showcase is now the first item in the help page, with individual guides and mixed tours retained below. Embedded replay fullscreen links open the chosen panel in a dedicated tab, preserving the selected race and comparison. This avoids iframe fullscreen restrictions.

Playback compatibility: after a reported GoPro Player stop around 1:52, all six showcase MP4s were re-encoded as continuous H.264 High Level 4.1, 30fps video with AAC 48kHz audio and fast-start metadata. Scene content, music and timings are unchanged.

Full race/driver charts and selected comparisons now open in the same tab; Facebook sharing retains its separate tab. Chart pages show the COBRA logo with navigation to Statistics, Replay, guides and home. Replay navigation preserves the race and selected drivers.

Final audio correction: the source music contained a silent tail from about 1:45 to 1:53. Trimmed that tail and used a two-second crossfade for continuous music. Added a six-second Perimeter oval explanation in each of the six showcase exports. New durations: 178.5s, 102.5s and 119.5s. Final videos use continuous H.264 Main Level 4.1 without B frames and AAC 48kHz audio.

Playback correction: all six tour MP4s now have matched video and audio track durations. Rebuilt the approved music loop from decoded PCM; independent MP4 media-header checks previously found a 98-second audio track inside the 178.5-second full tour. Each corrected export passed separate stream-duration checks and full decoding. Cache key: 20260928-audio-duration-fixed.

Performance update: statistics loads car images only on profile/map demand (5.8 MB of cold-start image requests avoided); gallery catalogues load in parallel; restored missing profile avatar markup. See performance-investigation.md for measurements, validation and remaining limitations.

Video startup: guides previously used preload=none for every video. Nearby videos now receive a preload hint through IntersectionObserver (200px margin); off-screen videos remain untouched. Explicit data-saving mode disables automatic preloading. Pointer/focus can prepare a video. A loading message covers buffering waits. Local browser test showed 2.28 seconds buffered in the featured video before playback, with all eleven other videos still at zero buffered seconds. Hosting returned HTTP 206 for a 64KB range in 0.18 seconds in one unthrottled sample. Mobile browsers may choose to ignore preload hints.
