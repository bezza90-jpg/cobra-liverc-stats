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

## Driver Distance and Wix editor inspection
The first browser navigation to Driver Distance took about 4.46 seconds before navigation returned, with the main region still empty; the HTML pane appeared afterwards. This is an observation of the outer Wix startup boundary, not a precise network waterfall or a controlled before/after benchmark. The Wix editor identifies the pane as a Link embed to the tracker URL, with Essential cookie classification. Its settings expose no loading priority or startup delay control. No Wix publication was made during inspection.

Leaflet 1.9.4 is now served from the same GitHub Pages origin (BSD licence and required images included), removing the extra unpkg connection. Dedicated tracker/map links start its CSS and JS concurrently with dashboard data; ordinary statistics visits still load the map on demand. Existing deduplication, timeout and retry behaviour remains. Local browser validation showed the populated map and ten loaded tiles. Loader tests, published-site checks, data validation and navigation checks passed. This reduces an avoidable dependency chain but does not establish that the reported six-second Wix delay has been eliminated.

## Wix HTML pane root-cause follow-up
Inspected the public Driver Distance HTML and the exact Wix Harmony HTMLComponent client bundle referenced by it on 28 September 2026. The server response contains an empty div in the tracker container, not an iframe. In Wix's HTMLComponent implementation, `isSSR` returns an empty div. On the client, the consent wrapper and iframe component each wait for React effects; the inner iframe is created with `data-src` rather than `src`. Wix's `wix-iframe` custom element subsequently assigns `src` during relayout. Thus the embedded document cannot start loading directly from the initial HTML response: it depends on Wix client startup and component mounting first.

The configured category is Essential; there is no evidence that the user must accept a cookie banner. The inspected component exposes no fixed six-second timer or loading-priority control. Do not disable consent handling or patch Wix-generated internals. One warm reload reached the pane in 0.88 seconds and populated tracker in 1.80 seconds; an earlier first navigation was still shell-only at 4.5 seconds. These are browser-tool observations, not controlled cold-cache benchmarks. Direct-navigation commands sometimes waited roughly ten seconds before returning, so those command durations must not be presented as a trustworthy direct-versus-embedded comparison.

Root mechanism is established; attribution of each second within Wix startup is not. A browser network/performance trace would be needed to separate Wix script downloads, component data and main-thread work. The robust way to eliminate this dependency is to serve the interactive pages directly with matching COBRA navigation, rather than nesting them in Wix's HTML component; that is an architectural change, not a caching adjustment. No such navigation/hosting change was made during this investigation.

Public source inspected: https://static.parastorage.com/services/editor-react-components/dist/_wix_d14decac-site-components/client/component-e81a1c4b-8b8c-4a7e-9f2d-1a3b4c5d6e7f-D7kWoUiv.js

## Direct-page migration preparation — 28 September 2026

Added a local, responsive copy of the existing Wix white navigation ribbon, with the original COBRA and Grand Prix of Wales assets and menu groups. All feature pages and generated chart pages receive the shared header and footer. Embedded pages hide these to preserve Wix fallback pages. Driver Distance Tracker supports a direct full-page view with navigation retained.

The proposed hostname is racehub.cobracardiff.co.uk. Existing www and apex DNS remain unchanged. Custom-domain cutover and Wix link integration are separate deployment steps and must be verified before declaring migration complete. docs/wix-racehub-navigation.html is the exact prepared Wix Head/All pages/Load once/Essential snippet; it has not yet been enabled. It changes only known feature links, preserves query/hash state and existing page appearance, and leaves Wix pages available for direct fallback visits.

Rollback: disable the Wix Custom Code snippet, restore any changed Pages custom-domain setting to the recorded original, and remove only the newly added racehub CNAME if required. Preserve current race data when reverting implementation commits. Pre-change bundle, source zip, DNS observations and Wix published revision reference are in Z:\Data\Documents\RC Racing\COBRA\Website Backups\2026-09-28-before-racehub.

## Direct-page migration live — 28 September 2026, 22:52 UTC

The approved hostname https://racehub.cobracardiff.co.uk is live. GoDaddy CNAME racehub points to bezza90-jpg.github.io; apex, www and email records were not changed. GitHub's DNS check passed, its certificate was approved (expires 27 December 2026), and HTTPS enforcement is enabled. Both deployments 36492968146 and 36493303602 succeeded. The brief provisioning delay was resolved by restarting GitHub's certificate request after DNS became visible.

Wix Custom Code now contains the enabled item “COBRA direct feature navigation — racehub” (Head, All pages, Load once, Essential), using docs/wix-racehub-navigation.html. Fresh public Wix HTML includes it. Driver Distance menu navigation was verified to reach the direct new URL in the same tab. Wix may temporarily serve cached older HTML; refresh if the older navigation is still shown. Existing Wix fallback pages remain accessible; the old GitHub addresses redirect to the new hostname.

Live checks verified both header logos, the populated distance map (10 loaded tiles), chart comparison selections for Mark Giaquinto/Russell Thomas (11 graphs), and the fullscreen replay timings dialog with all nine drivers. Local checks also covered responsive mobile menus, embedded fallback, Current Event results opening in a new tab, and representative schedules, avatars, club and About pages. Site validation and relevant regression tests passed. No controlled cold-load timing claim is made: the change removes the Wix iframe startup dependency for direct visits, but network/data/image loading still takes time.

To roll back navigation, disable that single Custom Code item in Wix Settings > Custom Code. To roll back hosting as well, restore the recorded original Pages settings (no custom domain, HTTPS enabled); existing GitHub iframe URLs then resume serving directly. Do not remove the racehub CNAME while leaving links to it enabled. The verified pre-change backups are recorded above. Source and notes are mirrored to the Z-drive repository.

## 4 October 2026 image download audit
Fresh Edge contexts on the public RaceHub pages found large fallback car PNG downloads and an unused initial 2.9 MB replay track template. Completed the missing car thumbnails, made result-table images lazy, removed the initial replay template request and selected thumbnail car artwork plus a small transparent fallback. Local podium overrides now use 1040px WebP display copies, while enlarged and original photo links retain the originals. Publication builds the derivatives automatically. Existing Wix direct-navigation migration is already recorded above; no additional Wix setting is required for these changes.
Replay timing regression checks passed for 286371 crossings. Local browser checks cover loaded standings, photos and replay artwork. Before/after local interception timings are not comparable to public cold-load timings; use the live audit for download comparisons. One pre-existing truncated Chris Leonard source PNG remains unchanged, with its existing thumbnail preserved.
