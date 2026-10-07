# Black Childfree mobile

Install from the workspace root with npm ci. Start with EXPO_NO_TELEMETRY=1 npm run dev:mobile. The default route offers the synthetic MVP1 demo; the existing real onboarding slice is at /member and requires public settings. See the root README and docs/DEMO.md.

Demo routes live in src/app/demo; UI/state adapters live in src/demo; pure transitions are in packages/domain/src/demo.ts. Keep native SDK 57 compatibility, real onboarding access boundaries and synthetic labels intact. No real provider or phone-runtime evidence is implied by this demo.
