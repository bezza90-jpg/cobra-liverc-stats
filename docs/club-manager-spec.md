# RaceHub club manager specification

## Product identity and boundaries

- Supplier and service owner: **Beryl Media Productions**.
- Product presentation: **RaceHub by Beryl Media Productions**.
- COBRA: original/reference installation only; no ownership of the commercial product and no sharing of private data.
- Each client installation has separate Wix, Google, payments, domain, deployment, secrets and private records.
- Drivers enter transponders through their club's Wix booking form. The club controls those records and RaceHub keeps them in that club's authenticated operational data; there is no shared Beryl or cross-club transponder directory.
- GPW tools are not part of the saleable product.

## Recommended delivery model

Build the club manager as a private Wix Dashboard Page so nominated club users enter it through their existing Wix dashboard. Use Wix Events as the source for events, tickets and registrations rather than duplicating those records. A separate Beryl service layer supplies LiveRC imports, health monitoring, module licensing and safe operational commands.

The first deliverable should be a clickable design prototype and an agreed action/data matrix. A real Wix extension then requires a Beryl Wix app identity, app namespace for any app-owned settings/audit records, permission scopes, backend endpoints and a test installation. Do not put API keys, deployment secrets or cross-club controls in the club-facing page.

## Roles

| Role | Intended access |
| --- | --- |
| Club owner | All purchased modules, users, club settings and billing/support information. |
| Event manager | Events, booking readiness, capacities, race-data imports and reports. |
| Check-in marshal | Current-event arrivals only; no settings or historical personal data. |
| Avatar reviewer | Submission queue and review actions only. |
| Read-only | Status, counts and reports; no changes. |
| Beryl service owner | Separate cross-client health, licensing, deployments, support and audit view. Never shown to club users. |

## Club-facing navigation

Only show a module when it is enabled in that club's service plan.

1. **Overview**
   - Next event, current booking count and last Wix/LiveRC update.
   - Clear status: working, attention needed, updating or unavailable.
   - Attention list with direct links to the affected record or action.
   - Recent changes and confirmation of completed actions.
2. **Events & bookings**
   - Event list with sale status, ticket totals and capacity.
   - Search and filters that genuinely narrow the data.
   - Click an event to open a full editable event workspace.
   - Booking-readiness check covering ticket mappings, required fields, payment state and capacity.
   - Open the source event in Wix for Wix-owned changes.
   - Transponders are available only to authorised operational roles and are omitted from public entry data.
3. **Race data**
   - Last LiveRC import, source URL, event/race/driver/lap totals and unresolved exceptions.
   - Run an authorised update, with progress and final confirmation.
   - Open an event to inspect classes, races, matching issues and published state.
4. **Check-in** — optional
   - Current event, checked-in/missing totals, driver search and arrival list.
   - Manual check-in/undo and replacement-link request with confirmation.
   - Mobile-first display for marshal use.
5. **Car avatars** — optional
   - Pending, accepted and declined submissions in a visual gallery.
   - Open a submission on its own page for review; do not reduce approval to a quick inline action.
   - Show allowance used and link to request additional managed processing.
6. **Club appearance**
   - Logo, approved colour choices, public contact links and basic public text.
   - Preview before publishing and retain last-known-good values.
7. **Users & access**
   - Named users, assigned role and last access.
   - Club owner can invite/revoke within permitted roles.
8. **Plan & support**
   - Purchased modules, included allowance, renewal date and service boundaries.
   - Report an issue or request a quoted enhancement.
   - Published support hours, response target, current incident status and any booked race-weekend cover.
9. **Privacy & compliance**
   - Current privacy/DPA/DPIA versions, next review date and launch-gate status.
   - Rights-request and incident registers with role-limited access.
   - Retention job health, sub-processor changes requiring approval and outstanding compliance actions.
   - Do not expose confidential security architecture, secrets or another club's compliance records.

## Interaction rules

- Preserve the user's scroll position and filter state when changing settings or returning from a record.
- Use full record pages for investigation and editing; a row always opens somewhere useful.
- Use confirmations for irreversible or external changes and show success/failure immediately.
- Never show a spinner indefinitely. Distinguish slow, disconnected, permission and no-data states.
- Display data freshness beside summaries and explain gaps rather than silently omitting records.
- Use ordinary club language; hide repositories, scripts, IDs, tokens, schedules and deployment terminology.
- Keep an audit trail of who changed what, when, the before/after values and whether the connected system confirmed it.
- Make every workflow usable at 360px width, with large touch targets and no horizontal page scrolling.

## Module and control matrix

| Control | Basic | Check-in | Avatars | Beryl owner only |
| --- | :---: | :---: | :---: | :---: |
| Wix event and ticket status | ✓ |  |  |  |
| Booking readiness and capacity | ✓ |  |  |  |
| LiveRC import health and authorised update | ✓ |  |  |  |
| Arrival board and manual check-in |  | ✓ |  |  |
| Avatar submission review |  |  | ✓ |  |
| Club logo, colours and public links | ✓ |  |  |  |
| Club users and roles | ✓ |  |  |  |
| Club compliance status and rights/incident workflow | ✓ |  |  |  |
| Module licensing and limits | Read only | Read only | Read only | ✓ |
| Secrets, deployments and cross-club monitoring |  |  |  | ✓ |
| Apply shared upgrades |  |  |  | ✓ |

## Safety and continuity

- Tenant isolation: every request is tied to exactly one Wix site/club and verified server-side.
- Least privilege: permissions reflect the user's role and installed modules.
- Wix-owned data remains in Wix; the manager stores only app-owned configuration, audit and operational state.
- Maintain last-known-good public data if Wix or LiveRC is slow or incomplete.
- Actions use idempotency/duplicate protection where a retry could create multiple effects.
- Every external call has a timeout, useful error message and retry path.
- Beryl's cross-client view shows service health but avoids exposing unnecessary personal data.
- Quiet-by-default monitoring records successful checks without messaging the operator; notify only on an actionable failure, repeated degradation or required approval.
- Automatically collect diagnostic evidence with an incident so routine failures do not require manual investigation from scratch.

## Intervention-by-exception contract

The normal state is self-maintaining. A successful sync, import, build, backup or health check writes to history and requires no action. Temporary failures are retried with bounded back-off. An incident is raised only when the retry budget is exhausted, data is ambiguous, an account owner must approve something, or continuing automatically could cause loss, duplication, an incorrect payment/booking state or a privacy issue.

Every raised incident must contain:

- affected club and module;
- user-visible impact and whether the public site is still on known-good data;
- first and most recent failure times;
- source status and permission/authentication result;
- automatic checks and retries already attempted;
- safe one-click recovery when available;
- the person who must act: club owner, Beryl, Wix/Google/payment provider or LiveRC operator.

## Build phases

1. Approve the clickable manager design and wording.
2. Create the Beryl Wix app and obtain its app ID/namespace.
3. Build Basic Overview, Events and Race Data workflows.
4. Add roles, audit history and service-owner health view.
5. Connect one isolated demonstration club and run non-payment tests.
6. Add Check-in and Avatar modules behind entitlements.
7. Run permission, failure/recovery, desktop and three-pass mobile testing.
8. Pilot with the first external club before offering it more widely.
9. Obtain independent UK data-protection/legal review and record launch-gate approval before live personal data.
