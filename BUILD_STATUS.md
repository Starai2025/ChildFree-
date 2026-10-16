# Build status

## Current public web beta — October 15, 2026

October 16 security slice: server-enforced six-answer eligibility and adulthood, immutable versioned agreement records, confirmed-email invitation approval and atomic 50-member cap, named founder review with TOTP AAL2/live-session enforcement. Migration 202610160001 and the matching Edge update are live; anonymous/legacy-passcode probes fail closed. Founder allowlist provisioning and hands-on authenticator enrollment still await the founder. See [security implementation and evidence](docs/NO_SEEDS_SECURITY_20261016.md). Member layout/styles remain Claude-owned; Codex added only the submission agreement hook.

The active member app is `prototype/no-seeds-public-beta/dist`, hosted at https://noseedsdatingsite.com (Render backup https://no-seeds-dating.onrender.com). Render auto-publishes `handoff/free-midnight-claude` on every push, without a build or environment variables. Do not deploy to ChatGPT Sites or change main. Always pull with rebase and run the routing, onboarding, photo and SQL suites before pushing. Claude owns member screen layout/styles; Codex owns the assigned backend slice.

The founder's handoff baseline `4130e35` includes sign-in routing, review/status/legal screens, My Profile and Discover fixes. Claude's subsequent `66ac3bd` and `83bcf30` add signup Back navigation, Google Maps credit and signup styling. Backend migrations 202610150001–004 are applied live and recorded in migration history. The advisor has zero errors and one remaining warning for Pro-only leaked-password protection. Private API schema exclusion was verified with PGRST106. See [October 15 delivery evidence](docs/NO_SEEDS_BACKEND_DELIVERY_20261015.md), [planner rollout](docs/NO_SEEDS_GOOGLE_PLACES.md) and [SMTP setup](docs/NO_SEEDS_SMTP_SETUP.md) for the remaining provider and member-session verification.

## Earlier native/demo checkpoint (historical)

Current scope: user-authorized MVP1 synthetic demo, October 7, 2026. Original onboarding baseline is committed as `7eb64dd` in `Starai2025/ChildFree-` main. The ZIP's historical review evidence remains in the earlier verification documents; it is not evidence of current hosted/native behavior.

## Current implementation

Complete local demo experience: welcome, six-step onboarding and resume, simulated review, reciprocal fixture discovery, mutual matches, text conversations/retry, profiles/preferences/settings, block/unmatch/report, fixture export/deletion/reset and a local review console. Visual direction adapts the user's LOML screenshot with original illustrated assets. All demo people, outcomes and activity are labeled synthetic. Production-stage routes disable demo access.

The real email OTP/eligibility/pledge/structured-profile slice remains at `/member`. Its SQL/API behavior has not been changed; real profile submission still fails closed. The separate Vite admin website describes the demo tools and has no live admin access. No real members are approved, discoverable or messaging.

See docs/DEMO.md for the implementation task card, walkthrough, isolation boundaries and validation. Agent work should start from this checkpoint, not regenerate F01. The shared product specification remains the live-app contract; the user's current demo scope is the explicit local-build exception.

## Remaining live gates

The separately uploaded Claude prototype and planning documents are now included as reference material; see docs/CLAUDE1_IMPORT.md. The supplied decision document proposes Supabase Realtime chat and manual beta review. Importing it does not implement those changes or supersede the evidence for the current demo. The original incoming build status is archived under docs/imports/claude1 rather than replacing this checkpoint.

Hosted Supabase reset/deployment and JWT checks; real OTP/SMTP; Terms/Privacy acceptance audit and owner-reviewed pages; native secure-session/lifecycle/accessibility and device launches; signing/store accounts; real admin MFA/roles/audit; private photos and normalization; Persona start/signed webhooks; PostGIS and discovery; transactional matching/outbox; restricted Stream sending/revocation; report operations; deletion/export jobs; push; recovery; staffing and staged release QA.

A browser demo, local SQL tests and JavaScript exports do not complete those gates. No production release, paid vendor commitment or real-member beta has occurred.

## Local evidence

Latest browser refinement: founder renamed the app FREE MIDNIGHT and supplied its crescent-heart emblem and welcome copy. The three review screens now use bolder bundled DM Sans/Lora, larger labels and deep pigment burnt sienna `#8A3324`. Existing functional and isolation checks pass. Other screen redesign and source publication to main still await founder approval; see docs/FREE_MIDNIGHT_REFINEMENT.md.

Newest browser presentation checkpoint: Native Dating / Midnight Luxe, using the founder's supplied board and five locked colors. Welcome, Discover and the Match dialog now share scoped tokens, a serif wordmark with gold heart, original synthetic hero photography, terracotta pill actions and ivory/emerald surfaces. Other app screens await screenshot approval. Existing eligibility, optional compatibility questions, filtering/matching, messaging and local demo isolation are preserved. This browser change does not modify Expo or provider logic. See docs/NATIVE_MIDNIGHT_LUXE.md for screenshots, validation and the approval gate; public main remains unchanged.

Local review candidate: the user requested the ten-question compatibility section in the browser app, then required seeing the full demo before a GitHub push. The Claude source and generated demo copies now include optional one-at-a-time questions, draft persistence/retry, profile editing and exact shared-answer summaries. Previously saved profiles remain usable without invented answers. The shipped browser workflow and 36 repository tests pass. Expo/SQL/provider code and original ranking/filter rules are unchanged. This candidate has not been pushed; see docs/COMPATIBILITY_QUESTIONS.md.

The redesigned Claude interface also has an interactive browser demo (`prototype/web-mvp1/demo.html`) and self-contained offline copy (`demo-standalone.html`). Its dedicated local adapter is present only in those generated copies. At the initial browser-delivery checkpoint, original Claude `index.html`, Expo, SQL and provider behavior were unchanged. The current local questionnaire extension is described above. The public GitHub origin was verified; CDN endpoint access is blocked by this environment's proxy. See docs/CLAUDE_BROWSER_DEMO.md for the initial delivery links and limitations.

The user requested a visual redesign of the imported Claude prototype. That separate HTML now uses the supplied Figma screenshot's orange/white direction, with a standalone static design preview and isolated synthetic browser checks. The Expo demo and real provider code are unaffected. The hosted Claude artifact has not been updated; see prototype/web-mvp1/README.md.

32 tests, all workspace typing/lint, Deno Edge typecheck, admin build, original onboarding browser regression, full synthetic demo browser walkthrough, production-stage route guard and iOS/Android JavaScript exports pass. The demo browser validates zero external requests, its downloaded synthetic export, draft preservation and failed-storage recovery. Independent A6 review accepted the repaired implementation. Actual Metro browser and Vite startup checks pass. Tested cloud install/start instructions are saved as a configuration draft requiring Review/Save and Publish. See docs/DEMO.md for the evidence and limits.
