# Black Childfree — Codex onboarding build

Native iOS/Android dating app for Black adults who have never legally married, have no children or current parental role, never want parenthood and seek Black partners. The product contract lives in docs/Native_Dating_MVP_Build_Spec.md.

This checkpoint adds email OTP client code, server-enforced eligibility and pledge, private saved structured profiles, validated public configuration and CI. It is not a complete dating MVP. Provider deployment, actual phone runtime and the remaining features are explicit build gates.

## Run

Use Node 24.19.0 / npm 11.9.0. From the root:

```sh
npm ci
npm run check
npm run test:ui
npm run dev:mobile
```

With missing configuration, mobile displays setup-required status; no fake accounts are created. See docs/LOCAL_SETUP.md for Supabase configuration, legal/support-page dependencies and native builds. Admin is still a static shell: `npm run dev:admin`.

`npm run export:mobile:native` compiles iOS/Android JavaScript. It does not build signed native binaries or prove launch behavior. Browser UI checks exercise Expo web with explicitly synthetic providers; SQL tests run PostgreSQL in PGlite with isolated auth emulation.

## Continue

Read AGENTS.md, BUILD_STATUS.md, CONTINUE_IN_CODEX.md, docs/ONBOARDING_TASK_CARD.md and docs/LOCAL_SETUP.md. Preserve the existing scaffold and lockfile. No backend deployment, vendor purchase or production distribution has occurred. One writer owns schema/config changes and an independent reviewer checks changes.

## Licensing

The mobile shell derives from Expo's MIT-licensed default template; its notice remains in apps/mobile/LICENSE. Dependencies keep their respective licenses. No proprietary dating-app code or portraits are included. The project has no public source-code license selected.
