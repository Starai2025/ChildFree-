# Public beta security slice — October 16, 2026

Goal: enforce the current six eligibility answers, record explicit agreement acceptance, restrict the 50-member beta to founder-invited accounts, and replace the shared review passcode with founder Auth plus TOTP MFA.

Owner: Codex is the sole migration/backend writer. Claude retains member screen and stylesheet ownership. Member app changes are limited to agreement-gate integration; no stylesheet changes. A6 reviews the fixed diff read-only before publication.

Inputs: current Render branch, public-beta SQL/RLS, onboarding sync, review page and admin-review Edge function. Never publish to Sites, modify main, put service credentials in the frontend, or infer founder privileges from user-editable metadata.

Acceptance: missing/false/nonboolean eligibility denied on submission and approval; agreement versions and server timestamps cannot be member-forged; uninvited/unconfirmed/revoked members cannot be approved or use discovery/chat/private photos; approvals capped atomically at 50; only an explicitly provisioned founder with a live AAL2 session and verified factor can review or manage invitations. Old passcodes fail closed. Audit decisions and founder actions by Auth UUID.

Rollout: deploy fail-closed Edge authorization, apply migration, provision the founder's confirmed Auth UUID through the dashboard, then publish frontend after tests. Existing submitted/approved profiles return to changes requested for explicit acceptance and invitation review; acceptance is never backfilled. Founder enrolls/scans the MFA secret directly. No production fixtures or automatic invitation roster.

Required checks: routing, onboarding, photos, historical and new SQL security suites, Edge authorization tests, focused agreement/review UI checks, git diff check and npm run check. Record hosted checks separately from local evidence. No native implementation is part of this slice.

## Implemented behavior

- The server checks all six current answers as JSON booleans `true`, adulthood and profile completeness at submission AND approval, including service-role updates. Never-married is not added.
- Acceptance is authenticated and explicit: six answers, Terms acceptance, Privacy acknowledgement and Community Pledge acceptance. The private, member-unwritable record contains account UUID, server timestamp, eligibility snapshot, document/pledge versions and SHA-256 of the published legal documents (canonical UTF-8/LF). A retried acceptance preserves its original timestamp. Changing the legal documents requires a new version/migration and explicit reacceptance; never backfill records.
- Only invitations for a confirmed account email permit approval. The invitation binds to that Auth UUID; revoking it blocks member cards, direct match reads, chat/typing/date-plan access and signing other members' photos. Own drafts/photos, personal reaction history, blocks and reports remain account controls. Previously issued signed photo URLs can remain usable until expiry; revocation prevents new API access/signing.
- A private counter changes atomically with approval, departure from approval or profile deletion. At most 50 profiles can hold approved status; revocation conservatively retains the slot until status changes/deletion.
- Founder privileges come only from a private allowlist. Each review/invitation action requires a confirmed Auth account, signed AAL2 token, verified TOTP factor and existing unexpired Auth session. Decisions identify the verified actor, and other founder operations are audited. A1 login and the retired passcode cannot access review data. SQL-editor/service credentials remain privileged operational trust boundaries.
- Consent pins the initiating account token, aborts on account changes and cannot submit the next account's draft. Founder UI clears cached data/late responses on identity changes or MFA downgrade; enrollment QR codes are cleared/discarded on account changes. Styles and member layout are unchanged.

## Local evidence

Routing 17, onboarding 9, photos 11, baseline profile SQL 8, matching/chat SQL 18 and date-planner SQL 7 checks pass. The legacy-intake security suite, six new integrated security groups, eleven combined Edge/Google Places tests, fresh-plan rendering test and three security UI groups pass. `git diff --check` passes. A6 accepted source tree `dc80b32fc189e107fbe3555323462739c68f8705` after the direct-match-read and account-switch races were repaired.

`npm run check` was attempted and stops at workspace typechecking because `tsc` is unavailable in this Windows checkout; full workspace installation previously failed on Windows symlink permissions. This is not a passing full workspace/native/provider check. No mobile code changed. Deno runtime execution is restricted on this host; Edge handlers were compiled and tested through esbuild/tsx VM harnesses instead.

## Hosted rollout evidence

Migration 202610160001 was applied transactionally through the signed-in SQL editor, with the complete source recorded in `supabase_migrations.schema_migrations`. Editor source length/checksum matched the tested file before execution. Preflight found zero submitted/approved profiles, so no existing reviewed members were demoted. Postflight confirmed the migration record, zero approved slots, zero manufactured acceptance records and zero browser-executable public definer/trigger functions.

The matching `admin-review` source was deployed through the Edge editor after its source checksum matched the local file. `node tests/no-seeds-security-live.mjs` passes: missing login, retired passcode header and malformed JWT return 401/no-store; anonymous consent/founder RPCs return permission denied; REST rejects `app_private` with PGRST106. These negative probes create no accounts, invitations, decisions, agreements or member fixtures.

Founder provisioning/enrollment is intentionally pending: one confirmed founder account exists for the founder's supplied email, and it has no verified TOTP factor. `supabase/operations/bootstrap_founder.sql` grants only that existing account's UUID, after explicit confirmation of the access grant. It neither enrolls MFA nor accepts agreements or approves/invites members. Starr must scan her own authenticator QR and enter the code directly; never send a secret/code to an agent. Until then, founder review remains closed. Positive founder AAL2 and two-member hosted flows remain unverified.
