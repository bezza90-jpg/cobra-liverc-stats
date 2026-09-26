# Maintenance and publishing

[Back to the main README](../README.md)

## Where to edit

| Change | Active file or folder |
| --- | --- |
| Statistics page | `public/index.html`, `public/assets/app.js` |
| Main styling | `public/assets/styles.css` |
| Shared navigation | `scripts/build-navigation.mjs`; then run `npm run build:navigation` |
| Current event | LiveRC calendar via `scripts/update-event-calendar.mjs`; venue in `public/data/current-event.json` |
| Club and SWORD schedules | `public/data/race-day-schedules.json` |
| About team names, roles and biographies | `public/data/about-team.json` |
| About portraits | `public/assets/about/slot-1.jpg` through `slot-5.jpg`; create these when adding images |
| About, event, schedule and briefing page content | Corresponding folders under `public/` |
| Championship settings | `public/data/championships.json` |
| Upload connections | See [uploads and approvals](uploads.md) |
| Optional page artwork | `public/data/site-media.json` and `public/assets/site-images/` |

The current event title, date, type and links are selected from `public/data/event-calendar.json`, refreshed by the LiveRC updater. `current-event.json` supplies the venue. Each schedule selects the next meeting of its own type. Run `npm run update:calendar` to refresh just this calendar. A meeting remains current until its LiveRC Final Results summary contains finishing positions and all finals on its main-event lineups have a Complete status and result link; unknown or incomplete statuses do not advance it. Completion is checked during the existing daily and race-afternoon updates. Blank schedule times display “To be confirmed”. About profiles have a `visible` setting and an optional image path such as `assets/about/slot-1.jpg`.

Generated files such as `public/data/dashboard.json` and `public/data/championship-results.json` are rebuilt from `data/raw/`. Make calculation changes in the scripts rather than editing generated values.

Navigation is generated into each page as ordinary HTML, so it works without JavaScript. Update the navigation script and regenerate it instead of editing individual menus.

## Local commands

Run commands from the repository root with Node.js 20 or later and npm available.

| Command | Effect |
| --- | --- |
| `npm run build` | Rebuild both race datasets and navigation from local files |
| `npm run build:navigation` | Regenerate navigation only |
| `npm run check` | Run website checks, archive validation and performance regression tests |
| `npm run validate` | Run the narrower archive and feature validation |
| `npm run update` | Contact LiveRC and YouTube, update local records and rebuild race data |

The Node scripts use built-in modules. LiveRC imports do not require an API key. YouTube indexing uses the optional `YOUTUBE_API_KEY` environment variable; without it, the existing video index is retained.

Approved avatar processing is a separate Python step. The workflow uses Python 3.12 and installs `rembg[cpu]` and Pillow when processing is needed. Running `npm run build` does not process avatars or regenerate illustrated podium images.

Serve `public/` through an HTTP server for preview. If Python is already installed, one option is `python -m http.server 8000 --bind 127.0.0.1 --directory public`, then open `http://127.0.0.1:8000/`.

## Publishing

The deployment definition is [.github/workflows/update-stats.yml](../.github/workflows/update-stats.yml). It uploads only `public/`.

For an existing repository:

1. Run `npm run build` after changing source data or navigation, then `npm run check`.
2. Commit the intended changes, including generated files, and push to `main`.
3. Wait for **Update and publish COBRA statistics** to finish successfully.
4. Check the affected pages at the GitHub Pages address, including a mobile-sized view.

For a new GitHub repository, include `.github/`, `scripts/`, `data/`, `public/` and `package.json`. Configure Pages to deploy through GitHub Actions, then run the workflow. The source and scripts for setup/podium uploads use the existing COBRA site address in places; review those URLs before deploying a separate copy.

When uploading through GitHub's web interface, preserve the repository-relative paths. At the repository root, upload `public/` as a folder. When already inside `public/`, upload its contents. Do not upload a ZIP as the website or create `public/public/`.

## Backing up the current GitHub version

On Windows, run this from the repository root in PowerShell:

```powershell
.\scripts\backup-github.ps1
```

The command resolves the current `main` commit on GitHub and downloads that exact commit as a ZIP into `backups/` here. It does **not** package local uncommitted edits. To select another branch, use `-Branch branch-name`.

Each backup has a timestamp and commit ID in its filename. A matching JSON record stores the full commit ID, download time, file count and SHA-256 checksum. The script opens and reads every ZIP entry and checks that the homepage and publishing workflow are present. Existing backups are retained; `backups/` is excluded from Git by `.gitignore`.

The ZIP contains all files committed at that GitHub revision, including any historical exports still tracked there. It does not contain Git history, repository secrets/settings, Google Drive or Sheets content, the deployed Apps Script projects, Wix content, or the private site manager. The GitHub branch may be newer than the last successful website deployment.

To inspect or restore a backup, extract it into a **separate folder** first. Its top-level folder contains the repository snapshot; the website is inside `public/`. Compare the files before copying anything back into your working repository. Restoring local files does not change GitHub or the live site until you deliberately commit, push and deploy them.

The current command downloads from GitHub's public archive endpoint. If the repository becomes private, it will need an authenticated download method.

## Automatic updates

The checked-in workflow is configured for:

- A daily update at 18:00 in the `Europe/London` timezone.
- Sunday checks at minutes 7, 22, 37 and 52 during hours 15–18 in that timezone; the LiveRC calendar gates these checks to race days.
- Pushes to `main` and manual workflow runs.

The Sunday race-day runs update LiveRC data and podium illustrations; they skip YouTube indexing and avatar processing. Daily and manual runs include those steps. Checks run before publication; a failed check prevents that run from deploying. Passing checks does not guarantee that every external service is working.

## YouTube race videos

Set the repository Actions secret `YOUTUBE_API_KEY` to enable indexing from the configured Bezza90 channel, covering videos from 1 January 2025 onward.

Titles should contain `COBRA`, the event date as `DDMMYY`, and the qualifying round or final. Include `4WD`, `Junior`, `Trucks` or `Vintage` where applicable; otherwise the matcher treats the video as 2WD. Matching videos appear alongside race results.

## Wix and the private site manager

Embed the published page URL in a Wix website-embed element. Check desktop and mobile sizing after a site change; start with roughly 1,400 pixels of height and adjust to the page. Wix interface labels may vary.

The private site manager is not included in this checkout. Before importing or exporting its files, compare them with this repository so it does not overwrite newer code, upload configuration or generated avatar images. Keep its active website files under the same `public/` layout.

Historical ZIP-specific instructions are preserved in [the archive](archive/README.md). Historical site exports under `outputs/` are not active sources.

### Event booking links

The current-event Book in button uses a unique booking-page match by UK event date and Club/SWORD type. The updater reads the COBRA Wix event sitemap and structured event metadata, caching it in `data/raw/booking-calendar.json` for the day. Missing or ambiguous matches hide the event-specific button; All events remains available on the event, briefing and schedule pages. A failed booking refresh retains previously verified date-matched links. To force another refresh that day, clear the cache file’s `checkedDate` value and run `npm run update:calendar`.
