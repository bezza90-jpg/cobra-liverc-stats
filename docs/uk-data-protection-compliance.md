# UK data-protection compliance plan

This is the compliance-by-design plan for RaceHub services supplied by **Beryl Media Productions** in the UK. It is an operational checklist, not a legal opinion or a guarantee of compliance. Complete it for Beryl and for every client club before processing live personal data, and obtain an independent UK data-protection/legal review before the first external launch.

## 1. Accountability model

### Expected roles

- The client club will normally be the **controller** for racer bookings, event administration, results, check-in and car-avatar purposes because it decides why that information is used.
- Beryl Media Productions will normally be the club's **processor** when it hosts, synchronises, supports or otherwise handles that information only on the club's documented instructions.
- Beryl is a separate **controller** for its own prospective-client contacts, contracts, invoices, support contacts, security/access logs and legal records.
- A party's title does not decide its real role. If Beryl independently determines a new purpose or essential means for club data, it may be a controller or joint controller for that processing and the documents must be changed accordingly.

### Required agreements

- A service agreement and UK GDPR Article 28 controller–processor agreement with every club.
- Written club authorisation before adding or changing a sub-processor.
- Equivalent data-protection obligations in Beryl's contracts with its sub-processors.
- A documented return/export and secure-deletion process when a club leaves.
- Clear ownership: club data remains the club's; reusable RaceHub software remains Beryl's.

The processing agreement must cover subject matter, duration, nature and purpose, data types, categories of people, controller rights, documented instructions, confidentiality, security, sub-processors, rights assistance, DPIAs, breaches, deletion/return and audit information.

## 2. Data inventory and purpose register

Create and maintain a Record of Processing Activities and data-flow diagram covering at least the following.

| Area | Likely personal data | Purpose | Public? | Default minimisation rule |
| --- | --- | --- | :---: | --- |
| Club administrators | Name, email, role, authentication and audit history | Authorised management and security | No | Named accounts; no shared admin login |
| Wix booking | Driver/contact details, BRCA number, classes, chassis, transponder and payment status | Entering and administering an event | No, except selected entry-list fields | Never store card details; publish no email, phone or address |
| Entry list/capacity | Driver name, class and confirmed/reserve status | Inform entrants and manage capacity | Yes, if the club has a documented basis and notice | Do not expose contact, payment or private form fields |
| LiveRC/results | Driver name, class, race position, lap times and source identifiers | Results, history and statistics | Usually | Explain historic publication, corrections and derived metrics |
| Ratings/profiles | Results-derived cRating, pace, consistency and comparisons | Sporting statistics and driver information | Usually | Explain methodology; provide correction/contact route; no significant automated decisions |
| Check-in | Driver, event, arrival status, briefing acknowledgement, token and minimal security log | Safe and efficient race-day arrival | No, except organiser access | Expiring tokens; avoid unnecessary location/device data |
| Car avatars | Source photograph, processed image, driver/class, review state and contact email | Optional public car representation | Final approved image only | Separate choice; reject/delete unsuitable originals on schedule |
| Email | Address, message type, send status, preferences and suppression record | Service messages and permitted marketing | No | Separate transactional and marketing purposes |
| Support/security | Contact, incident details, access/audit and diagnostics | Support, fraud prevention and resilience | No | Redact driver data from diagnostics whenever possible |
| Beryl billing | Club contact, contract, invoice and payment/accounting records | Operating Beryl Media Productions | No | Retain only for justified business/legal periods |

Never place private booking/contact/payment information in public JSON, a public repository, browser logs or a public error report. Public race data remains personal data and still needs a purpose, lawful basis, transparency, accuracy, retention and rights process.

### Club-owned transponder boundary

- Drivers provide their transponder number through the relevant club's Wix booking form. The club chooses the field and purpose and remains controller for those records.
- Wix stores the booking submission in that club's account. RaceHub retrieves the minimum required transponder data into that club's private operational store under the club's documented instructions.
- A club's transponder data stays inside that club's isolated installation and authenticated operational store.
- Beryl processes those records only for that club's booking, identity matching, timing preparation and race-control instructions.
- Do not create a Beryl-wide transponder directory and do not copy COBRA or another club's transponder history into a new installation.
- Cross-club matching must not use a transponder as a global identifier. If a driver independently supplies the same number to another club, that is a new record collected by that club.
- Public entry/capacity/result data excludes transponders by default. Authorised club, check-in and race-control roles receive only the access needed for the current purpose.
- The booking form must say why the transponder is required, who can access it, whether it is mandatory and how long it will be retained. It must not suggest that the number will be publicly displayed.
- On termination, export the club's operational records to the club and delete Beryl-held copies according to the processing agreement and backup schedule.

## 3. Lawful bases and transparency

The club, as controller, must choose and document the correct lawful basis for each purpose before collection. Do not use one blanket basis.

Likely starting points for controller review—not predetermined conclusions—are:

- event entry and required service emails: contract or steps requested before a contract;
- safety, system security, audit and proportionate sporting-result publication: legitimate interests, supported by a written balancing assessment where used;
- accounting/tax records: legal obligation;
- optional promotional email: valid consent or the PECR soft opt-in only where every condition is met;
- optional public car avatar/photo use: a separate, clear choice; assess children's capacity and parental involvement where relevant.

Consent must not be bundled into required booking, pre-ticked or treated as permanent. It must be specific, recorded and as easy to withdraw as to give. Withdrawing optional marketing or avatar consent must not cancel necessary booking communications.

### Layered privacy information

Provide concise just-in-time notices on booking, check-in and upload forms, linked to the club's full privacy notice. The notice must state:

- controller identity/contact and relevant Beryl processor role;
- each purpose and lawful basis, including legitimate interests where used;
- data categories and source where not collected directly;
- recipients/processors and international transfers/safeguards;
- retention periods or criteria;
- required versus optional fields and consequences of not providing them;
- applicable rights, withdrawal/objection routes and ICO complaint right;
- any profiling/derived ratings and meaningful explanation of their operation and effect.

Beryl also needs its own controller privacy notice for client sales, contracts, billing, support and security data.

## 4. Children and young racers

Assume that club services may be used by under-18s. Children have the same data-protection rights as adults and require clear, age-appropriate information.

- Perform and record a Children's Code scope assessment for public/user-facing online services likely to be accessed by children.
- Apply high-privacy defaults and collect the minimum data for all users where practical.
- Provide child-readable just-in-time information and a parent/carer version.
- Do not publicly display a child's email, phone, address, date of birth, check-in state or private booking fields.
- Do not use children's data for marketing, profiling or new purposes without a specific documented assessment.
- If relying on consent for an online service offered directly to a child, assess capacity and the under-13 parental-authorisation rules.
- Give children an accessible correction, objection, deletion and avatar-removal route.

Complete a DPIA before launch because the service combines data sources, derives driver metrics and is likely to include children/vulnerable individuals. Even if a final assessment concludes a DPIA was not strictly mandatory, retaining the completed assessment demonstrates the design decisions.

## 5. Email and PECR

Classify every template before sending:

- **Transactional/service:** booking confirmation, payment receipt, material event changes, required check-in information or a requested password/link. Keep content necessary and non-promotional. An unsubscribe link is not required merely to stop a message essential to the service, but the privacy notice and contact route still apply.
- **Marketing:** promotion of future races, offers or the club's aims. For individual subscribers, obtain valid consent or satisfy every applicable soft-opt-in condition. Identify the sender and include a simple, free opt-out in every marketing message.

Maintain one central suppression/preference record per club. Never delete an opt-out in a way that allows the person to be re-imported and emailed again. Do not use historic booking contact details for marketing unless the original collection and current facts support consent or every soft-opt-in condition.

## 6. Cookies and tracking

- Inventory cookies, local storage, pixels, embedded media and analytics on every public and manager page.
- Load only strictly necessary storage before a choice.
- Obtain consent before non-essential analytics/marketing storage; analytics is not automatically exempt.
- Provide equally prominent accept/reject choices and allow withdrawal later.
- Keep the cookie notice and consent configuration consistent with the actual technologies after every release.

Prefer privacy-preserving, cookieless operation where practical to reduce maintenance and consent risk.

## 7. Suppliers, locations and international transfers

Maintain an approved sub-processor register for the exact contracted entities and services, expected to include Wix, Google and any email, monitoring, hosting/support or payment integrations. Record purpose, data, location, contract/DPA, retention, security evidence and transfer mechanism.

- Review the actual legal entity and data terms for each cloud provider; brand name alone is insufficient.
- Determine whether any restricted international transfer occurs and document adequacy, UK Extension certification or appropriate safeguard/transfer-risk assessment as applicable.
- Do not assume a UK-facing product stores or supports all data only in the UK.
- Payment providers should receive payment data directly. RaceHub should store identifiers and status only, never card numbers or security codes.
- Production personal data must not be submitted to an AI assistant or other support tool unless that tool is an approved sub-processor for the relevant club, contractual terms and transfer/security review are complete, access is controlled, and the minimum necessary data is used. Use synthetic/redacted evidence by default.

## 8. Security controls

- Separate tenant data and credentials; authorise every server request against one club/site and role.
- Require MFA for Beryl and club administrators; prohibit shared accounts.
- Keep secrets outside source code/public files and rotate them after exposure or staff changes.
- Encrypt data in transit and rely on verified provider encryption at rest; document any exceptions.
- Apply least privilege, access reviews, dependency/security updates and tested backups.
- Keep tamper-resistant audit history for changes to events, users, permissions, check-in and publication.
- Expire one-time/check-in links; prevent replay and rate-limit requests.
- Redact personal data from monitoring, build output and support logs.
- Test tenant isolation, access revocation, deletion/export, restore and failure behaviour before launch and after material changes.

## 9. Retention and deletion

Agree a defensible retention schedule with each club. UK GDPR does not prescribe one universal period; the controller must justify each period and enforce it.

At minimum define periods/triggers for booking contacts, unsuccessful/reserve entries, check-in logs, briefing records, source/rejected avatar images, approved public images, email delivery logs, marketing consent/suppression, support tickets, audit/security logs, derived profiles/results and backups. Automate deletion or irreversible anonymisation, including backup expiry, and allow earlier deletion where appropriate.

Historic sporting results may justify longer retention than booking contact details. Keep those datasets separated so a historic result does not cause unnecessary email, phone, payment or check-in information to be retained.

## 10. Individual rights

Provide one published privacy contact and a documented identity-verification workflow for access, correction, erasure, restriction, portability, objection and consent withdrawal. Requests may arrive verbally, in writing or through social media; route all of them into the register.

- Normal subject access deadline: one month, subject to lawful pauses/extensions.
- Search all relevant club, Wix, Google, check-in, avatar, email, support, log and backup locations.
- Protect other people's information when responding.
- Propagate corrections/deletions to processors and public views where required.
- Make result/profile correction and avatar removal straightforward, including for children.

## 11. Breach and incident response

- Keep a breach register for every incident, including those not reported.
- Beryl, as processor, must notify the relevant club/controller without undue delay under the contract.
- The controller assesses risk and, where required, reports to the ICO without undue delay and within 72 hours of awareness.
- Notify affected people without undue delay where the risk is high.
- The response plan must identify contacts, containment, evidence preservation, risk assessment, notification ownership and post-incident corrective action.

Automation may detect and assemble evidence, but must not silently decide that a potentially serious breach is non-reportable.

## 12. ICO fee and governance

- Beryl must complete the ICO data-protection-fee self-assessment for its own controller activities and repeat it if activities change. A pure processor does not pay merely for processor activity, but Beryl will have controller activities of its own.
- Each club must separately assess its own fee/registration position; Beryl should not assume the club's not-for-profit status makes every activity exempt.
- Nominate a privacy lead even if no statutory Data Protection Officer is required.
- Review the processing record, sub-processors, risks, retention, notices, rights requests, incidents and staff access at least annually and after material change.

## 13. Mandatory launch gate

No external club may process live data until every item is evidenced:

- [ ] Controller/processor roles and instructions signed.
- [ ] Article 28 terms and sub-processor authorisation signed.
- [ ] Data inventory, flows and Record of Processing Activities complete.
- [ ] Lawful basis and any legitimate-interest assessments complete.
- [ ] DPIA and children's assessment approved.
- [ ] Club and Beryl privacy notices approved and deployed.
- [ ] Transactional/marketing email classification, consent and suppression tested.
- [ ] Cookie/storage audit and consent behaviour tested.
- [ ] Supplier contracts, locations and international transfer mechanisms recorded.
- [ ] Retention/deletion jobs and end-of-contract deletion/export tested.
- [ ] Rights-request register, identity check, export and deletion workflow tested.
- [ ] Breach plan and 72-hour escalation exercise completed.
- [ ] MFA, least privilege, tenant isolation, audit, secret handling and backup restore tested.
- [ ] ICO fee self-assessments completed for Beryl and the club.
- [ ] Independent UK data-protection/legal review completed for the first deployment and material new processing.

## 14. Evidence pack per club

Keep a versioned compliance folder containing the signed contract/DPA, controller instructions, processing record, data map, lawful-basis register, DPIA, children's assessment, privacy/cookie notices, consent wording, sub-processor/transfer register, retention schedule, security summary, access list, test evidence, rights/breach procedures and dated approvals. The manager should show the current version and next review date without exposing confidential security details.
