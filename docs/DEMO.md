# MVP1 synthetic demo

User-authorized implementation on October 7, 2026. Baseline imported from the supplied ZIP and pushed as `7eb64dd`. Source reference: the supplied LOML screenshot; no editable Figma file or asset license was inspected. This demo uses original components and six original geometric illustrations.

## Task card

Goal: a complete synthetic app journey within the agreed two-hour implementation target. Owner: Codex, one writer for source, manifests and lockfile. Reviewer: independent read-only A6 review of the fixed implementation commit. Reuse the existing cloud checkout; no worktree is needed. Current user authorization permits demo source/test/dependency changes and pushes to `Starai2025/ChildFree-` main. No production deployment or paid services are included.

Owned paths: mobile demo routes/components/store/assets, shared demo-domain module, admin preview, lockfile/manifests, focused tests, documentation. The original live onboarding domain/API/SQL behavior stays intact. All mock outcomes are explicitly synthetic.

## Features

- Welcome page and Discover/Connections/Profile/Settings navigation.
- Six onboarding steps: adult eligibility and distinct pledge; two structured prompts; 2–6 ordered illustrative photos; inclusive partner genders/age/radius/city; labeled identity simulation; pending review and simulated approval.
- Private local draft save/resume, including incomplete profile drafts, Back/Continue, save-before-navigation and persistence-error notices.
- City-centroid fixture distances, reciprocal age/gender/radius checks, a maximum of five new assignments per UTC demo day, resumable unanswered cards, Like/Pass and honest empty states. No automatic filter widening.
- Mutual likes produce one stable local match. Amara's queue includes Imani, Malik and Theo; Malik has a seeded outgoing like to Amara so the first walkthrough can create a match. This is an explicitly synthetic scenario, not an automatic match for a real registrant.
- New Matches and Conversations group by accepted local messages. Failed sends remain recoverable and do not move the connection until retry. Text-only bubbles, local timestamps, unread markers, fixture-user switching and explicitly simulated replies.
- Block/unmatch hide the connection and prevent local messaging; unblock does not revive a closed match. Pause removes discovery participation while preserving approved existing chats. Suspended/deleted fixtures cannot access conversations.
- Independent report and block actions, category/detail and synthetic receipt, local report review and decision history.
- Export of the current fixture's profile, its sent messages and submitted reports. Browser export downloads JSON; native uses the platform share sheet. Deletion clears the selected synthetic profile and associated local conversations; reset restores the original fixtures.
- Demo console under Settings has approve/request-changes/suspend/restore, prerequisite checks and local review reasons/timestamps. It is a development fixture tool. The separate Vite admin site remains a descriptive landing page without member access.

## Isolation and persistence

`packages/domain/src/demo.ts` contains pure synthetic state and transitions. It does not import live auth or provider clients. `apps/mobile/src/demo/store.tsx` hydrates schema-validated AsyncStorage data and serializes mutations, persisting before committing UI state. Auth/session storage remains separate. Unknown versions or inconsistent references fall back to fresh fixtures with a notice.

All demo routes are under `/demo`; production-stage route access redirects to `/member`, and the production landing page renders real onboarding. The real onboarding screen moved unchanged from `/` to `/member`; the browser regression now enters it through the welcome page. Real `profile_submit` continues to deny missing prerequisites.

Illustrations are selected from presets; there is no image upload, photo normalization, EXIF stripping, actual verification, managed chat, push delivery, human moderation, live export/deletion, or native signing in this demo. Approximate distances use synthetic city centers, not a location permission or live geocoding service. All fixtures are local, and no real data should be entered.

New dependencies are AsyncStorage 2.2.0 and @expo/vector-icons 15.0.2. The Expo SDK 57 bundled compatibility manifest supplied these versions; Expo installation used offline compatibility resolution because the environment's egress proxy blocked Expo documentation/compatibility hosts. Package registry TLS/integrity checks remained enabled. The root lockfile records exact artifacts. External compatibility data was not available; native JavaScript exports and local checks are separate evidence.

## Walkthrough

1. Open the root welcome screen and select Explore the demo.
2. Pass on Imani, then Like Malik. See the labeled mutual match and open the conversation.
3. Test next send failure, send a message, retry, and simulate a reply. Open Connections and verify the conversation grouping persists after reload.
4. Report Malik without blocking. Then block, inspect Blocked Users, and unblock. The old match stays closed.
5. In Settings choose Start a new demo profile. Incompatible eligibility must stop Continue. Complete the six steps with invented data and preset illustrations. Save for later and reload during the profile step.
6. Submit and approve the fixture in the simulated console. Discover should become available only after prerequisites pass.
7. Pause/resume. Export the fixture JSON, delete the fixture with explicit confirmation, and verify discovery is unavailable. Reset to restore the initial state.
8. Set a one-mile radius, Pass on the same-city fixture, and inspect the honest empty pool.

## Validation commands

```sh
npm ci --cache /workspace/scratch/npm-cache
EXPO_NO_TELEMETRY=1 npm run check
EXPO_NO_TELEMETRY=1 npm run test:ui
EXPO_NO_TELEMETRY=1 CI=1 npm run export:native --workspace @black-childfree/mobile -- --max-workers 2
```

The UI runner records current screenshots under `docs/evidence/demo`. It asserts that the demo makes no external requests. Database tests use isolated PGlite/auth emulation; the original browser onboarding uses synthetic Supabase interception. These checks do not prove hosted integrations or native device behavior.

Live follow-up remains hosted OTP/API, roles/MFA, private photos, Persona signatures, PostGIS, transactional matching/outbox, restricted Stream chat/revocation, reports/operators, cleanup jobs, push, native builds/device checks, legal acceptance and release operations. Existing product exclusions apply: no payments, AI, voice/video calls, media messages, extra date scheduling or dating-history features.

## Current verification evidence

- Clean frozen-lockfile install and all workspace typecheck/lint pass.
- 32 Node tests pass with no skips: 22 original domain/SQL/Edge tests plus 10 demo behavior tests.
- The original browser onboarding regression and the full synthetic demo walkthrough pass in Linux Chromium at 390×844. The demo test validates a downloaded own-data JSON export and zero external requests.
- iOS and Android JavaScript/Hermes exports pass with the new storage/icon dependencies. No signed/native launch evidence is claimed.
- Production-stage guard, clean refresh, development-server startup and independent review are recorded below when completed.

The first browser retry found that its static server did not resolve the new /member route on reload. The runner now resolves Expo's .html routes; the regression passes. Demo text locators now exclude retained inactive Stack screens. Screenshot inspection caught intrinsic image heights and a clipped heading; responsive image sizing and a shrinking heading repaired them, and the full browser flow was rerun.

The production-stage test exposed a pre-existing configuration-validator defect: malformed/empty URLs could throw during Zod refinements instead of returning setup-required fields. URL refinements now handle invalid syntax and allow loopback HTTP only in development; regression cases cover empty/malformed URLs and reject FTP loopback. No SQL, auth SDK, actor permissions or live submission gates were relaxed.

The first stage-switch export also reused stale public-environment transforms. The UI/production-stage runners explicitly clear Metro's transform cache when changing stage/public configuration; the separate output directories prevent mixing artifacts. Restart Metro with --clear after changing those values. These rebuilds are necessary to validate the selected environment, not repeated unchanged builds.

The production-stage guard now passes in an actual rendered production export: the root has no demo entry, and a direct /demo/review request redirects to /member. The tested reusable installation script refreshes 863 packages with npm ci and passes the complete 32-test/check command, leaving the committed lockfile unchanged.

Independent review of implementation commit `2f0b57d` requested one repair: onboarding's header Back discarded an unfinished form. The header now uses the same awaited persistence operation as Save for later, disables while saving, and only leaves on success. Added browser regression coverage confirms Back/reload/resume retains an incomplete profile and an injected storage rejection keeps the edited form visible with an error notice. The updated full demo walkthrough passes, and all 32 domain/SQL/Edge tests, typecheck, lint and admin build pass after this repair.
