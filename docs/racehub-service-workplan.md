# RaceHub club-service workplan

This plan covers a standalone club installation supplied by **Beryl Media Productions** using shared RaceHub software. Grand Prix of Wales systems are excluded. COBRA is the original/reference installation, not the owner of the commercial service. The club owns its domain, Wix, Google, payment accounts, funds and private data. Beryl Media Productions retains administrator access only for the duration of the agreement.

## Phase 0 — establish Beryl Media Productions

### Business structure decision

- **Sole trader:** Beryl Media Productions can be used as a trading name. The proprietor's legal name must still appear on invoices, contracts and other business paperwork. Registration is with HMRC for Self Assessment when required; a sole trader does not register the trading name at Companies House.
- **Limited company:** register the chosen company name with Companies House before presenting the business as limited. The company is a separate legal person and brings annual accounts, confirmation statements, Corporation Tax and director responsibilities.
- Discuss liability, tax, privacy risk and expected turnover with an accountant before choosing. Incorporation is useful to consider for a recurring technology service with client contracts, but it is not automatically required to begin trading.

### Separation from COBRA

- Use a dedicated Beryl Media Productions bank account or clearly separated business account.
- Use dedicated bookkeeping, invoices, contracts, insurance and tax records.
- Create Beryl-owned source-code, support, billing and monitoring accounts; do not use COBRA payment accounts or funds.
- Record that Beryl Media Productions owns the reusable RaceHub software and licenses the service to clubs.
- Record that each club owns its accounts, private data, payment funds, domain and club-specific content.
- Use COBRA only as a reference installation with permission; never copy its private driver, payment or operational data into another club.

### Name and brand checks

- Check Companies House names, UK trade marks, domains and social handles before launch.
- Decide whether **RaceHub by Beryl Media Productions** is the product presentation or whether RaceHub will receive a separate protected brand later.
- If operating as a sole trader, do not use “Limited” or “Ltd”.

### Completion evidence

- Chosen legal structure and accountant advice recorded.
- Beryl Media Productions invoice and contract details agreed.
- Separate business banking/bookkeeping ready.
- Privacy, data-processing, professional indemnity and cyber-insurance needs reviewed.

## Automation-first operating model

Beryl Media Productions is initially a side business. The service must remain dependable without promising that its owner is continuously available during working hours or while racing at weekends.

### Design principles

- Clubs complete ordinary event, capacity, content, check-in and review tasks through the simplified manager.
- Automated checks watch Wix synchronisation, LiveRC imports, public-data freshness, failed jobs, capacity thresholds and backup age.
- The system retries safe temporary failures and preserves the last-known-good public data.
- Clubs receive plain-English alerts only when action is required; successful routine jobs stay quiet and remain visible in history.
- Repeated or unresolved failures create one support incident with evidence, rather than sending many messages.
- Shared upgrades are tested centrally and rolled out deliberately; club-specific changes never update every club automatically.

### Zero-touch automation schedule

| Area | Normal automatic behaviour | Escalate to Beryl only when |
| --- | --- | --- |
| Wix entries | Incremental sync, validation, duplicate protection and capacity refresh | Authentication fails repeatedly, mappings become ambiguous or source records conflict |
| LiveRC results | Discover new events, import, validate counts and publish after checks | Page structure changes, identity/class matching is uncertain or validation fails |
| Public site | Build only changed data, run tests, deploy and retain the last-known-good release | Tests fail repeatedly or a rollback cannot restore service |
| Monitoring | Scheduled health checks, evidence capture, retry with back-off and incident grouping | The retry budget is exhausted or user action is required |
| Backups | Versioned configuration/data snapshots with automated age and restore checks | A backup is missing, too old or fails a restore verification |
| Club communications | Plain-English manager alerts for club-fixable issues | A Beryl-owned service or shared product fault is implicated |
| Shared upgrades | Test against a demonstration club, canary release and automatic stop on failure | Manual approval is required to continue rollout |

Routine successful activity should produce a dashboard history entry, not an email. Beryl receives a single actionable incident containing the affected club, impact, checks already performed, safe retries attempted and the recommended next action.

### Support boundary

- Publish normal support hours and a realistic response target measured in business hours, not an instant-resolution promise.
- State that Wix, Google, LiveRC, payment-provider and internet outages are outside Beryl's direct control.
- Race-weekend cover is available only when booked and charged separately, with the exact dates and hours agreed in writing.
- Emergency contact is reserved for a live booking, payment or race-day outage; content changes and enhancements enter the normal queue.
- The manager must show system status, known incidents and the next update so clubs do not need to ask for routine progress.

### Recommended starting targets

| Request | Initial target |
| --- | --- |
| Routine question or minor issue | Acknowledge within 2 business days |
| Core booking/data fault | Acknowledge within 1 business day |
| Pre-booked race-weekend cover | Agreed event-specific window |
| New feature or design change | Quoted and scheduled separately |

These are response targets, not guaranteed resolution times. Keep the first client count deliberately small until monitoring and self-service have proven reliable.

## Commercial starting point

### Price-selection guide

| Element | Market-informed standard | Fair team-member price | Minimum sustainable price |
| --- | ---: | ---: | ---: |
| RaceHub Basic setup | £1,250 | **£950** | £750 |
| Basic low-managed | £59/month | **£49/month** | £39/month |
| Check-in setup | £295 | **£225** | £195 |
| Check-in management | £20/month | **£15/month** | £10/month |
| Managed Car Avatar setup | £395 | **£325** | £295 |
| Managed avatars | £30/month | **£25/month** | £20/month |
| Semi-managed service | £189/month | **£129/month** | £99/month |
| Additional work | £60/hour | **£50/hour** | £40/hour |

The recommended team-member price is the middle column. It gives the club a meaningful reduction while still recognising the setup time, responsibility and future support. The minimum column should be used only with a tightly limited scope, prompt cooperation and no expectation of inclusive custom changes.

Published UK maintenance plans for ordinary websites commonly cluster around £40–£99 per month, with ecommerce, booking and hands-on plans at or above £99. RaceHub includes data integration and operational responsibility beyond ordinary maintenance, which supports the standard prices above.

Review any discounted price after 12 months. Record the standard value and discount separately on the quotation so the benefit to the club is visible.

## Phase 1 — agreement and product selection

### Actions

- Confirm Basic or Full edition.
- Select optional Check-in and/or Car Avatar modules.
- Agree included support time, response target, payment schedule and minimum term.
- Define what counts as maintenance, a fault, a content change and a chargeable enhancement.
- Sign data-processing, privacy and account-ownership terms appropriate to the arrangement.
- Complete the mandatory UK compliance launch gate in `docs/uk-data-protection-compliance.md`; live personal data cannot be used before approval.

### Completion evidence

- Signed scope and service agreement.
- Named club owner and service contact.
- Confirmed setup payment and provisional launch window.

## Phase 2 — accounts and ownership

### Club actions

- Create or nominate the club-owned Wix account.
- Create or nominate the club-owned Google account/Workspace.
- Confirm the legal organisation/payment owner and bank account.
- Purchase or transfer the domain.
- Invite the service operator as administrator.

### Service actions

- Create a separate source repository and deployment.
- Create separate deployment secrets and access records.
- Confirm that no COBRA Wix, Google, email, payment or private driver data is shared.

### Completion evidence

- Ownership/access checklist complete.
- Recovery contacts and two-factor authentication enabled.

## Phase 3 — club identity and site profile

### Required information

- Legal/club name, public short name and description.
- Main logo in a high-quality transparent format.
- Primary, secondary, accent, text and background colours.
- Venue address, contact details and social links.
- Footer wording, affiliation and copyright wording.

### Service actions

- Build the club profile and theme.
- Configure header, mobile menu, footer and booking links.
- Produce desktop, tablet and three mobile-width previews.
- Confirm colour contrast, readable text and logo clarity.

## Phase 4 — Wix Events and payments

### Required decisions

- Event types and racing classes.
- Ticket names, prices, capacities and sale dates.
- Single/multiple-class rules.
- Required booking fields, including transponder and chassis.
- Cancellation/refund rules and booking contact.

### Service actions

- Configure or verify the Wix plan that supports payments.
- Create a reusable event/ticket template.
- Configure form fields and exact RaceHub ticket mappings.
- Connect payment methods and assist with test mode/private events.
- Run free and paid test orders, cancellation and refund tests.
- Verify roster, class capacities and missing/incomplete-entry safeguards.

### Club-only actions

- Complete identity, business/organisation and bank verification.
- Accept payment-provider terms.
- Approve final prices and refund policy.

## Phase 5 — LiveRC import and data preparation

### Required information

- LiveRC archive URL.
- Earliest date to import.
- Current and historical class names.
- Known aliases, renamed classes or special championship rules.
- Required per-class transponder fields in the club's Wix booking form and the authorised operational users. No transponder records are inherited from COBRA or another client.

### Service actions

- Run automated archive discovery and import.
- Count events, races, drivers and lap records.
- Resolve class aliases and duplicate driver identities.
- Validate representative events against LiveRC originals.
- Configure update frequency and failure alerts.

### Data effort

The scrape/import is largely automatic. Human effort is normally **2–5 hours** for a clean archive, but can rise if names/classes changed frequently, events are incomplete or multiple LiveRC sources were used.

## Phase 6 — Basic site and management automation

- Publish booking, current-event, entries/capacity and results views.
- Connect Wix and LiveRC scheduled updates.
- Add continuity checks so incomplete external data cannot erase a good roster.
- Add monitoring, error reports, backup/recovery notes and deployment checks.
- Verify that no email, address or payment details enter the public data files.
- Install the simplified club manager described in `docs/club-manager-spec.md`.
- Show only modules included in the club's subscription; do not expose unavailable controls or technical secrets.
- Give Beryl Media Productions a separate service-owner view for licensing, connection health, upgrades and support.

## Phase 7 — optional Check-in module

- Create the club's separate Apps Script deployment and private register.
- Configure branding, authorised administrators, sender and support wording.
- Connect booked-driver records without exposing private data publicly.
- Test personal tokens, briefing acknowledgement and successful arrival.
- Test organiser search, refresh, manual check-in and undo.
- Test privacy-safe replacement-link requests.
- Verify narrow-phone, standard-phone, tablet and desktop views.

## Phase 8 — optional Car Avatar module

- Create separate private submission storage and approval records.
- Configure club branding, driver/class choices and notifications.
- Set image requirements: complete car and wing, correct orientation, clear three-quarter view and permission to publish.
- Test upload, rejection, replacement, approval and publication.
- Agree whether the club or service operator performs image preparation and final approval.
- Record exact approved assets so later automation cannot replace them accidentally.

## Phase 9 — privacy, resilience and handover

- Publish privacy and cookie information appropriate to the selected services.
- Confirm controller/processor roles, Article 28 terms, processing records, lawful bases and sub-processors.
- Complete a DPIA and children's-data assessment before the first live installation.
- Define retention periods for bookings, check-ins and rejected images.
- Automate retention/deletion and test rights-request export, correction and erasure workflows.
- Confirm administrator access and departure/handover procedure.
- Document backups for code, public data and private operational data.
- Record dependencies and what happens if Wix, Google or LiveRC is unavailable.
- Record international transfer mechanisms and prohibit unapproved use of live personal data in AI/support tools.
- Test the breach register and controller notification route; the controller owns any required ICO notification within the legal timescale.
- Train nominated club administrators.

## Phase 10 — testing and launch

### Three-pass mobile check

1. Layout pass: visibility, overflow, menus, images and readable data.
2. Interaction pass: booking links, filters, expandable data, check-in and uploads.
3. Real-device pass: Safari/iPhone and Chrome/Android where available.

### Pilot

- Run one private/dummy event.
- Run one limited live event with monitoring.
- Review entries, payments, check-in, results and support questions.
- Correct issues before general launch.

## Ongoing maintenance

### Included in low-managed

- Automated update and deployment monitoring.
- Shared compatibility, security and fault fixes.
- Monthly health check.
- Recovery assistance for faults within the supplied platform.
- Email support within the agreed response target.

### Chargeable

- New features and changed workflows.
- New pages, redesigns and custom championship rules.
- Bulk data correction/import work.
- Event creation or content work outside the selected allowance.
- Third-party account, billing or verification problems.
- Urgent/out-of-hours support.
- Excess avatar preparation or storage.

## Third-party costs paid directly by the club

- Wix plan that supports events and payments: price varies by region, billing term and promotion; confirm at Wix checkout.
- Domain registration/renewal: budget approximately **£10–£30 per year** for an ordinary domain, subject to registrar and suffix.
- Google Workspace if custom club email is required: Business Starter is currently **£5.90 per user/month with annual commitment or £7 flexible**, excluding tax.
- Card/payment fees: Wix currently lists **2.1% + £0.20** for ordinary UK cards and **3.1% + £0.20** for American Express; cross-border/multi-currency and refund effects may add cost.
- Optional extra mail volume, storage, premium media, SMS, paid integrations or advertising: at supplier cost.

Supplier prices can change. Quote them as pass-through costs, never promise a permanent fixed supplier price, and have the club contract with each supplier directly.

## Recommended invoicing

- 40% of setup on agreement.
- 40% when the private preview and data import are ready.
- 20% after pilot acceptance and before public launch.
- Monthly management paid in advance.
- Additional work approved in writing and invoiced monthly.

