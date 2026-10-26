# Standalone club RaceHub service

The COBRA project can be deployed for another club as a **standalone service** while sharing the maintained RaceHub software. A club deployment must not read COBRA's live Wix, Google, payment or member data.

## Blank starting template

Every new club installation starts with empty club data. It includes the reusable pages, booking integration, data import tools, management controls and branding settings, but no COBRA drivers, transponders, bookings, results, payments, uploads or historical records. The new club connects its own domain, Wix account, LiveRC source, Google account and payment provider during setup.

## Ownership boundary

Each club receives its own:

- domain and DNS;
- Wix site and Wix Events catalogue;
- payment account and payout destination;
- Google account, Drive, Sheets and Apps Script deployments;
- GitHub repository, deployment and secrets;
- LiveRC source configuration and published data;
- privacy notices, contacts and data-retention decisions.

Grand Prix of Wales pages, entry management, invitations and payment workflows are COBRA event operations and are not part of the commercial club product.

The club should be the owner of the Wix and Google accounts. The service operator is invited as an administrator so fixes and upgrades can be applied without owning the club's money or personal data.

## Shared software, separate configuration

`config/clubs/cobra.json` is the current COBRA profile. Copy `config/clubs/example-club.json` to a new club-specific file and set `CLUB_CONFIG` to its path during build and automation runs.

The profile controls:

- club and RaceHub names;
- public, RaceHub, booking, media and contact URLs;
- header, footer and optional partner logos;
- the global colour palette;
- footer wording and social links;
- optional Cloudflare analytics;
- Wix ticket names and the matching class, transponder and chassis fields.
- basic/full edition feature switches, which control navigation and the deployable page bundle.

Run `npm run build` after changing a profile. It writes the safe public part of the profile to `public/data/club-config.json` and the global theme to `public/assets/club-theme.css`. Wix credentials are never written into public files.

For a standalone club deployment, run `npm run build:deployment` and publish `dist/`. Disabled premium sections are omitted from that bundle. `config/clubs/basic-club.json` is the starting point for a booking/results-only service.

## Optional Check-in module

The existing COBRA check-in solution is a suitable separate module and does not depend on GPW. Its reusable scope is:

- one private link per booked driver;
- mobile briefing acknowledgement before check-in;
- immediate successful-arrival confirmation;
- a signed-in organiser board showing arrived and missing drivers;
- manual check-in/undo by race control;
- driver search and automatic refresh;
- a privacy-safe replacement-link request;
- event-scoped records and configurable authorised administrators.

For another club it must use that club's Google/Apps Script deployment, logo, colours, wording, authorised admin emails and booking data. Tokens, attendance records and email addresses remain private to that club. `features.checkIn` records whether the module is part of the club's service.

## Optional Car Avatar Upload module

Car Avatar Upload is a chargeable module controlled by `features.avatars`. It includes the upload experience, private submission storage, review/approval workflow, driver and class association, notifications and publication into RaceHub pages enabled for that club.

Each club must have separate storage, approval records, administrator access and notification settings. An external club must not share COBRA's Drive folders, Sheets, Apps Script properties or approved-image records. Image processing and approval responsibility must be defined in the service agreement: either managed by the service operator or self-managed by the club after training.

The acceptance standard should remain explicit: the whole car and wing visible, correct orientation, suitable three-quarter view, adequate quality and permission to publish. Automated checks may assist, but final publication remains an approval decision.

## Wix Events contract

The existing event synchronisation works per deployment using `WIX_SITE_ID` and `WIX_API_KEY`. A new club repository must contain only that club's credentials. Ticket names and form-field labels are declared in the club profile, so the shared synchroniser can read that club's paid/free attendees, classes, transponders, chassis and ticket capacities.

Before opening bookings:

1. Create the event and tickets in the club's own Wix site.
2. Add the required transponder and chassis fields to the event form.
3. Match every Wix ticket name in the club profile.
4. Add the new site's `WIX_SITE_ID` and least-privilege `WIX_API_KEY` as repository secrets.
5. Run the booking-readiness check and a free/private test order.
6. Confirm that the public roster and class capacities update without exposing email, address or payment details.

## Service levels

### Low-managed

The club edits Wix Events, page content and routine notices. Automated checks update entries and results. The service includes hosting/automation monitoring and shared security/compatibility updates. Content changes, new features and data corrections are chargeable.

### Semi-managed

Includes the low-managed service plus event setup checks, booking opening/closing support, routine content changes and agreed response times. Larger features and integrations remain separately quoted.

### Initial setup

Initial setup is a separate project covering branding, domain connection, Wix Events/forms, payment verification, Google services, LiveRC history import, privacy text, mobile checks and administrator training.

## Release discipline

Shared upgrades are developed and tested once, then applied to each club repository deliberately. Never point multiple clubs at one set of Wix or Google secrets. Test desktop and three mobile widths before release, run `npm run check`, and complete a Wix test booking whenever booking code or fields change.

## Remaining club-specific inputs

Before creating the first external club deployment, collect its legal/club name, chosen domain, logos, colour palette, Wix owner account, Google owner account, LiveRC archive address, racing classes, ticket prices/capacities, payment owner, contact/social links and preferred service level.
