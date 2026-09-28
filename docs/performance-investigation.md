# Website loading investigation — 28 September 2026

## Confirmed findings
- Statistics previously requested 16 distinct car images immediately, totalling 5,806,442 bytes (5.8 MB), even when the visitor only used race results or the leaderboard. Browser caching could reduce repeat transfers, but did not eliminate these cold-visit requests.
- Cars now load only when their profile or distance map needs them. Concurrent requests share one catalogue fetch and one image per driver. Revision query parameters preserve caching while updating reviewed cutouts.
- The car gallery fetched its revision list after its other two catalogues. All three now start together. Lazy loading and asynchronous decoding are configured before setting image URLs.
- The main statistics HTML lacked the profile avatar container present in the older-page fallback. Restored the existing styled header and avatar container.

## Measurements and limits
A single unthrottled public HTTP sample from this computer returned the Wix homepage in 0.23 seconds (2.17 MB, uncompressed HTML), compressed statistics JSON in 0.42 seconds (569 KB), and Simon's 303 KB PNG in 0.22 seconds. The image response already specified Cache-Control: max-age=600. These are transfer samples, not full browser rendering or mobile speed scores. They do not establish that Wix scripts, third-party services or slow mobile connections are fast.

## Validation
Unit tests cover no startup downloads, single-driver image loading, request deduplication, revision URLs, invalid paths and failed-image request storms. Local browser checks loaded 48 race options, 44 leaderboard rows, Matthew's profile car and all 16 available distance-map cars. Existing performance, mobile-data and site-link checks are included in validation.

## Follow-up
Large original PNGs still exist; smaller display derivatives could reduce map/gallery download size further. Keep originals for enlarged viewing, and generate derivatives automatically during publication before adopting them. Wix shell performance requires separate browser/network profiling; do not claim the complete site-delay issue is solved by this change.

Video startup: guides previously used preload=none for every video. Nearby videos now receive a preload hint through IntersectionObserver (200px margin); off-screen videos remain untouched. Explicit data-saving mode disables automatic preloading. Pointer/focus can prepare a video. A loading message covers buffering waits. Local browser test showed 2.28 seconds buffered in the featured video before playback, with all eleven other videos still at zero buffered seconds. Hosting returned HTTP 206 for a 64KB range in 0.18 seconds in one unthrottled sample. Mobile browsers may choose to ignore preload hints.

## Embedded-page follow-up
The public Wix Current Event response contains no iframe; Wix inserts the iframe on the client. One response downloaded in 0.14 seconds (287 KB compressed), but that is not content-ready time. A warm browser reload populated the event in 0.74 seconds. The reported 6–7 second cold delay has not been reliably reproduced; do not present these warm samples as a cold-load improvement. Wix startup remains a separate boundary that child-page caching cannot eliminate.

Removed two avoidable data dependencies: statistics renders its dashboard independently of the optional video catalogue, and Current Event no longer requests schedules used only on the Schedule page. Required module dependencies are declared with modulepreload on Statistics, Current Event, Schedule and Replay so their downloads can begin without waiting for the entry module to be parsed. Fresh data still uses revalidation; there is no persistent stale-data cache. Tests cover a pending/failed video catalogue and absence of the unused schedule request.
