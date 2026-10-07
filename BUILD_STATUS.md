# Build status

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

The redesigned Claude interface now also has a genuinely interactive browser demo (`prototype/web-mvp1/demo.html`) and self-contained offline copy (`demo-standalone.html`). Its dedicated local adapter is present only in those generated copies. Tests of the shipped files pass onboarding/submission/simulated approval, mutual matching, send/simulated reply, reload persistence, reset, responsive discovery and direct offline file opening. No external provider requests occur. Original Claude `index.html`, Expo, SQL and provider behavior are unchanged. The public GitHub origin is verified; CDN endpoint access is blocked by this environment's proxy. See docs/CLAUDE_BROWSER_DEMO.md for delivery links and limitations.

The user requested a visual redesign of the imported Claude prototype. That separate HTML now uses the supplied Figma screenshot's orange/white direction, with a standalone static design preview and isolated synthetic browser checks. The Expo demo and real provider code are unaffected. The hosted Claude artifact has not been updated; see prototype/web-mvp1/README.md.

32 tests, all workspace typing/lint, Deno Edge typecheck, admin build, original onboarding browser regression, full synthetic demo browser walkthrough, production-stage route guard and iOS/Android JavaScript exports pass. The demo browser validates zero external requests, its downloaded synthetic export, draft preservation and failed-storage recovery. Independent A6 review accepted the repaired implementation. Actual Metro browser and Vite startup checks pass. Tested cloud install/start instructions are saved as a configuration draft requiring Review/Save and Publish. See docs/DEMO.md for the evidence and limits.
