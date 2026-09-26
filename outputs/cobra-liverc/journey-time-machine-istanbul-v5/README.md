> Historical snapshot — use the [current README](../../../README.md) for active setup and publishing instructions.

# COBRA LiveRC statistics dashboard

This repository hosts the public COBRA statistics dashboard and refreshes it from the public COBRA LiveRC archive. It contains the complete verified history from 1 January 2022 and is designed for embedding in the Wix Harmony site.

It also includes a Podium Gallery at `/podiums/`. The newest event opens automatically, with the complete official archive from 2022 grouped by year and event. Every final displays its official top three and links to the complete LiveRC result.

Driver profiles use all available LiveRC run data to show completed laps, estimated distance raced at 150 metres per lap, time on track, fastest laps and consistency. The class breakdown also includes entries, runs, finals, finishing statistics, TQs and race wins.

Profiles also contain a class-by-class consistency breakdown with adjusted average, best run, factual consistency bands (98%+, 95–97.9%, 90–94.9% and below 90%) and the average gap between fastest and average lap.

The driver leaderboard can be re-ranked using the active date, event and class filters by average finish, performance, finals, total laps, distance, track time, runs, race wins, overall wins, podiums, TQs, finishing rates, consistency, number of 95%+ runs, fastest-to-average lap gap, fastest lap, qualifying average or average places gained from qualifying.

## YouTube race videos

The daily update can index COBRA race videos from `https://www.youtube.com/@Bezza90` from 1 January 2025 onward. Add a repository Actions secret named `YOUTUBE_API_KEY` containing a free YouTube Data API v3 key. The updater then places a **Watch race video** link beside the matching LiveRC result.

Video-title rules:

- The title must contain `COBRA`.
- Include the event date as `DDMMYY`.
- Include `Qual 1`, `Qual 2`, and so on, or identify the final.
- Include `4WD`, `Junior`, `Trucks` or `Vintage` when applicable. If no class is included, the video is treated as 2WD.

To add a podium photograph, follow `public/podium-photos/README.md`. Photographs are connected to a final through a predictable LiveRC event-and-race filename, so no code changes are needed.

It also publishes automatically calculated championship tables at `/sword/` and `/club/`, with a selector covering every September-to-April season present in the archive. Both use overall final positions, award 100 points for first then reduce by one point per position, add one TQ bonus point, and count up to the best four rounds. DNS and DNF entries retain the points for their published overall position. The highest dropped score breaks a points tie; if that remains equal, the championship position is tied. The Club 2021/22 season is labelled as a partial archive because the retained LiveRC history begins in January 2022.

## What it publishes

- Searchable driver leaderboard.
- Date and class filters.
- LiveRC-style leaderboard buttons for 2WD, 4WD, Junior Racers, Trucks and Vintage; the top filter also retains the combined All Seniors view, which excludes Junior Racers results.
- A header link opens the COBRA LiveRC event archive directly.
- The default view is the rolling year ending at the latest imported event.
- The default leaderboard requires ten final results, with options for any, 5, 10, 20 or 30 finals.
- Clicking a leaderboard name opens a detailed driver profile with attendance, finishing, qualifying, performance, consistency, class and event history statistics.
- Overall-final leaderboard with field-normalised performance, wins, podiums, top-five rate, average/best finish and all-run consistency.
- Separate Adult / Open and Junior leaderboards; junior status comes from the LiveRC `Junior Racers` class.
- Driver head-to-head comparisons using overall results and same-main finals only.
- Specific-event comparison with laps/time, fastest lap, average lap and consistency.
- Direct links to the selected LiveRC event and each exact final result page.
- Event and race explorer for every practice, qualifying heat and final, with full result statistics and direct LiveRC links.
- Expandable individual-race history inside every driver profile.

Definitions:

- **Leaderboard:** published overall final positions only. The adjustment grows with attendance: no result is discarded below 10 finals; one is discarded at 10, then one additional lowest result for every five further finals. The same allowance applies to field-normalised performance and consistency. Attendance, finals, wins and podium totals are never reduced.
- **Event head-to-head:** both drivers have a final overall result in the same class at the same event.
- **Same-final head-to-head:** both drivers appear in the same main final; heats and practice are excluded.

## GitHub setup

1. Create a free GitHub account and a new **public** repository named `cobra-liverc-stats`.
2. Upload the complete contents of this folder, including the `.github` folder.
3. Open the repository's **Settings → Pages**.
4. Under **Build and deployment**, choose **GitHub Actions** as the source.
5. Open **Actions → Update and publish COBRA statistics → Run workflow**.
6. When the workflow succeeds, GitHub Pages will provide the dashboard address.

The workflow checks LiveRC daily at 18:00 UK time using the `Europe/London` timezone. It therefore remains at 18:00 through both BST and GMT. You can also run it manually at any time.

## Wix Harmony setup

1. Add a new Wix page called **Statistics**.
2. Choose **+ Add → Elements → More Options → Embed**.
3. Drag **Embed a site** onto the page.
4. Open its settings and paste the GitHub Pages address.
5. Stretch it to the available width and start with a height of about 1,400 px.
6. Check desktop and mobile previews, then publish Wix.

## Updating rules

- Only events dated 1 January 2022 or later are considered.
- Event names containing `test` or `testing` are ignored.
- Future and zero-entry events are ignored.
- An event is imported only when entry, qualifying, overall and race-result pages are available.
- LiveRC event and race IDs prevent duplicate imports.
- Event `449348` is deliberately excluded because it is an unfinished duplicate of completed event `450264`.
- At most two new or changed events are processed in one run.

## Manual commands

These are optional; GitHub Actions runs them automatically.

```bash
npm run update
npm run validate
```

The updater uses only Node.js built-in features, so there are no packages to install and no passwords or API keys to configure.

## Files

- `public/` — the website GitHub Pages publishes.
- `public/data/dashboard.json` — compact browser-ready statistics.
- `data/raw/` — source records used for rebuilding statistics.
- `scripts/update-liverc.mjs` — checks LiveRC and imports eligible events.
- `scripts/build-dashboard.mjs` — recalculates browser-ready statistics.
- `.github/workflows/update-stats.yml` — automatic update and deployment.

If LiveRC changes its HTML format, the validation stage fails before publishing corrupted data. The last good dashboard remains available.
