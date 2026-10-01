# Development Phase 6 Completion Report

Date: 2026-09-21

Repository: `M:\Hyderabadtravel\b2btravelv2`

Gate: **Implementation and automated validation complete; awaiting manual user testing and approval.**

## Authorization and scope

The user accepted and froze Development Phase 5 at checkpoint `789effe` and explicitly authorized Development Phase 6. Governance checkpoint `0234273` records the transition. This phase implements only Enquiries, Custom Package Requests and Messaging under FR-12, FR-14, FR-16, FR-39, FR-45, FR-62 and FR-68–FR-71. Phase 7 transaction, booking, payment and commercial workflow functionality was not added.

## Implemented capability

- Following the user's correction instruction, the placeholder landing shell was replaced with the frozen blue-sky spatial experience ahead of its original Phase 8 polish assignment. It includes layered depth, atmospheric motion, responsive layouts, reduced-motion handling, persistent market selection, vertical positioning and the required Join/Explore paths.
- The Business Home dashboard now satisfies the FR-64 operational view with marketplace search, globally visible current market, active Package/Service counts, unread messages, account notices, recent inventory activity and quick Package/Service creation.
- Approved Businesses can start contextual conversations from published Packages, Services, Offers and approved Business profiles.
- Conversations retain their authoritative marketplace context and two Business participants.
- The Messages workspace provides conversation listing, search, unread counts, chronological history, replies and context display.
- Approved Businesses can send structured custom Hajj or Umrah Package requests with departure, dates, group size, total/Makkah/Madinah nights and requirements.
- Provider replies transition custom requests from Open to Responded. The requester can close a request.
- PDF, PNG and JPEG message attachments are private, signature checked, limited to 5 MB, stored through the Files port and downloaded only by conversation participants.
- Either party can block the other Business. Blocking prevents further messages in either direction. Participants can report a conversation with a durable moderation record.
- Each received message creates a durable `MESSAGE_RECEIVED` notification intent within the message transaction. Delivery stays asynchronous and provider failure cannot roll back a conversation or message.
- Marketplace cards expose **Message supplier** and **Request custom package** actions. Guests are sent to authentication; backend approved-Business policy remains authoritative.

## Database migration

Migration `20260921160000_phase6_messaging` adds:

- `conversations`, `conversation_participants`, `messages` and `message_attachments`;
- `custom_package_requests`, `business_blocks` and `conversation_reports`;
- context, custom-request and report status enums;
- participant, chronological message, attachment, report and request indexes;
- unique participant/report/request relationships and foreign keys;
- database checks for distinct Businesses, valid request dates/night totals and exactly one context type.

The migration preserves the historical optional Offer `businessProfileId` column as `legacyProfileId`; the authoritative Offer relation remains `profileId`. Dropping the historical column was rejected as potentially destructive. The complete nine-migration chain is current in both local databases. The post-checkpoint `20260921154323_misri` migration had already been applied to the development database and removed the approved Phase 5 indexes. Its exact historical file was retained for checksum integrity, and `20260921214500_restore_marketplace_indexes` restores all nine indexes idempotently.

## API and validation contracts

| Method/path                                                      | Access            | Purpose                              |
| ---------------------------------------------------------------- | ----------------- | ------------------------------------ |
| `GET /messages?q=`                                               | Approved Business | List/search conversations and unread |
| `GET /messages/:id`                                              | Participant       | Read detail and mark read            |
| `POST /messages`                                                 | Approved Business | Start contextual conversation        |
| `POST /messages/custom-requests`                                 | Approved Business | Create custom Package request        |
| `POST /messages/:id/send`                                        | Participant       | Send reply                           |
| `POST /messages/:id/custom-request/close`                        | Requester         | Close custom request                 |
| `POST /messages/:id/block`                                       | Participant       | Block the other Business             |
| `POST /messages/:id/report`                                      | Participant       | Report conversation                  |
| `POST /messages/:conversationId/messages/:messageId/attachments` | Message sender    | Add private attachment               |
| `GET /messages/:conversationId/attachments/:id`                  | Participant       | Download private attachment          |

Transport validation is in `packages/validation/src/messaging.ts`. Controllers authenticate, validate and call MessagingService. Prisma access remains inside module services; file and notification work uses exported services.

## Security and negative evidence

- Unauthenticated messaging returns 401; an unapproved Business returns 403.
- Direct API tests prove a third Business receives 404 for conversation and attachment access.
- Mutations require a valid session, CSRF token and allowed Origin. Marketplace authentication does not grant messaging authorization unless the Business is approved.
- Self-enquiry and self-request are rejected. Blocks are checked bidirectionally before start, request and send.
- Attachment access requires participation; upload additionally requires message ownership. Content signatures are checked independently of the supplied MIME type and filename.
- Request bodies are bounded, message/report fields are length limited and filenames are sanitized. Tokens, attachment contents and private data are not logged.
- Live rate-limit exercise returned 401 for the initial unauthorized requests and 429 after the configured message threshold. Helmet CSP and `nosniff` headers remained present.
- Durable notification intents were present after successful messaging. The worker connected and processed intents independently; missing external providers remain isolated from message commits.

## Automated validation

All commands used pinned Node 24.21.0 and pnpm 12.4.2.

| Gate                               | Result                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile`   | PASS; lockfile current; 10 workspaces                                                |
| Dependency/peer listing            | PASS; 89 packages in 10 projects                                                     |
| `pnpm audit` / `pnpm audit --prod` | PASS; no known vulnerabilities                                                       |
| `pnpm format:check`                | PASS                                                                                 |
| `pnpm lint`                        | PASS; 9/9                                                                            |
| `pnpm typecheck`                   | PASS; 12/12                                                                          |
| `pnpm build`                       | PASS; 9/9; `/messages` production route built                                        |
| `pnpm test`                        | PASS; 9/9                                                                            |
| Direct API integration             | PASS; 5 files, 10/10 tests                                                           |
| Phase 6 Playwright                 | PASS; 1/1 responsive landing, operational dashboard and two-agency messaging journey |
| Prisma validate/migrate/status     | PASS; nine migrations current; approved marketplace indexes restored                 |
| Runtime and Compose                | PASS; web 200, health `ok`, metrics 200, worker connected; PostgreSQL/Redis healthy  |
| Rate/security header smoke         | PASS; 429 observed; CSP and `X-Content-Type-Options: nosniff` present                |

No Phase 8 500-concurrent-user load qualification is claimed.

## Known limits and deferrals

- External email/SMS/push provider selection remains deferred. Phase 6 creates durable in-app notification intents and preserves explicit failure state without coupling core transactions to delivery.
- Conversation moderation records are created in Phase 6; a staff moderation console requires a separately authorized later phase.
- Staff/team messaging management is outside the frozen Phase 6 scope and was not added.
- Real-time sockets, typing indicators, message editing and deletion are outside the approved contract.
- The frozen TypeScript 7 / `@typescript-eslint/parser` limitation remains unchanged. Lint uses workspace TypeScript checks plus the root ESLint configuration.

## Deviations

No frozen requirement, role, technology family or module boundary changed. At the user's explicit correction instruction, the FR-01 landing implementation and final dashboard polish originally assigned to Phase 8 were delivered early; Phase 8 still owns production qualification, accessibility review and load testing. The disposable database retains its historical `phase2_test` name because existing safety guards require it. The legacy Offer column was retained to avoid an unapproved destructive migration. An automatically generated migration had already dropped Phase 5 marketplace indexes in the development database; history was preserved and a forward-only compensating migration restored them.

## Windows manual user test

1. In PowerShell at `M:\Hyderabadtravel\b2btravelv2` run:

   ```powershell
   $env:PATH='C:\Users\ANAS MISRI\Documents\Codex\B2BTravelV2\tools\node-v24.21.0-win-x64;C:\Users\ANAS MISRI\Documents\Codex\B2BTravelV2\tools\pnpm-12.4.2;'+$env:PATH
   pnpm services:up
   pnpm db:generate
   pnpm db:migrate
   pnpm dev
   ```

2. Open `http://localhost:3000` signed out. Confirm the blue-sky landing experience has no horizontal overflow on desktop or mobile, respects reduced motion, persists the selected market after reload, and provides working **Join the Network** and **Explore Businesses** actions.

3. Use two synthetic, verified, approved Business accounts, each with a Business profile. Publish a Package from Business B. Sign in as Business A and confirm Home shows current market, active Package/Service counts, unread messages, account notices, recent activity and quick-create actions.

4. From Business A's dashboard open the marketplace, find Business B's Package and choose **Message supplier**. Confirm `/messages` opens, select the Package conversation and verify the enquiry and Package context remain visible.

5. Sign out fully. Sign in as Business B and open **Messages**. Confirm the conversation shows an unread count. Open it, confirm unread clears, reply, and optionally attach a small PDF, PNG or JPEG.

6. Sign back in as Business A. Confirm the reply and attachment are visible and the attachment downloads. Search using text from the conversation.

7. From the marketplace choose **Request custom package** for Business B. Enter valid dates and ensure Total nights equals Makkah plus Madinah nights. Send it, then verify the full request context in Messages.

8. As Business B reply to the request. As Business A choose **Close request** and confirm its status becomes Closed.

9. Create another conversation, choose **Report**, enter at least ten characters and confirm success. Choose **Block business** and confirm neither account can send another message in that conversation.

10. Signed out, try **Message supplier** and confirm sign-in is required. An Applicant, unapproved Business or unrelated third Business must not gain direct API access to the conversation or attachment.

11. Try a file over 5 MB, a renamed non-PDF with `.pdf`, and an unsupported type; each must be rejected. Confirm normal `/health`, `/metrics`, marketplace and Phase 1 routes still work.

12. Confirm the worker reports `Notification worker connected`, then stop `pnpm dev` with Ctrl+C. Use synthetic data only and never paste tokens or live credentials into test records.

## Gate

**DEVELOPMENT PHASE 6 — STOP FOR MANUAL USER TESTING**

Phase 6 is not approved or frozen until the user completes this manual test and explicitly accepts the Phase 6 checkpoint. Phase 7 must not begin before separate approval and authorization.
