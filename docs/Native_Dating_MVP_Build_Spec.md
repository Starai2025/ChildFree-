# Native dating MVP: architecture and product requirements

Prepared for Starr • 6 October 2026 • Revision 3 — community pledge, structured profiles and implementation readiness

## 1. Product contract

Build a real native iOS/Android app for Black adults who have never been married, have no children and do not want children ever, seeking Black partners. This document specifies a proposed implementation baseline; it does not assert that vendors have approved an account or that an app store will approve the app.

Default product decisions: US launch; Atlanta founding cohort; 18+; committed relationships; inclusive gender and partner preferences; free matching and messaging in V1. Geography is configuration, not a separate app. Marriage-seeking is a profile choice, not a mandatory gate: the user asked for never-married members, not necessarily marriage intent. These defaults can be changed explicitly before implementation.

Required attestations: identifies as Black (including multiracial Black); never legally married; no biological or adopted children; no current parental/stepparental role; never wants to become a parent; seeking Black partners. Accept only affirmative eligibility statements. Reject 'maybe', 'unsure' or conflicting answers. Ask plainly and respectfully. Do not infer race from photos, names, IDs or biometric models. Do not describe parenthood or marital history as verified.

Members may correct answers or change their minds. An incompatible change removes discovery and chat eligibility immediately; it does not trap the person behind an irreversible answer. Appeals and account deletion remain available. Identity verification establishes identity/age evidence only, not these life-history attestations.

Before profile submission, members must accept the current Community Pledge. Pledge acceptance is separate from eligibility attestation, terms acceptance and marketing consent. It is recorded server-side and required by approval and protected-action checks. Material pledge updates require reacceptance; users can access support/settings/deletion while reacceptance is pending. See section 19 for the accepted V1 content and implementation requirements.

## 2. Build, reuse and purchase decisions

| Area | Selected baseline | Reuse and cost boundary |
|---|---|---|
| Native app | Expo, React Native, TypeScript, Expo Router | Official create-expo-app starter and Expo/Supabase integration guide. Free framework; EAS free tier has 15 iOS and 15 Android builds with low-priority queues; Starter $19/month plus usage. |
| Auth/database/photos | Supabase Auth, Postgres, private Storage, Edge Functions | Free development project; production Pro from $25/month for one included project. Additional projects, compute and usage cost extra. |
| Login | Email OTP via Supabase + custom SMTP through Resend | Free Resend transactional tier: 3,000 emails/month, 100/day. OTP, passwordless flows and redirects tested on both platforms. Phone OTP excluded initially to avoid SMS dependency and abuse bills. |
| Chat | Stream Chat React Native/Expo SDK and UI | Apply to Maker: at most five team members, under $100k funding, under $10k monthly revenue; limited availability. Chat ceiling 2,000 MAU/100 concurrent. Published paid Start: $399/month annual billing or $499 month-to-month. Confirm plan features and commercial account eligibility before integration. |
| Identity and age | Persona hosted verification, ID + optional/configured selfie | Apply for General startup cohort: 500 monthly verifications, $1 for additional service, up to 12 months. Confirm exact inquiry billing and account eligibility. Ordinary pricing starts at $250/month with 12-month term; obtain actual post-program quote. |
| Location | PostGIS; explicit city/ZIP plus optional foreground location | Reuse SQL geospatial queries. Store coarse discovery point; no maps or background tracking. No separate mapping API required. |
| Push | Expo notifications, server jobs | Sending is free; credentials, retries, receipts and device-token removal are still our integration work. |
| Content moderation | Human profile/photo approval; server text checks and report queue | Human time is a real operating expense. Optional AWS Rekognition DetectModerationLabels approximately $0.001/image in the referenced US tier; regional/API pricing varies. It classifies content, not identity. |
| Payments | Excluded V1; RevenueCat later | Free up to $2,500 monthly tracked revenue, then 1% of tracked revenue. Store commissions separate. Do not install/paywall now. |
| Analytics and errors | Minimal allowlisted events; optional PostHog and Sentry adapters | Use current free allowances only after checking plan limits. Disable replay and scrub personal data. No need to buy both before the core slice works. |
| Verification/testing | Local Supabase, SQL authorization tests, Jest/RN testing tools, Maestro | Reuse free tools; hosted CI/cloud testing have independent limits. |

Selected chat architecture is Stream, not simultaneous Stream and custom Supabase chat. If Maker is unavailable and paid chat is unacceptable, resolve that budget decision before implementation. Do not silently build a second chat backend. Keep a narrow adapter so the provider can be replaced later, without building a general vendor framework now.

Do not purchase a complete dating-app clone on the strength of a demo. A paid starter qualifies only after a clean installation, native builds, license verification, server-side authorization review, dependency compatibility and proof it reduces work on this exact stack. BLK/CFdating source code and proprietary matching systems are not publicly established reusable assets. This plan reuses SDKs, official starters and observable product principles.

## 3. Repository and ownership

Use one repository with apps/mobile, apps/admin, supabase/migrations, supabase/functions, supabase/tests and docs. Start shared validation/domain code in packages/domain only where mobile/admin/server actually share it; avoid a package for every concern. Pin package versions and commit lockfile after a fresh native integration build. Record SDK compatibility in docs/ARCHITECTURE.md.

Root AGENTS.md and CLAUDE.md reference this product contract, the test commands and the same architecture rules. Either coding agent can build or review. One writer per branch/task. Work serially on conflicting migrations. Security review is independent of feature implementation; neither agent may weaken gates to make a test pass. No secrets, real member data or vendor credentials in prompts, fixtures or commits.

## 4. Screens and exact behavior

| Route | Required behavior |
|---|---|
| Welcome | State membership requirements, 18+ and terms/privacy links. |
| Login | Email entry, OTP verification, resend cooldown, expired code handling, deep link recovery. |
| Eligibility | DOB and explicit attestations plus a separate Community Pledge acknowledgment; incompatibility result with correction/support/delete options. |
| Profile editor | Display name; gender; partner genders; optional bio up to 500 characters; choose two distinct catalog prompts with required answers of 20–200 characters each; relationship goal; marriage intent optional; two to six approved photos. |
| Preferences | Age minimum/maximum, distance in miles, city/ZIP; optional foreground location. Defaults: 18–99 and 50 miles, editable before submitting. No hidden widening. |
| Identity check | Explain vendor processing; launch hosted flow; show pending/retry/support status. No vendor success accepted from a client callback alone. |
| Submission/review | Submit complete revision; pending status; reviewer feedback and resubmit. Profile unavailable in discovery until approved. |
| Discover | Like/Pass cards and full profile; report/block available; up to five new candidates per day in founding beta, without guaranteeing five. Honest empty states. |
| Connections | Pending outgoing likes and active mutual matches. Separate matches with no accepted messages from conversations with at least one accepted message by either participant. No premium 'Likes you' tab yet. |
| Conversation | Text-only chat, pagination, retry, unread indication, unmatch/block/report. No attachments, voice/video, message editing or group chat. |
| Settings | Edit, pause/resume, notifications, blocked users, help, privacy/export request and account deletion. |
| Admin | MFA-protected review queue, photo/profile approval, identity status, reports, suspend/ban, appeals, audited actions and cohort availability. |

Accessibility: readable contrast, text resizing, screen-reader labels, tap targets and reduced motion. Like/Pass have buttons even if gestures are added. Loading, offline, denied permission, expired session and provider outage states required.

## 5. State transitions

Account lifecycle: onboarding → pending_review → active; pending_review → changes_requested → pending_review. Eligibility failure → ineligible; correction returns to onboarding. Active → paused → active. Any nondeleted account → suspended or banned by an authorized moderator; suspended → prior eligible state through an audited review. Any state → deletion_pending → deleted.

Approval requires current eligibility version, current Community Pledge acceptance, verified adult identity, complete profile, approved photos, approved profile revision and no suspension/ban. Store those independently; 'active' alone is not sufficient. Recheck prerequisites at every protected operation. A moderation-relevant edit creates a new profile revision and removes discovery until approved. No silent use of unreviewed fields. DOB corrections require support and verification reconciliation.

Paused users leave discovery and cannot create new likes; existing chats remain usable unless suspended, ineligible or banned. Suspended/ineligible/banned users cannot send/read chat or appear in discovery; revoke vendor access. Settings, appeal and deletion remain available. Unpausing checks current approval and eligibility again.

Match lifecycle: one-way like → reciprocal like → active match + pending chat provisioning → ready. Unmatch/block → closed terminal match. Unblock does not restore the match. Pending likes expire after 30 days; passes remain excluded until an explicit reconsideration feature exists. Closed matches do not rematch in V1.

## 6. Database contract

All timestamps UTC; UUID keys; enums/check constraints; foreign keys; transactions for cross-row rules. Private schema for DOB, attestations, coordinates, moderation and vendor references; public API schema only for safe projections/functions. Enable RLS on every exposed table.

| Table | Minimum columns and constraints |
|---|---|
| accounts | user_id FK auth.users unique, lifecycle, lifecycle_reason, created_at, deletion_requested_at |
| onboarding_drafts | user_id unique, current_step, validated non-sensitive draft fields, revision, updated_at; owner-only, never discoverable; sensitive eligibility/DOB values use the private records above |
| eligibility_versions | id, user_id, policy_version, attested_at, six eligibility answers; append-only, current version referenced by account |
| pledge_versions | version PK, text, text_hash, effective_at, current flag; immutable content; one current version; administrative publishing only |
| pledge_acceptances | user_id, pledge_version FK, accepted_at server timestamp; unique user/version; insert only through authenticated acceptance endpoint, no client-supplied timestamp |
| prompt_catalog | id, version, text, enabled; composite PK id/version; immutable text per version; members read enabled catalog, administrative changes only |
| private_details | user_id unique, dob, coarse_point geography(Point,4326), metro_id; never exposed to other members |
| profile_revisions | id, user_id, revision_number, display_name, gender, bio optional, prompts JSON with exactly two distinct catalog id/version references and 20–200 character answers, relationship_goal, marriage_intent, review_status; unique user/revision; server validates catalog references |
| preferences | user_id unique, partner_genders array, age_min, age_max, radius_miles; adult bounds, min ≤ max |
| photos | id, user_id, revision_id, storage_path unique, position, content_status; unique revision/position |
| verifications | id, user_id, provider, inquiry_id unique, status, verified_adult, completed_at; no raw ID/selfie copies |
| reactions | actor_id, target_id, kind like/pass, created_at, expires_at; unique directed pair; no self reaction |
| matches | id, user_low, user_high, status, closed_reason, created_at; ordered user pair unique, no self match |
| conversations | match_id unique FK, provider_channel_id unique nullable, status provisioning/ready/closed |
| blocks | blocker_id, blocked_id, created_at; unique directed pair, no self block |
| reports | id, reporter_id, subject_id, match_id optional, provider_message_id optional, category, detail, status, created_at |
| moderation_actions | id, admin_id, target_id, action, reason, timestamp; immutable audit |
| devices | id, user_id, push_token unique, platform, enabled, updated_at |
| outbox_jobs | id, kind, aggregate_id, idempotency_key unique, payload, status, attempts, next_attempt_at |
| webhook_events | provider, event_id unique per provider, received_at, handled_at |
| discovery_exposures | viewer_id, candidate_id, assigned_at, shown_at nullable, batch_date, reaction_at nullable; unique viewer/candidate in V1; assigned unanswered cards remain resumable |
| cohort_config | metro_id unique, enabled, recommendation_limit, policy_version |

Stream is the message store. Do not duplicate all message bodies in Supabase. Store limited report evidence with restricted moderator access and a deletion policy. A profile projection contains age in years and coarse distance band; never DOB or coordinates. Compute age from DOB server-side including birthday boundaries.

## 7. API contract

Use Supabase Auth for login/session; all application actions use typed server endpoints or carefully permissioned RPCs. Server derives actor from JWT, never caller-supplied user_id. Common errors: UNAUTHENTICATED, INELIGIBLE, NOT_APPROVED, BLOCKED, CONFLICT, RATE_LIMITED, PROVIDER_UNAVAILABLE. Mutation idempotency keys required where retries can duplicate work.

| Endpoint | Input → output; principal checks |
|---|---|
| POST /eligibility | DOB, attestations, policy_version → outcome/current_version; validate adults and version |
| GET /pledge | → current version/text; safe published content only |
| POST /pledge/accept | version → accepted_at; JWT actor, current version check, idempotent unique user/version |
| GET /profile/prompts | → enabled prompt id/version/text; published catalog only |
| PUT /profile | revision + validated fields → saved revision; only owner |
| PUT /onboarding/draft | step, validated fields, expected_revision → saved progress/new revision; owner only; no approval/lifecycle fields accepted |
| POST /photos/upload | MIME/size → short-lived owner-scoped upload; server finalize validates bytes, strips metadata, normalizes image |
| POST /profile/submit | revision → pending_review; complete profile/current attestations/verification |
| POST /verification/start | no user id → hosted session; owner, rate limit |
| POST /webhooks/persona | signed event → acknowledgment; signature, dedupe, reconcile vendor result |
| GET /discovery | cursor → safe eligible cards; snapshot exposures and recheck current access |
| POST /reactions | target, like/pass, idempotency_key → reaction/match; reciprocal rules, current eligibility |
| GET /matches | cursor → own ready/pending connections; no arbitrary pair lookup |
| POST /chat/session | → scoped short-lived vendor token; current status/access |
| POST /messages | match_id, text, client_message_id → vendor message id; active match, permitted statuses, no block, rate limit, content check |
| POST /unmatch | match_id → closed; participant only, revoke channel |
| POST /blocks | target → blocked; atomic discovery/match close plus access revocation job |
| POST /reports | target, evidence ref, category, detail → receipt; validate evidence association |
| POST /pause | paused boolean → state; preserve chat policy |
| DELETE /account | confirmation → deletion_pending; immediately revoke app/chat access |
| POST /admin/review | revision/decision/reason → result; server admin role, MFA, audit |

## 8. Discovery and atomic matching

Candidate generation checks both members' eligibility, active lifecycle, current approvals and verified adult status. Reciprocal gender and age preferences apply; distance must satisfy BOTH radii. Exclude self, blocks in either direction, passes, current outgoing likes, existing/closed matches and previously assigned profiles from NEW selection. Resume assigned unanswered cards after rechecking current eligibility/preferences; an app close is not a Pass. Never widen criteria automatically. Avoid requesting precise location continuously.

First ranking: active within the last seven days first; then nearer coarse distance; deterministic UUID tie-break. Show transparent reasons such as compatible age preferences and shared relationship goal. No fictional 91% compatibility score. Daily limit is configuration, not a complex scheduler; a server transaction persists the day's assignments, with shown_at recorded when rendered. Serve unanswered assigned cards first; count new assignments against the daily five, not reloads. Use a stable oldest-first queue for outstanding cards and recheck each card before serving. Do not reset exclusion history merely because a pool is small.

For reactions, lock the canonical user pair before testing reciprocal likes (e.g., a transaction-scoped advisory lock); enforce unique ordered match pair. Two simultaneous likes must yield exactly one match. Save the match and unique provisioning outbox job in the same transaction. Worker creates deterministic provider channel ID derived from match UUID and retries safely. Chat UI displays provisioning until confirmed ready. External vendor calls never sit inside a database transaction.

Density dashboard: count mutually eligible candidate availability by age bands, partner preferences and metro, not just raw men/women totals. Report aggregated cohorts with suppression for groups under ten members. Track median and lower-quartile candidate count and exhausted pools. Recruitment can respond to gaps while native development proceeds; fake profiles and undisclosed bots are prohibited.

## 9. Security and provider boundaries

RLS protects Postgres; it does NOT protect Stream. Configure Stream channel permissions explicitly: members can read their assigned channels; no client channel creation, member addition, arbitrary channel search or unrestricted send. Use a custom composer that calls our authenticated server send endpoint. Server is the only sender path and rechecks current match/status; test attempts to bypass it using direct SDK calls. Do not launch if this permission configuration cannot be demonstrated.

Block/unmatch: database transaction immediately forbids sends and queues channel removal/access revocation. API returns full success only after provider revocation confirms; otherwise return a pending safety action, deny sends, hide local history and retry with alerts. Test access with an already-issued vendor token and an already-open socket. Cached text previously received cannot be remotely erased; do not promise that it can. Ban/ineligibility requires global vendor-session/channel access revocation; short token TTL alone is insufficient.

No service-role or vendor secrets in mobile/admin browser bundles. Elevated SQL functions have fixed search_path, minimum grants, actor validation and explicit access predicates. Never grant broad SECURITY DEFINER discovery access. Use separate dev/staging/production with synthetic fixtures only; migration CI must reject missing RLS or unsafe grants.

Quarantine originals in private storage. Only approved normalized images are served using short-lived signed URLs after relationship/discovery authorization. Strip EXIF location; inspect file magic, dimensions and size server-side; cap incoming files at 10 MB and final normalized photo at 500 KB. Public buckets prohibited. Removed/blocked access stops URL issuance; existing signed links remain valid until expiry, so use ≤60-second TTL where practical and document that limitation.

Published profiles and chat are personal data; avoid logging their content. No email, name, DOB, racial attestations, sexual preference, ID images, coordinates or messages in analytics/errors. No session replay. Push text defaults to generic 'You have a new message', not message preview. Admin access uses MFA and audit trails.

## 10. Moderation and deletion operations

Human-review every submitted profile revision/photo before visibility; match text is plain text, no clickable links in V1. Server content checks filter obvious prohibited terms/spam; rate limits complement them, not substitute for human handling. Default authenticated limits: 20 messages/minute, five uploads/hour, three verification starts/day; configurable with abuse monitoring. Define sexual content, harassment, threats, fraud and eligibility misrepresentation rules before admitting members.

Report available from profile and message. Block remains available regardless of moderation outcome. Report preserves scoped evidence even after unmatch. Triage critical threats/child-safety reports urgently; assign an actual operator and response coverage before launch. Routine internal target: within 24 hours. Do not advertise guaranteed response times without staffing. Automated flags route to review; identity vendor failure goes to support rather than permanent automatic ban.

Proposed retention: immediately hide on deletion request, remove active profile/photos/provider identity references/chat account data within 30 days; restricted safety report evidence up to 90 days unless a documented preservation requirement applies. Document vendor/backups deletion lag and exceptions in the published policy. Export covers the requester's own data without exposing another member's private details. Verify vendor deletion behavior in staging, including conversation effects on the remaining member.

Apple submission requires functional objectionable-content filtering, reporting, blocking and contact information, plus a meaningfully differentiated dating experience. Google dating-category child-safety requirements apply even to an adults-only app: published standards, in-app reporting, CSAM handling/reporting process and child-safety contact. Include in-app deletion and required web deletion/request path, accurate privacy/Data Safety disclosures, reviewer accounts and live backend. The applicable personal Google Play account process requires 12 opted-in testers for 14 continuous days before applying for production access. App-store review is an external milestone, not a coding task that agents can guarantee.

## 11. Analytics and success definition

Allowlisted events: signup_completed, eligibility_passed/failed (without answers), profile_submitted, profile_approved, discovery_empty, candidate_shown, like_sent, match_created, conversation_ready, first_reply, report_submitted, block_completed, deletion_completed. Deduplicate server outcomes using event IDs; use pseudonymous identifiers and coarse cohort only.

North star: reciprocal conversations per weekly active approved member. A reciprocal conversation is an active match in which both members send at least one accepted message during the week; count unique matches, not message volume. Track onboarding completion, approval time, verified identity completion, match-to-reciprocal-conversation conversion, candidate availability, report resolution and successful block revocation. These are measurement definitions, not invented performance targets.

## 12. Acceptance and release checks

1. Two synthetic adults complete signup → attest → profile/photos → vendor sandbox verification → approval → reciprocal discover/like → one match → one channel → reciprocal messages on iOS and Android builds.
2. Underage, conflicting, pending, rejected, suspended and banned accounts cannot obtain candidates or chat access through direct API/SQL/vendor calls.
3. Reciprocal age/gender/radius exclusions hold at birthday boundaries and distance boundaries. No coordinate/DOB leakage in payloads.
4. Simultaneous reciprocal likes, repeated requests, worker crashes and duplicate webhooks yield one match/channel and no duplicate notification.
5. Block/unmatch while the other device is open prevents send and provider access; provider outage produces pending revocation with denied server sends and operator alert.
6. Altered JWTs/actor ids, foreign photo paths, direct storage reads, direct vendor channel queries and profile self-approval fail.
7. Client-forged verification callback cannot set verified; signed duplicate/reordered webhooks reconcile safely.
8. Photos cannot appear before approval; metadata stripped; deletion removes vendor/storage data through tested jobs.
9. Expired sessions, disconnected chat, background/resume, denied location/push permissions and exhausted candidate pools recover honestly.
10. Admin MFA, audit actions, report evidence access, staging restore and spending alerts work. CI: TypeScript, lint, domain tests, SQL authorization/concurrency tests, and native smoke flows. Passing browser tests alone is insufficient.
11. Kill/relaunch the app mid-onboarding and mid-discovery: restore saved steps and unanswered cards, recheck access, and do not fabricate passes or charge another daily assignment. Concurrent draft saves reject stale revisions and preserve the latest valid progress.
12. Profile-photo navigation, new-match sections, timestamps and message bubbles work on small/large phones, with keyboard shown, enlarged text, screen reader and reduced motion. Failed messages do not move a match into the conversations list.
13. Missing/stale pledge acceptance prevents approval and protected actions even via direct calls; reacceptance restores access only if all other prerequisites hold. Report categories map to pledge rules; duplicate acceptance is harmless.
14. Profile submission rejects missing, duplicate, disabled or unknown prompt references and blank/short/oversized responses. Existing approved prompt versions retain their original text. A freeform bio cannot substitute for the two required answers.

## 13. Implementation sequence

Milestone A: official native starter, auth + SMTP, locked dependencies, CI, synthetic seed users, migrations/RLS and eligibility/profile admin slice.

Milestone B: private image pipeline, Persona sandbox, human approval and reciprocal geospatial discovery with empty-state behavior.

Milestone C: atomic reactions, match outbox, Stream Expo UI, restricted provider permissions, server text sending and block/unmatch revocation. Prove the full two-phone slice before visual polish.

Milestone D: reports, moderation controls, privacy/deletion, receipts/retries, instrumentation, accessibility, TestFlight/Play test builds and review documentation.

Each milestone includes its authorization tests and docs. No production launch until vendor accounts/limits, operator coverage, privacy policies, native QA and deletion/revocation have been validated. No fixed calendar promise is implied.

## 14. Explicitly excluded V1

Subscriptions, boosts, travel mode, AI matching/coaches, compatibility percentages, social feed, events platform, video/voice calls, message attachments, read-receipt customization, sterilization/medical information, background tracking, precise public distances, race classification, inferred parenthood checks, nationwide density claims and a second chat backend.

## 15. Budget model and open external dependencies

Development can use free quotas and sandbox identity. A conditional small production beta infrastructure floor is $25/month for Supabase with EAS Free, accepted Maker chat, accepted Persona startup and Resend Free. EAS Starter brings this to $44/month before usage. This excludes moderation labor, domains, admin hosting/CI overages, AI coding subscriptions, legal/privacy work, devices and store memberships. It is not an all-in operating budget.

If chat requires month-to-month Start, that example rises to $543/month with Supabase and EAS Starter. If identity also requires the advertised $250 minimum tier, the illustrative minimum rises to $793/month and may involve annual commitment; request a quote. At 1,000 new monthly identity verifications on the General program, an assumed one billable service each would add about $500 above the free 500; confirm service counting before budgeting. Watch concurrent chat connections as well as MAU. Persona program expiry requires advance migration/upgrade planning.

Capacity example, not a vendor guarantee: 1,000 members × four 300 KB normalized photos ≈1.2 GB before originals/backups. Five MB average image viewing per member/day ×1,000×30 ≈150 GB/month. Photo delivery can drive costs before database rows do. Limit image size and measure real egress. Set budget alerts at 50/80/100% and preserve safety functions when quotas are reached.

Open external dependencies: account eligibility/approval; commercial terms and data retention; Persona post-program quote; Stream permission spike; production SMTP/domain verification; Expo credentials and store accounts; staffed moderation/contact; actual founding cohort availability. No need to postpone coding the native skeleton while applications are pending, but do not claim verified/managed production integrations from sandbox demos.

## 16. Primary sources

Pricing and capabilities checked 6 October 2026. Recheck before purchase; program acceptance is not implied.

- Expo pricing: https://expo.dev/pricing
- Expo free push service: https://docs.expo.dev/push-notifications/faq/
- Official Expo/Supabase integration: https://docs.expo.dev/guides/using-supabase/
- Supabase pricing: https://supabase.com/pricing
- PostGIS: https://supabase.com/docs/guides/database/extensions/postgis
- RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Storage security: https://supabase.com/docs/guides/storage/security/access-control
- Stream Maker: https://getstream.io/maker-account/
- Stream pricing: https://getstream.io/chat/pricing/
- Stream dating use case: https://getstream.io/chat/solutions/dating/
- Stream React Native components: https://getstream.io/chat/docs/sdk/react-native/ui-components/base-ui/overview/
- Stream authentication: https://getstream.io/docs/platform/authentication/
- Persona startups: https://withpersona.com/startups/
- Persona pricing: https://withpersona.com/pricing/
- Resend pricing: https://resend.com/pricing
- AWS moderation/pricing: https://docs.aws.amazon.com/rekognition/latest/dg/procedure-moderate-images.html and https://aws.amazon.com/rekognition/pricing/
- RevenueCat pricing: https://www.revenuecat.com/pricing
- Apple review: https://developer.apple.com/app-store/review/guidelines/
- Google child safety: https://support.google.com/googleplay/android-developer/answer/14747720
- Google testing: https://support.google.com/googleplay/android-developer/answer/14151465
- Maestro: https://github.com/mobile-dev-inc/Maestro

## 17. First coding-agent instruction

Read this entire specification. Implement Milestone A only in an isolated branch. Use official Expo/Supabase integration patterns; pin compatible versions and create AGENTS.md/CLAUDE.md referencing this document. First produce migrations, actor/permission boundaries, synthetic fixtures and authorization tests; then build native auth, eligibility and profile submission with minimal MFA-protected admin review. Keep Stream/Persona adapters mocked in test environments only and mark those integrations incomplete. Do not add subscriptions, AI matching, placeholder verified badges or relax eligibility. Return working native build evidence, test results, changed files and unresolved external dependencies. Stop before production release; do not stop after drawing screens.

## 18. Review of the supplied LinkUp prompts

Source: user-supplied Pasted text(20261006-173547).txt, containing 18 prompts from “I Built a Dating App Like Tinder with AI (Step by Step).” This review assesses the text supplied; no video, running implementation, visual-reference image or source repository was supplied or audited. These prompts show product instructions, not proof of a secure or successful production app.

### Prompt-by-prompt disposition

| Original | Decision | Application to our app |
|---|---|---|
| 1: Foundation/design | Adapt | Establish reusable design tokens, native layouts and component states. Keep email OTP; create an original Black-centered brand. LinkUp name and Tinder palette are not adopted. |
| 2: Multistep onboarding | Adapt, high priority | Clear progress, Back/Continue, field validation, saved draft and resume. Put eligibility before photos. Derive age from DOB, preserve inclusive preferences and current serious-relationship baseline; remove casual/friends/unsure paths. Do not invent global country lists. |
| 3: Tag scrolling | Use principle | A single vertical scroll surface for onboarding content; no nested same-direction scrolling. Interest tags remain optional future scope, not a prerequisite. |
| 4: Location/radius | Adapt | Ask native foreground permission only after an explanatory tap; city/ZIP fallback. Keep miles and current preference defaults. Do not silently replace them with the prompt's kilometers/25 km. |
| 5: Discovery cards | Adapt | Readable photo/card layout, Like/Pass buttons, photo-position indicators and optional restrained animation. Remove Super Like, fake stack depth and production demo people. |
| 6: Match celebration | Adapt | Celebrate a confirmed server-created mutual match, with both photos and View Match/Continue buttons. Seed synthetic mutual likes only in isolated local/staging tests. No auto-match for the first real registrant. |
| 7: Connections list | Adapt | New matches and conversations grouped clearly with unread state. No desktop discovery/chat split screen in native V1. |
| 8: Avatar clipping | Merge into UI acceptance | Verify avatars across sizes, font scaling and safe areas instead of adding a reactive patch prompt. |
| 9: Hardcoded overflow fix | Replace | Inspect measured layout and ancestor clipping. Blanket overflow-visible and exact 70 px avatars are not a universal solution. |
| 10: Messaging | Adapt | Stream-backed native UI, header, retry and accepted-message-driven list grouping. No second Supabase message store; preserve server authorization. |
| 11: Time/empty states | Use with refinement | Localized timestamps, readable older dates, hide empty new-match section and distinguish empty/error/offline states. |
| 12–13: Bubble sizing | Merge | Content-sized bubbles with bounded width, natural wrapping and accessible text. One component contract replaces repeated fixes. |
| 14: No-wrap workaround | Reject | Never force short-message nowrap by word count; it can overflow on small screens or enlarged text. |
| 15: Browser CSS | Replace | Translate intended appearance to native layout; do not paste display:inline-block, fit-content or white-space browser CSS into React Native. |
| 16: Media sharing | Defer | Conflicts with text-only V1 and adds upload, storage, moderation and abuse surfaces. File-extension filtering alone is insufficient. |
| 17: Photos/profile | Adapt, high priority | Two to six approved photos; reorder/set main/remove; approved photo navigation in discovery; validated editing and logout. No casual options or unreviewed uploads in discovery. |
| 18: QA audit | Strengthen | Run focused native, permission, concurrency and outage checks at each milestone. Preserve push settings and SMTP auth behavior; do not add unsolicited per-message emails. |

### Concrete UI requirements added from this review

Onboarding steps: eligibility → profile basics/prompts → photos → partner/age/location preferences → identity check → review submission. Show a named step and progress such as “Photos · step 3 of 6.” Save after successful Continue; Back preserves saved values; upload status survives navigation. Show save failures before leaving the step. Route returning users using server lifecycle AND completion state, not a local completed boolean. Approved users reach the app; pending users see review status; unfinished users resume; restricted users reach permitted support/settings screens. Persist only necessary private fields and clear cached drafts on logout/deletion.

The Community Pledge appears as a clearly labeled separate acknowledgment inside the eligibility step, with accessible full text and no preselected checkbox. It does not add a seventh onboarding screen.

Profile photos: the first approved ordered photo is primary. Show approved-photo count indicators and explicit previous/next controls that screen readers can use. Photo changes obey current revision/review rules. Do not remove the existing approved primary from storage until replacement references and active review state are reconciled. Pending/rejected photos remain visible to the owner with status, never to potential partners. No face-crop guarantee is implied by image cover mode: choose a portrait region or neutral fit treatment that preserves the subject; do not add AI cropping to V1.

Match celebration: present once per confirmed match/device presentation state, with a stable match ID so duplicate socket events do not stack modals. If channel creation is pending, show “Your connection is getting ready” and disable messaging until ready. Continue returns to the saved discovery queue. Respect reduced motion; do not imply a match from an optimistic Like animation.

Connections: “New matches” means zero accepted messages from either member. The first server/provider-confirmed accepted message moves the pair into Conversations for both participants. Pending/failed sends do not move it. Reconcile grouping on app resume from confirmed channel data, rather than relying on client counters. Filter closed/restricted connections. Hide an empty new-match row. Outgoing likes remain a separate optional section within Connections.

Chat: reuse the pinned Stream SDK's message components for list rendering/status and theme them; use our server-authorized composer. Show pending/sent/failed states without claiming read receipts are enabled. Never clear a draft until accepted or safely preserved for retry. Bubble target maximum is 80% of available message-row width; let smaller content size naturally. Treat this as a native layout requirement, not exact CSS. Permit full wrapping at larger font scales; no fixed heights, artificial minimum width or ellipsis that hides message content. Test short text, long unbroken strings, emoji, multiline text and keyboard appearance.

Time display: store UTC, display in viewer locale/time zone. Today shows local time; recent days show weekday/time; dates older than the current week show an explicit date so messages months apart are distinguishable. Screen readers receive fuller date/time text. An empty conversation says “Send your first message”; a loading or failed connection uses a different state.

Design tokens: define semantic color roles (background, surface, primary, text, muted text, error, success), spacing, typography and radius once. Add reusable Button, Field, StepHeader, ProfileCard, Avatar and EmptyState. The final brand name/palette are unresolved product choices; keep them centralized and configurable. Use native safe-area/keyboard behavior and enlarged text testing instead of promising desktop responsiveness for the dating app. Existing web admin still needs responsive layouts.

### Reusable coding-agent prompt pattern

For every task: read this spec and repository instructions; name the milestone and acceptance criteria; reuse the selected vendor component; implement the smallest complete behavior; keep authorization on the server; handle loading/empty/error/offline states; run the relevant tests; return changed files, native evidence and limitations. Do not silently add scope, change eligibility or replace an SDK after a styling issue.

Recommended task prompts, to use after their dependencies exist:

1. **Resume onboarding:** Implement the six-step native onboarding using existing auth/state/schema. Add owner-only draft persistence with revision checks, Back/Continue and server-state routing. Keep eligibility before photos. Demonstrate kill/relaunch, stale save, declined permission and pending-review routing; do not let draft edits set approval.
2. **Approved photo navigation:** Implement owner photo ordering/removal and primary selection through existing revision APIs. Discovery receives only approved photo references. Add accessible photo indicators/controls. Verify upload/rejection/reordering/deletion never reveals an unapproved photo.
3. **Discovery continuity:** Restore unanswered assigned cards after app restart and recheck current candidate eligibility. Use server daily assignments, Like/Pass buttons and existing idempotent reactions. Do not turn a displayed card or closed app into a Pass, add Super Likes, or show nonexisting stack cards.
4. **Confirmed match presentation:** Show the match celebration only after a server-confirmed unique match. Support provisioning/ready states, reduced motion and duplicate-event suppression. Continue preserves discovery; Message opens only an authorized ready channel. Use synthetic fixtures in isolated tests only.
5. **Native connections/chat polish:** Theme existing Stream native components and use the authorized composer. Implement new-match/conversation grouping from accepted messages, local date labels, content-sized wrapping bubbles, failed-send retry and honest empty states. Demonstrate small phone, enlarged text, keyboard and reconnect; do not add attachments or a second message store.
6. **Milestone QA:** Execute the affected acceptance checks on both native platforms and authorization tests via direct APIs. Include interrupted onboarding/discovery, concurrent mutual likes, duplicate events, block/unmatch with an open session and vendor failures where relevant. Diagnose shared layout constraints before changing styles; fix root causes and rerun focused checks.

Technical references for this adaptation: React Native layout https://reactnative.dev/docs/flexbox and Text https://reactnative.dev/docs/text; Stream native message UI https://getstream.io/chat/docs/sdk/react-native/ui-components/message-item-view/. Verify the chosen SDK version's component APIs before code changes. The review does not change vendor choices or constitute implementation of these screens.

## 19. Accepted community requirements and fast-build execution

### Community Pledge v1

Display title: “Our community, our commitment.”

“I will be truthful about my identity, relationship history and decision not to become a parent. I will respect other members' boundaries and accept a no. I will not pressure anyone to change their childfree choice. I will not harass, threaten, discriminate, impersonate others, solicit money or send sexual content. I will use reporting when something is wrong and understand that violations can lead to removal.”

Require a separate unchecked acknowledgment: “I agree to the Community Pledge.” Link to full community standards and appeal/support instructions. Do not claim the pledge guarantees good behavior or replaces moderation. Keep marketing consent separate and optional.

Report categories: eligibility misrepresentation; impersonation/scam or money solicitation; harassment/discrimination; sexual content; threats/safety; suspected underage member; other. Publish explanatory standards for these categories. Report evidence and moderator action connect to the violated standard/pledge version. The reporter receives a receipt and generic status; no private details of the other member's sanction are disclosed. Members can report without blocking, block without reporting, or do both.

### Structured profile prompt catalog v1

Require two distinct prompt answers, each 20–200 characters after trimming whitespace. Bio is optional; not required instead of or in addition to a third structured response. Let members choose their cultural expression rather than assuming one shared Black experience.

| Stable id | Prompt text |
|---|---|
| life_together | A life together without parenthood would include… |
| tradition | The tradition I'd bring into our relationship is… |
| cared_for | I feel most cared for when… |
| ordinary_sunday | An ordinary Sunday with me looks like… |
| building | The life I want to build with someone is… |
| culture | A part of my culture I'd love to share is… |
| partnership | A strong partnership means… |
| joy | Something that always brings me joy is… |
| auntie_asks | When Auntie asks ‘So when are y'all having kids?’ I say… |
| rather_raise | Things I'd rather raise than children… |
| cookout_dish | The cookout dish I'm trusted to bring is… |
| dink_vacation | Our future DINK vacation is… |
| reunion_shirt | The family reunion T-shirt I'd design for us says… |
| college_fund | Instead of a college fund, I'm funding… |

All start at version 1. Catalog changes create a new immutable version; existing approved profiles render the original referenced prompt. Disabling a prompt prevents new selection without corrupting previously approved profiles. Submission accepts an already-selected retired version only if it belongs to the member's existing approved revision; otherwise require an enabled version. No AI-written profiles, hidden personality scores or invented compatibility claims.

### Decisions frozen for the first build

Native iOS/Android, Expo/TypeScript, Supabase, Stream, Persona, email OTP, free mutual-match text chat, Atlanta founding configuration, two required prompt answers, two to six approved photos, five new daily assignments and the existing eligibility contract. No Facebook/SMS dependency or livestreaming in V1. Empty discovery stops new cards and explains availability; it does not pause the account, widen preferences or disable existing permitted conversations. Name/palette remain configurable and cannot block functional development.

### What must become executable next

The schema in this document describes tables, not completed SQL migrations. API paths describe contracts, not implemented endpoints. Selected providers describe architecture, not approved production accounts. The next work is code and validation, rather than another large product document.

| Priority | Deliverable | Completion evidence |
|---|---|---|
| P0 | Running repository and native dependency integration spike | One clean clone installs; builds open on iOS and Android; auth redirects work; Stream and Persona native/hosted integration paths verified with synthetic accounts. Record exact versions/lockfile. |
| P0 | Executable migrations and permission matrix | A fresh local database reconstructs all tables/constraints/indexes/RLS; owner/nonowner/moderator/admin checks pass; no manual production SQL required. |
| P0 | Typed request/response contracts and native/server shared validation | Every initial endpoint has request schema, response schema and error union; mobile compiles against those contracts; server remains authoritative. |
| P0 | Complete first milestone tasks | Each ticket lists dependencies, affected routes/tables, success/failure states and tests. Implement auth → eligibility/pledge → draft/profile → review rather than all screens at once. |
| P1 | Provider credentials and production eligibility | Correct account owners, secrets held outside repository, approved quotas/terms, webhook signing, SMTP verified domain and native store credentials. Sandbox integrations visibly marked incomplete. |
| P1 | Narrow design system and representative screens | Token-based native components plus onboarding/discovery/chat examples on small and large phones; choose final brand independently of core implementation. |
| P1 | Synthetic fixtures and smoke runner | Eligible pair, incompatible age/radius, pending, suspended, blocked and empty-pool cases; one repeatable command sequence verifies the critical slice. |
| P1 | Release and recovery configuration | Distinct environment configs, default-off signup/discovery rollout switches, migration deployment sequence, operator access, backup/recovery proof and native test distributions. |

Permission matrix must specify each resource/action for anonymous, member-owner, other member, moderator and admin. Regular members cannot write lifecycle, approvals, verification outcomes, prompt catalog, pledge versions or moderation decisions. Moderators receive only necessary review/report actions; their privileges are server-owned, never editable profile metadata. All privileged work is audited.

Choose Supabase Edge Function entrypoints for the application API and add a typed client wrapper mapping the logical paths above to deployed function names; do not build another custom backend merely to preserve REST-looking paths. Postgres RPC handles transactional matching/eligibility rules. Background work uses a single scheduled worker path with an outbox; never run two competing workers without claim/lease semantics. Implement retry backoff, attempt cap and operator-visible dead-letter state. External calls stay outside SQL transactions.

Before reaction/match implementation, use the same canonical-pair transaction lock for Like, Pass, Block and Unmatch. Recheck both users' status and block edges after acquiring the lock. This prevents a concurrent Like from recreating a connection while Block closes it. Database commit is the authorization boundary; provider revocation uses the existing confirmed/pending safety behavior. Test these races explicitly.

Location assumption: city/ZIP centroids and rounded foreground points provide approximate distance, not proof of a person's exact position. Apply both radii to the stored coarse points, label discovery proximity approximately and keep coordinates private. Seed the founding metro/city/ZIP reference data with documented license/provenance; do not let a freeform city string become an unvalidated point. Exact GPS tracking and national geocoding scope are not required for this build.

### First milestone tickets, in order

1. Bootstrap native app and minimal web admin, environment validation, version pinning and CI. Reuse official starters; skip unused features. Verify development builds, not only Expo Go or a browser preview.
2. Apply migrations, RLS, role assignment and synthetic fixtures. Document the exact local setup/reset/test commands in README; prove owner/nonowner access through direct calls.
3. Implement email OTP, session restore/logout and server-derived actor identity. Include resend, expiration and failure states; scrub sensitive logs.
4. Implement eligibility plus pledge version/acceptance and required profile prompt catalog. Validate on server and enforce prerequisites; duplicate acceptance must be idempotent.
5. Implement saved onboarding drafts, profile revision submission and tiny moderator queue. Moderator decisions cannot be forged by the mobile client. Photo/identity integrations are pending prerequisites until Milestone B and must not create fake verified/approved labels.
6. Review changes independently, repair relevant failures, run milestone tests and commit a reproducible checkpoint. Next milestone begins from that checkpoint.

For each ticket, the coding agent returns changed files, actual test/build output, limitations and external dependencies. Do not require a full business plan, comprehensive redesign or extra analytics vendor to finish a ticket. Either Claude Code or Codex may implement; the other reviews the completed change. Keep one writer per branch and avoid competing schema edits.

### Small additional release contracts

Define privacy-safe push notification ownership: our notification worker is the only Expo delivery path for match/message alerts; turn off any duplicate vendor notification path. Worker checks current match/block/status and notification preferences immediately before sending, uses generic text and deduplicates by provider event or match ID. Retire invalid device tokens and rebind tokens on login/logout. The Stream webhook is signature-validated and deduplicated before creating a message-alert job. No message-content copies in notification logs.

Rollout controls are server-owned. Signup/discovery switches may stop new admission/exposure during an incident; they cannot disable reporting, blocking, support or deletion. Do not hide unfinished functionality from app reviewers. Keep production secrets outside client bundles and prohibit local/staging synthetic users from production import. Native coding can proceed while vendor applications are pending, with incomplete integration status tracked explicitly.

Build readiness does not mean zero further engineering decisions. Agents may choose routine implementation details within this contract, document meaningful choices and flag conflicts; they must not change eligibility, trust claims, paid access or scope silently. Remaining provider permissions and migration behavior must be proved with tests, not assumed from this specification.
