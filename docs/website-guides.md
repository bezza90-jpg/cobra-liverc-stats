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

