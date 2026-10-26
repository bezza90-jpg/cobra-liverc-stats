# Current reference implementation — privacy gap audit

Date: 26 October 2026. Scope: a code/data-structure review of the RaceHub staging reference, not a full legal or security penetration test. Do not treat this document as approval to launch another club.

## Launch-blocking findings

### Public transponder data

Transponder values currently appear in JSON under `public/data/` and the public event-entry interface can display them. The affected data structures include current/next-event entries, admin entry data and transponder history. A transponder linked to a named driver is personal data even if it is not highly sensitive.

**Commercial-product default:** keep transponders in an authenticated operational store available to authorised event/check-in users. Publish only driver, class and capacity fields needed by visitors. If a club believes public transponders are necessary, the controller must document necessity, lawful basis, transparency and risk; Beryl should still recommend the private design.

Drivers will enter transponders through the relevant club's Wix booking form, and that club will control the resulting records. The commercial architecture must not seed a new club from COBRA history, merge transponder histories across clubs or use a transponder as a Beryl-wide driver identifier.

**Required engineering:** split public entry DTOs from private race-control DTOs, move transponder history out of the deployable public tree, update readiness/check-in tools to use authenticated access, and add the strict privacy audit to the deployment gate.

### Privacy documentation and controller configuration

The reusable product does not yet generate a club-specific controller privacy notice, Beryl controller notice, Article 28 schedule, sub-processor register, retention schedule, DPIA or children's assessment. These are required launch-gate deliverables, not optional website copy.

### Avatar upload transparency

The upload form explains the optional notification email and asks for permission to share the image, which is useful, but the wording is COBRA-specific and does not provide the complete layered privacy information required for a client installation. It also needs a clear child/parent route, controller identity, retention and deletion/removal information.

### Rights, retention and breach operations

The commercial manager design now includes these workflows, but the live reusable product does not yet provide a verified cross-system export/correction/deletion process, automated retention proof, breach register or contractual controller notification workflow.

## Review-required findings

### Cloudflare Web Analytics

The staging build injects Cloudflare Web Analytics into published pages. Cloudflare currently documents this product as not using cookies/local storage or collecting visitors' personal data. It therefore differs from cookie-based analytics, but the exact contracted entity, settings, data path, retention and current documentation must still be recorded in the supplier/privacy assessment. Reassess if configuration or product behaviour changes.

### Public results and driver metrics

Names, race history, lap times, ratings, pace and consistency are personal data when they identify drivers. The club needs a documented purpose/lawful basis, transparent methodology/correction route and a justified retention policy. These metrics must not be used for solely automated decisions that significantly affect drivers without a separate assessment and safeguards.

### Children

The service is likely to include junior racers. The current reusable product needs a formal Children's Code scope assessment, child-accessible privacy information, high-privacy defaults and controls that prevent publication of children's private booking/check-in/contact data.

## Existing positive controls

- Public-data generation is automated and can support repeatable checks.
- Avatar notification email is described as optional and not publicly displayed.
- The architecture already separates club installations and can isolate accounts/secrets.
- Automated validation and last-known-good publication provide a foundation for integrity and availability.
- The new manager specification separates club roles from Beryl's service-owner controls.

## Next engineering sequence

1. Design public and authenticated private entry schemas.
2. Remove transponder/history/admin fields from deployable public data.
3. Connect authorised manager/check-in views to private endpoints.
4. Make `npm run audit:privacy` a mandatory deployment check.
5. Create configurable privacy notices, just-in-time notices and consent/preference records.
6. Implement and test retention, rights-request and breach workflows.
7. Complete supplier/transfer records and independent UK review.
