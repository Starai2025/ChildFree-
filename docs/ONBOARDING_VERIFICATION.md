# Codex onboarding verification

Checkpoint: F02 plus B01/B02/U02 first slice. Base: 5b99993. No external deployment or vendor purchase.

## Executed checks

| Check | Result and scope |
|---|---|
| npm run check | Passed: all workspace TypeScript/lint, domain + SQL + Edge-handler tests, Deno typecheck, admin production build |
| npm test | 22 passing tests; no skipped tests |
| SQL migration | Rebuilt in actual PostgreSQL via PGlite; all eight private tables have RLS; direct raw/table/private-helper access denied to member roles |
| SQL authorization/state | Missing/anonymous sessions, self-approval fields, foreign actor fields, stale policy/pledge, nonadult/incompatible eligibility, stale drafts, invalid/disabled/duplicate prompts and missing submission prerequisites denied; own snapshots and corrected eligible answers work |
| Pledge/catalog | Duplicate acceptance/unchanged attestation retry idempotent; content must use new versions; published pledge updates require reacceptance |
| Edge handler | Missing/invalid/anonymous session denial, bounded input, strict actor/approval allowlist, CORS denial, CAS error mapping and redacted raw errors tested with an isolated provider adapter |
| npm run check:edge | Passed locally against pinned Deno 2.9.6 and npm-installed modules |
| npm run test:ui | Passed in Chromium using Expo web at 390×844: reload/reset, explicit gender, saved draft resume, Back save, updated-pledge unchecked acknowledgment, complete-profile continuation to blocked photos stage |
| Expo dependency check | SDK-compatible installed dependencies passed; offline mode warns that external compatibility data was unavailable |
| iOS/Android exports | Passed: native JavaScript bundles. These are not native build/launch evidence |

Browser fixtures use a synthetic session and intercepted API responses. They prove client behavior, not production JWT verification or hosted provider access. The browser test screenshot is docs/evidence/onboarding-web-fixture.png and contains only fixture data. Its photo-stage message explicitly states unfinished requirements.

SQL tests emulate auth.users/auth.uid()/auth.jwt() in an isolated test harness. Hosted Supabase/PostgREST behavior, SQL permissions in the target project's actual defaults, Edge deploy bundling and real auth gateway access must still be tested. No PostGIS/geographic feature has been added yet.

## Repairs during verification

PostgreSQL execution caught ambiguous function-variable names; those were repaired and all SQL paths retested. A schema refinement was corrected to reject incomplete prompt arrays without throwing. React effect usage was repaired to keep async SDK calls outside auth callback locks.

Independent A6 review requested two UI fixes: explicit reload/remount and current-pledge checkbox reset; no silently preselected gender. Both are repaired and covered by the browser regression flow. Development-client dependency is now installed; this completes configuration preparation only.

The bundled serverless browser extractor's attempt to change archive ownership failed in this managed environment. The test launcher now extracts into a task-owned directory without ownership changes and sets its font configuration there. The subsequent browser flow passed. No sandbox restrictions were disabled or elevated.

## Evidence limits and next gates

No hosted Supabase account/credentials, deployed function, real SMTP delivery, Persona or Stream integration, actual native session-storage/keyboard/lifecycle tests, signed builds or device launches. Native device accessibility remains unverified. CI is committed but has not executed on GitHub because no remote is configured.

Full schema, admin/MFA review, photos/preferences/identity, discovery, matching/chat, reporting, block/deletion/export and release checks remain outstanding. Profile submission deliberately always denies approval prerequisites. This is not a completed Milestone A or a live-member beta.

## Final checkpoint

A6 independently accepted the locally verifiable source at e6343951e55da8addf9f2e51489a45d895ec8025. Both UI findings were repaired; no blocking source findings remained. Reviewer read actual source and supplied evidence; it did not rerun installs/builds. Its approval explicitly excludes native/hosted-provider evidence, completed Milestone A, real-member admission and release.

A separate clean local clone at that commit passed `npm ci --offline` (859 packages) and `npm run check`: 22 tests, typing, lint, Deno check and admin build. The reviewed implementation was fast-forwarded into main. Subsequent changes only record this evidence.

Install warnings included SDK-compatible ESLint 9 and a transitive uuid 7 dependency marked deprecated upstream. Follow official Expo tooling upgrades in a later maintenance ticket; do not force incompatible replacements to suppress warnings.

