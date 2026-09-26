# COBRA website

Race statistics, championship tables and race-day information for Cardiff Off Road Buggy Racing Association. The site imports the public COBRA LiveRC archive from January 2022 and is published through GitHub Pages. Pages can also be embedded in Wix.

**Start here:** edit the website in `public/`. This is the only folder published by GitHub Pages. Do not create another `public/` folder inside it.

## Guides

- [Maintenance and publishing](docs/maintenance.md): where to edit content, local commands, automated updates and deployment.
- [Back up the current GitHub version](docs/maintenance.md#backing-up-the-current-github-version): save a dated ZIP locally without including uncommitted edits.
- [Statistics and scoring](docs/statistics.md): filters, leaderboard calculations, championships and import rules.
- [Uploads and approvals](docs/uploads.md): driver setups, podium photographs and car avatars.
- [Google backend setup](google-apps-script/driver-setups/README.md): configure or update the shared setup/podium service.
- [Archived update notes](docs/archive/README.md): historical instructions for old ZIP packages; not current setup guidance.

## Website pages

Paths below are relative to the published site address (including the repository name for a GitHub project site).

| Page | Path |
| --- | --- |
| Race statistics, profiles and comparisons | `/` |
| Driver distance tracker | `/?tracker=1` |
| SWORD Championship | `/sword/` |
| Club Series | `/club/` |
| Podium Gallery | `/podiums/` |
| Driver Setups & Tips | `/setups/` |
| Current Event | `/event/` |
| About & location | `/about/` |
| Driver Briefing | `/briefing/` |
| Race Day Schedule | `/schedule/` |
| Upload car avatar | `/avatar-upload/` |

## Project layout

| Folder | Purpose |
| --- | --- |
| `public/` | Active HTML pages, assets and browser data |
| `data/raw/` | Imported LiveRC records used to rebuild statistics |
| `scripts/` | Data import, build, image processing and checks |
| `.github/workflows/` | Automatic updates and GitHub Pages deployment |
| `google-apps-script/driver-setups/` | Setup and podium upload backend source |
| `docs/` | Current guides and archived update notes |
| `outputs/` | Historical exports and superseded files; not published |

## Working on the site

Use Node.js 20 or later with npm. No npm packages are needed for the build and checks.

```sh
npm run build
npm run check
```

The build regenerates dashboard data, the smaller championship dataset and shared navigation. The checks cover local page/asset links, literal data fetches, JavaScript syntax, navigation consistency, data integrity, championship equivalence and map loading/retry behaviour.

Preview `public/` through a local HTTP server; opening HTML directly from the filesystem will not support its data requests. See [maintenance](docs/maintenance.md) for publishing and external-service requirements.
