# Phase 6 Complex Manual Acceptance Tests

Use only `b2btravelv2_phase6_demo`. Obtain credentials from ignored `demo-private/PHASE_6_DEMO_ACCOUNT_HANDOVER.md`; never copy them into evidence. Preserve the ten core suppliers and use disposable records where directed. Capture route, visible result, time, and PASS/FAIL without tokens or private values.

## TC-01 — Guest discovery across four verticals

**Objective/accounts:** guest; Deccan Crescent profile `phase6-demo-deccan-crescent`. **Precondition:** API/web use the demo DB. **Steps:** open `/`; select India; click each marketplace; search and filter; paginate; open supplier profile. Confirm Hajj `60000000-0000-0010-0001-000000000001`, Tourism `60000000-0000-0011-0001-000000000001`, Visa `60000000-0000-0012-0001-000000000001`, and Ground `60000000-0000-0013-0001-000000000001` records resolve in their own modes. **Expected:** market persists, published results only, profile is fictional, mobile/tablet layouts remain usable. **Negative:** invalid date range shows safe validation. **Pass:** all modes and profile work with no private fields. **Cleanup:** none.

## TC-02 — Applicant to approved business

**Objective/accounts:** new disposable applicant plus Admin 01. **Steps:** register a unique `@example.test` address; inspect local notification inbox, verify email/mobile, log in, complete `/apply`, upload a harmless synthetic document, preview and submit; Admin logs in, completes MFA, reviews and approves. **Expected DB:** expiring token is consumed, application audit/review and approved Business exist, notification intent created. **Negative:** duplicate submit and another user document URL are denied. **Pass:** approved owner reaches `/business`. **Cleanup:** retain evidence, delete only disposable test records through an authorized test reset.

## TC-03 — Owner inventory lifecycle and isolation

**Accounts:** Owner 01 and Owner 02. **Record:** create a disposable draft beside package `60000000-0000-0010-0001-000000000001`. **Steps:** Owner 01 creates, previews, edits, publishes and finds it publicly; Owner 02 attempts direct update with captured ID. **Expected:** publication succeeds for owner; cross-owner call denied/audited. **Negative:** invalid nights and price rejected. **Pass:** no ownership bypass. **Cleanup:** archive/delete disposable listing as Owner 01; never alter core demo records.

## TC-04 — Pilgrimage availability and comparison

**Accounts:** guest then Owner 02 for compare if prompted. **Records:** IDs with prefix `60000000-0000-0010`; use suppliers 01–04. **Steps:** filter India, Umrah, dates, group capacity and price; inspect blackout behavior; shortlist 2–4 packages and compare nights/accommodation/transport/visa wording. **Expected:** Makkah plus Madinah nights equals total, unavailable capacity is excluded, on-request price is labelled. **Negative:** over-capacity group returns no false availability. **Pass:** correct filters/comparison and no accreditation claim. **Cleanup:** none.

## TC-05 — Tourism enquiry

**Accounts:** Owner 02 requests; Owner 03 supplies. **Record:** `60000000-0000-0011-0003-000000000001`. **Steps:** filter destination/date/capacity; open details and supplier; click Message Supplier; send itinerary question. **Expected:** TOURISM_PACKAGE context and supplier 03 retained; conversation appears for both. **Negative:** draft tourism record does not appear. **Pass:** correct vertical/detail/context. **Cleanup:** keep conversation as demo evidence.

## TC-06 — Visa disclosure and messaging

**Accounts:** Owner 04 requests; Owner 05 supplies. **Record:** `60000000-0000-0012-0005-000000000002`. **Steps:** filter origin/destination/category, open detail, verify intended date/requirements and disclaimer, send document question, reply. **Expected:** VISA_SERVICE context; no guarantee of approval, appointment, or authority timing. **Negative:** unsupported category is safely rejected/empty. **Pass:** disclosure visible on card/detail and message context correct. **Cleanup:** none.

## TC-07 — Ground Services discovery

**Accounts:** Owner 06 requests; Owner 07 supplies. **Record:** `60000000-0000-0013-0007-000000000004`. **Steps:** select Ground Services, filter market/location, inspect capacity/lead-time description and supplier, send contextual enquiry. **Expected:** SERVICE context; route and supplier retained. **Negative:** unrelated vertical filters do not expose unpublished inventory. **Pass:** Ground results remain separate and enquiry reaches supplier 07. **Cleanup:** none.

## TC-08 — Messaging security and attachments

**Accounts:** Owners 08, 09, 10. **Steps:** Owner 08 messages Owner 09; verify unread count, Owner 09 replies and uploads a harmless text/PDF attachment; logout/login Owner 08, read and download; Owner 10 tries direct conversation and attachment URLs; Owner 08 blocks Owner 09 and both attempt send. **Expected:** persistence/read state correct, participant-only attachment, Owner 10 denied, block stops messages. **Negative:** oversized/disallowed attachment rejected. **Pass:** all 12 messaging expectations hold. **Cleanup:** retain harmless conversation; do not upload personal data.

## TC-09 — Two Admin MFA and privilege isolation

**Accounts:** Admin 01 and Admin 02; disposable applicant from TC-02. **Steps:** each signs in separately and must complete independent MFA setup; Admin 01 reviews applicant; Admin 02 confirms queue/audit. Attempt Admin route as Owner 01. For suspension enforcement, use a disposable business state prepared in the isolated test database because Phase 6 has no Admin transition UI. **Expected:** owner denied Admin access, MFA cannot be bypassed, suspended business loses protected business/messaging access and works again only after authorized fixture reactivation. **Negative:** direct privileged API before MFA denied. **Pass:** privilege and state guards hold. **Cleanup:** remove disposable fixture only. Admin transition UI remains Phase 7.

## TC-10 — Regression and resilience

**Accounts:** Owner 10 plus guest. **Steps:** open a protected route logged out, login, reload pages, submit invalid/duplicate data, inspect an unpublished disposable record as guest, log out, replay prior protected request, expire/revoke a disposable session in the isolated test DB, and retry. **Expected:** return routing works; safe errors contain no secrets; unpublished and cross-business records stay hidden; logout/revocation invalidates access; landing/health continue. **Negative:** altered IDs and stale CSRF fail. **Pass:** no data leak or authorization bypass and all four marketplaces remain available. **Cleanup:** remove disposable record/session through test tooling; preserve core dataset.
