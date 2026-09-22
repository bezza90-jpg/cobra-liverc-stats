# COBRA LiveRC statistics dashboard

This repository hosts the public COBRA statistics dashboard and refreshes it from the public COBRA LiveRC archive. It contains the complete verified history from 1 January 2022 and is designed for embedding in the Wix Harmony site.

## What it publishes

- Searchable driver leaderboard.
- Date and class filters.
- Event attendance, class entries and TQs.
- A-final and lower-final wins shown separately.
- Driver head-to-head comparisons at event and individual-race level.
- Shared event attendance, even when two drivers raced different classes.

Definitions:

- **Attendance:** one event per driver, regardless of the number of classes entered.
- **Event head-to-head:** both drivers have a final overall result in the same class at the same event.
- **Race head-to-head:** both drivers appear in the same heat or final.
- **A-final wins:** first place in an A-main only.
- **Lower-final wins:** first place in a B-main or lower main.
- **TQ:** first place in the published qualifying-points table.

## GitHub setup

1. Create a free GitHub account and a new **public** repository named `cobra-liverc-stats`.
2. Upload the complete contents of this folder, including the `.github` folder.
3. Open the repository's **Settings → Pages**.
4. Under **Build and deployment**, choose **GitHub Actions** as the source.
5. Open **Actions → Update and publish COBRA statistics → Run workflow**.
6. When the workflow succeeds, GitHub Pages will provide the dashboard address.

The workflow checks LiveRC nightly at 04:17 UTC. The non-round minute reduces the chance of GitHub delaying a job during peak scheduler traffic. You can also run it manually at any time.

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
