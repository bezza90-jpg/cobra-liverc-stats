# COBRA site rules and automation timings

[Back to the main README](../README.md)

Verified against the repository on **26 September 2026**. This describes the current configuration; it does not create or change any automations. All scheduled times below are **UK time (Europe/London)**, following GMT and BST automatically.

## Scheduled publishing

| Trigger | Timing | What happens |
| --- | --- | --- |
| Daily update | Every day at **18:00** | Check LiveRC, refresh the event calendar and statistics, index YouTube videos when configured, check approved car avatars, rebuild podium illustrations, validate and publish. |
| Sunday race updates | **15:07–18:52**, at minutes **07, 22, 37 and 52** each hour | Check whether the LiveRC calendar lists a meeting today. If so, update LiveRC data, event information and podium illustrations, then validate and publish. Skip YouTube indexing and avatar processing. |
| Website changes | A push to the **main** branch | Run the full update and publishing workflow. Local edits alone do not publish anything. |
| Manual update | When an administrator selects **Run workflow** in GitHub Actions | Run the full update and publishing workflow without waiting for the next scheduled time. |

The Sunday schedule contains 16 checks: 15:07, 15:22, 15:37, 15:52; 16:07, 16:22, 16:37, 16:52; 17:07, 17:22, 17:37, 17:52; 18:07, 18:22, 18:37, 18:52. The normal **18:00 daily update also runs on Sundays**.

The Sunday gate excludes meetings labelled test/testing. If no meeting is listed for today, it skips the update and deployment. If the calendar cannot be read, the check fails rather than guessing. There is no equivalent frequent Saturday schedule and no scheduled race refresh after 18:52; use a manual run if needed.

These are scheduled start times, not guaranteed publication times. Queueing, external services and the build add delay. Updates use one deployment concurrency group and do not cancel a running publication. A failed required step prevents that run from deploying; the previously published website remains available.

Source: [publishing workflow](../.github/workflows/update-stats.yml), [race-day check](../scripts/check-race-day.mjs).

## Current Event and race-day schedules

| Situation | Display rule |
| --- | --- |
| Before the next meeting | Show the earliest listed meeting on or after today's UK date. |
| During the meeting day | Keep that meeting displayed for the whole day, even if LiveRC marks racing complete. |
| Midnight after the meeting | Move to the next listed meeting. LiveRC completion status no longer controls this change. |
| No later meeting is listed | Retain the final meeting for **one calendar month after its date**. |
| The month expires without new dates | Show **Next meeting to be announced**. |
| Future dates are added | Once the refreshed calendar is published and the page loads it, the next meeting takes precedence over the retained final meeting. |

A calendar month ends on the same date in the following month, clamped to that month's final day. For example, a final meeting on 21 March remains through 20 April; on 21 April it expires. A 31 January meeting expires on 28 February in a non-leap year.

Club and SWORD schedule pages apply these rules separately to their own meeting type. The main Current Event page considers both types.

On page load, selection uses the visitor's clock interpreted in UK time. An open event or schedule page checks for a UK date change every **30 seconds** and reloads when it detects one. Background tabs or sleeping devices may delay this check. The midnight change does not require a midnight GitHub deployment, but new meeting dates must first reach the published calendar. Other calendar changes are picked up when the page is refreshed.

Source: [event selection](../public/assets/event-calendar.js), [page refresh](../public/assets/event-info.js), [calendar updater](../scripts/update-event-calendar.mjs).

## Booking buttons

- Booking destinations are matched by event date and Club/SWORD type to the existing Wix booking pages; URLs are not guessed.
- The updater refreshes the booking catalogue on its first successful check of each UK calendar day, then reuses that day's cache. This is not a separate midnight job.
- Missing or ambiguous matches hide **Book in**; **All events** remains available.
- A failed booking refresh retains the cached catalogue. To force another same-day check, clear the booking cache's checkedDate value and run the calendar updater, then publish the result.

Source: [booking matching and cache](../scripts/booking-calendar.mjs).

## Uploads, approvals and browser refreshes

| Feature | When it updates | Important timing rule |
| --- | --- | --- |
| Driver setup library | Fetch the approved list from Google when the page loads | Reuse a browser-session copy less than **15 minutes** old while fetching the latest list. This is a cache lifetime, not a 15-minute polling schedule. |
| Setup service timeout | Each list request | Give Google **15 seconds** to respond. On failure, retain a valid recently loaded list and show a notice. |
| Podium photographs | Fetch the approved photo list when the gallery loads | Google request timeout is **15 seconds**. Refresh the gallery after an approval. |
| Setup and podium approval | An administrator changes the submission status in the moderation spreadsheet | The supplied backend uses an installed spreadsheet-edit trigger; it is not a timed GitHub job. Backend deployment and trigger installation must be maintained separately. |
| Approved car avatars | Daily 18:00 update, manual workflow run or push to main | Check approved revisions and process images when needed. Sunday race-only runs skip this work. |
| YouTube race links | Daily 18:00 update, manual workflow run or push to main | Requires the configured API key. Race-only Sunday runs skip indexing; without a key the existing index is retained. |

Setup caching uses session storage, not a permanent offline copy, and may be unavailable in some embedded browser settings. Cached approvals can briefly remain visible while refreshing; the new list replaces them when it arrives. There is no automatic approval of submitted files.

Source: [setup library](../public/assets/setups.js), [podium gallery](../public/assets/podiums.js), [upload guidance](uploads.md), [setup/podium backend](../google-apps-script/driver-setups/Code.gs). The separate avatar backend is not included in this repository, so its internal triggers are not verified here.

## Data refresh and navigation rules

LiveRC updates prioritise today's meeting. New meetings, changed entry/driver counts and the most recent eligible meeting within the last **21 days** are candidates for re-import; the site does not re-download every historical race on each run. Previously published races are retained when LiveRC temporarily omits an earlier heat.

The Setups page uses a small generated event/podium lookup rather than the full race dataset. Approved setup retrieval and supporting data requests start in parallel; Google's first-response time can still affect a first visit.

When embedded in Wix, matching section links navigate the entire window to their Wix menu page. External website links also use the whole window. Sections without a Wix destination remain within the embedded area. Local previews retain local navigation. Wix content and layout are maintained separately from GitHub publication.

Source: [LiveRC importer](../scripts/update-liverc.mjs), [data builder](../scripts/build-dashboard.mjs), [navigation rules](../public/assets/external-links.js).

## Backups and checking an update

Backups are **manual**, not scheduled. Running scripts/backup-github.ps1 saves a ZIP of the current GitHub main revision locally. It does not back up Wix, Google Drive, deployed Apps Script projects, secrets or uncommitted edits. See [backup instructions](maintenance.md#backing-up-the-current-github-version).

To check an automation, open [GitHub Actions](https://github.com/bezza90-jpg/cobra-liverc-stats/actions) and select **Update and publish COBRA statistics**. A successful deployment confirms publication; then refresh the affected website page. An already-open statistics page does not generally fetch each newly published result automatically.

When changing these rules, update the linked source files and this document together. See [maintenance and publishing](maintenance.md) for commands and deployment steps.
