# Black Childfree — MVP1 interactive demo

An Expo/React Native app for Black adults 18+ who have never legally married, have no children or current parental role, never want parenthood, and seek Black partners.

This checkpoint adds a complete **synthetic, device-local demo**: six-step onboarding, simulated identity/review, reciprocal discovery, mutual matching, text conversations, profile/settings, reports, block/unmatch, export/deletion, and a fixture review console. All people and activity are labeled synthetic. The demo never calls Supabase, Persona, Stream, SMTP, or push services.

The existing real Supabase onboarding code remains available under `/member`. Its profile submission is still blocked until real photos, preferences, identity and review prerequisites exist. This is not a real-member beta or a production release.

## Run

Use Node 24.19.0 and npm 11.9.0. From the repository root:

```sh
npm ci --cache /workspace/scratch/npm-cache
EXPO_NO_TELEMETRY=1 npm run check
EXPO_NO_TELEMETRY=1 npm run test:ui
EXPO_NO_TELEMETRY=1 npm run dev:mobile
```

For Expo web in the cloud machine:

```sh
env -u CI BROWSER=none EXPO_PUBLIC_APP_ENV=development EXPO_NO_TELEMETRY=1 npm run start --workspace @black-childfree/mobile -- --web --offline --clear --port 8081
```

Select **Explore the demo**. Start as Amara, Pass on Imani and Like Malik to try the seeded mutual-match flow. In **Settings**, select **Start a new demo profile** for the full six-step journey. After submission, use **Simulated review console** to approve the fixture, then return to Discover. Settings also contains fixture switching, reset, pause, export and deletion. The console uses the same local demo state; it is not production admin access or MFA.

The separate Vite admin site explains the current review tools and has no live administrative access: `npm run dev:admin`.

Demo progress persists with AsyncStorage using a separate synthetic-data key. Clearing browser/app storage or resetting the demo erases it. Demo routes redirect to real onboarding when `EXPO_PUBLIC_APP_ENV=production`. Do not enter real member information in demo fields.

## Checks and limitations

`npm run check` performs workspace typecheck/lint, domain/SQL/Edge tests, Deno typecheck and the admin build. `npm run test:ui` exports Expo web and exercises both the original onboarding fixture and the complete local demo in bundled Linux Chromium. `UI_SKIP_EXPORT=1` is only for rerunning against an unchanged, freshly generated QA bundle.

```sh
EXPO_NO_TELEMETRY=1 CI=1 npm run export:native --workspace @black-childfree/mobile -- --max-workers 2
```

Native exports compile iOS/Android JavaScript; they are not signed binaries or phone-launch evidence. Hosted provider integration, native device tests and real-member release gates remain open. See [demo walkthrough and evidence](docs/DEMO.md), [live setup](docs/LOCAL_SETUP.md), and [current status](BUILD_STATUS.md).

The design adapts the user's LOML screenshot into original components and illustrated assets. Template assets were not copied. The mobile shell retains its Expo MIT notice in `apps/mobile/LICENSE`; the application has no public source-code license selected.

When changing public settings or app stage, restart Metro with `--clear`. The UI runners clear the cache when switching between QA and production-stage guard exports.

## Additional Claude prototype

The user-supplied `BlackChildfreeAppclaude1.zip` is also preserved as a [separate Claude web prototype](prototype/web-mvp1/README.md) and accompanying documents. It depends on Claude's artifact runtime and is not part of the Expo demo. See the [import record](docs/CLAUDE1_IMPORT.md) for exact files, supplied decision notes and runtime limits. The existing MVP1 implementation remains intact.
