# Run the current Codex build

This checkpoint implements a local onboarding slice, not a complete dating beta. Photos, identity, preferences, review/admin, discovery, chat, reporting and automated deletion/export are still to build. No real members should be admitted yet.

## Install and check

Use Node 24.19.0 and npm 11.9.0. From the repository root:

```sh
npm ci
npm run check
npm run export:mobile:native
npm run test:ui
```

`check` includes TypeScript, lint, Node domain/Edge-handler tests, actual PostgreSQL permission/transaction tests via PGlite, Deno type checking and admin build. PGlite substitutes isolated test auth claims; it does not run hosted Supabase, GoTrue, PostgREST, PostGIS or a real JWT gateway. Browser UI checks use explicit synthetic auth/API fixtures and Expo web rendering; they are not native phone tests. Browser tests bundle their own Linux Chromium; on another OS supply a compatible browser in the test launcher or run that test in Linux CI. The workflow is committed but has not run on GitHub: this repository has no remote.

## Default startup

```sh
npm run dev:mobile
npm run dev:admin
```

With no public configuration, mobile shows a setup-required screen and does not create fake accounts. Admin remains a static shell with no member data. For flags, invoke the workspace directly, e.g. `npm run start --workspace @black-childfree/mobile -- --web`.

## Supabase development project

Use only an isolated development/staging project with synthetic accounts until all safety gates pass. The following steps require the owner-controlled Supabase project and credentials, absent from this environment:

1. Install the current official Supabase CLI in a compatible environment. For local Supabase, Docker is required. No Docker/native tooling is available in the authoring environment.
2. Run `supabase start` and `supabase db reset` for a local project, or link a new development project and apply migrations with `supabase db push`. Inspect the target project before any migration; the author did not deploy these commands.
3. Deploy `onboarding` using `supabase functions deploy onboarding --project-ref YOUR_DEVELOPMENT_PROJECT_REF`. Confirm that its relative shared-domain import bundles on the Supabase runtime. `deno check` proves the module graph locally, not hosted deployment.
4. Gateway `verify_jwt=false` is deliberate for modern Supabase keys: the function always calls `auth.getUser()` to verify bearer sessions, then uses the same bearer token for RPC ownership. Never replace this with a service-role client. Confirm direct requests without, with expired and with forged tokens are denied on the deployed project. Disable anonymous sign-ins.
5. For a web development client, set function secret `ALLOWED_ORIGINS` to its exact origin, e.g. `http://localhost:8081`. Native requests have no browser Origin header. Production web origins must be explicitly allowlisted. The frontend never receives any server-only secret.
6. In hosted Auth, configure the magic-link email template to include `{{ .Token }}` (see `supabase/templates/email-otp.html`), set six-digit codes and a ten-minute expiry, and configure an owned SMTP sender. Template configuration in local `config.toml` does not configure the hosted dashboard automatically. Test actual delivery, expiry and resend behavior. No SMTP account/delivery evidence exists yet.
7. Copy `apps/mobile/.env.example` to `apps/mobile/.env.local`. Supply the Supabase URL, a **publishable** `sb_publishable_…` key, and actual owner-reviewed Terms, Privacy and support-page HTTPS URLs. Do not use a secret/service-role key or a legacy JWT key. Code intentionally requires legal/support pages before registration; those documents/operations are owner dependencies, not fabricated URLs.
8. Restart Metro when changing public configuration. A physical phone cannot reach its own loopback address to contact a host's local Supabase; use a hosted development project or an explicitly configured reachable development endpoint. Hosted HTTPS is required outside loopback development.

## Application API

Mobile sends `POST /functions/v1/onboarding` with a typed discriminated `action`. No input accepts `user_id`, lifecycle or verification outcomes. Private RPCs derive the actor from `auth.uid()` and refuse anonymous-auth users. Snapshot responses contain only that actor's DOB/attestations/draft plus the current published pledge/catalog; no other member data is exposed. Every response is no-store and raw failures/payloads are omitted from logs.

| Action | Database RPC | Behavior |
|---|---|---|
| bootstrap | api_onboarding | Creates/resumes own onboarding account; reads own state |
| eligibility | api_eligibility | Adult DOB + six explicit boolean answers; current policy; identical retry is idempotent; DOB corrections require support |
| pledge_accept | api_accept_pledge | Separate current-version acknowledgment; server timestamp; idempotent |
| draft_save | api_save_draft | Allowlisted partial profile fields; revision check; owner-only |
| profile_save | api_save_profile | Complete two-prompt structured profile; append draft revision; no approval |
| profile_submit | api_submit_profile | Always denies submission until real photos/preferences/identity prerequisites are implemented |

The API returns `ok/data` or `ok=false/code`. Shared contracts are `packages/domain/src`. SQL validation also applies when clients bypass Edge and call exposed RPCs directly. No raw private table privileges are given to `anon` or `authenticated`.

Drafts are held in React memory and saved to the owner's private server records. They are not persisted locally. Native sessions use Expo SecureStore; storage failures propagate rather than falling back to plaintext. Large session payloads, account switching, background refresh, reinstall behavior, logout and secure-storage failure must still be exercised on iOS and Android. Web development sessions use sessionStorage. UI Terms/Privacy acknowledgment currently has no server-versioned acceptance audit; add that before real-member beta.

## Native builds

Development/staging/production use distinct schemes and bundle identifiers in `app.config.ts`; identifiers are provisional pending owner registration. `expo-dev-client` is installed, and `eas.json` defines development/internal distribution. No EAS account/project, signing credentials or store accounts are configured. Add an owner-approved EAS project and public environment values before builds. Build with current official EAS CLI, then install/open on both platforms. OTP currently uses manually entered codes, not magic-link/deep-link recovery; the latter F03 requirement remains pending.

Native JavaScript exports passed here. No signed .ipa/.aab, emulator/device launch or native accessibility/keyboard evidence has been produced.

## Next implementation order

Hosted auth/API integration proof and native runtime → MFA/admin permission spine → private photo pipeline and Persona sandbox → preferences/location → genuine submission/review → reciprocal discovery → matching/Stream permissions → chat/revocation → reporting, deletion/export, push → staged release QA. Preserve the feature exclusions and free mutual-match messaging. Do not enable approval or fake verification to unblock the next screen.
