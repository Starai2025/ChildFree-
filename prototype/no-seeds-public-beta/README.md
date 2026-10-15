# No Seeds public web beta

This directory contains the live member app, including account setup, photos, review status, legal/safety pages, discovery, matching, chat, date planning and My Profile.

As of October 15, 2026, the primary site is https://noseedsdatingsite.com and the backup is https://no-seeds-dating.onrender.com. Render auto-publishes `dist` from `handoff/free-midnight-claude` on each push. Its publish directory, relative to the repository root, is `prototype/no-seeds-public-beta/dist`. Leave the build command empty; there are no Render environment variables. Supabase uses public connection values in the app and enforces access through RLS and server functions.

Do not deploy to ChatGPT Sites. Any retained `.openai` hosting metadata is historical and is not used by Render. Serve `dist` over HTTP for local preview.

Before each push, run `git pull --rebase`, account-routing, onboarding-sync, photo-upload and all public-beta SQL suites in `tests/`, plus focused tests for the change. Never force push or change main. Every push goes live; coordinate changes accordingly. Claude owns `dist/app.js` and `dist/styles.css`; keep necessary backend integration edits small and describe them in the commit.

See [account routing](../../docs/NO_SEEDS_ACCOUNT_ENTRY.md), [backend](../../docs/PUBLIC_BETA_BACKEND.md), [SMTP setup](../../docs/NO_SEEDS_SMTP_SETUP.md) and [Google Places rollout](../../docs/NO_SEEDS_GOOGLE_PLACES.md). Service-role keys and the admin passcode must never enter frontend files.
