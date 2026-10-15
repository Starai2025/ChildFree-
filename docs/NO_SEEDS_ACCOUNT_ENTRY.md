# No Seeds account entry and saved setup

October 14, 2026.

## Behavior

- Signed-out visits open the welcome screen, preserving drafts. Sign in opens a separate email/Google screen. Opening it does not send an email; the explicit email-submit action requests a link.
- Draft and changes-requested accounts open a setup summary after authentication. Continue setup opens the first unfinished step. Review my answers starts at account details without discarding answers. Existing photos change the final checkpoint label to Review and submit.
- Save and finish later and Back to profile setup save answers before returning to the summary.
- Submitted accounts open review status; approved accounts open Discover. Other/unknown statuses open the status surface. Server approval, eligibility and matching protections are unchanged.
- Normal reloads for the same account/status preserve the currently selected tab. Token refresh leaves active edits intact.
- Authenticated drafts are backed up under `noSeedsAccountDraft:<user id>`. Another account cannot merge that draft; legacy unowned drafts with an email only merge for that email. Pre-signup Google birthday input is preserved.
- Sign-out, including another tab's sign-out/session loss, clears the previous account's form and cached account views. Account backups remain available to the same account.

## Verification

- `node tests/no-seeds-account-routing.mjs`: 17 isolated checks passed, exercising actual load/render/auth-callback handlers with synthetic DOM/state.
- `node tests/no-seeds-onboarding-sync.mjs`: 9 passed.
- `node tests/no-seeds-photo-upload.mjs`: 11 passed.
- `node tests/matching-chat-sql.mjs`: 18 passed against isolated PGlite.
- JavaScript syntax and `git diff --check` passed.
- Independent read-only A6 review accepted after fixing account ownership and external sign-out findings.
- Existing `tests/no-seeds-onboarding-ui.mjs` was updated for the summary and separate sign-in flow. Its syntax passed. The browser suite was not executed in this Windows sandbox; the existing browser launcher is Linux-specific.
- Local preview server started, but both the shell and Codex browser timed out connecting to it. No layout or real sign-in verification is claimed.

## Publication

Updated October 15, 2026: hosting moved to Render at https://noseedsdatingsite.com, with https://no-seeds-dating.onrender.com as backup. Render automatically publishes `prototype/no-seeds-public-beta/dist` from `handoff/free-midnight-claude` on each push. There is no build step and no environment configuration on Render. Do not publish to ChatGPT Sites. The founder's current baseline `4130e35` includes the sign-in routing fix `66f7528` and Claude's later member screens.

After deployment, verify real email/Google sign-in, a returning draft with and without photos, Continue setup, saved-answer review, submission/status, and approved-member Discover. No real profile should be approved solely for this routing test.
