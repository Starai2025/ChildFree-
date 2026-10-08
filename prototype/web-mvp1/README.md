# Web prototype (MVP1 founding beta)

## Local questionnaire review candidate

The local source and generated demo copies now include ten optional compatibility questions, draft save/retry, editable answers and factual shared-answer summaries. See [questions and evidence](../../docs/COMPATIBILITY_QUESTIONS.md). This addition has not been pushed: the user requires trying the full interactive candidate first. The public links below still refer to the prior GitHub version until a later authorized push.

## Clickable browser demo

Open [the interactive browser demo](https://raw.githack.com/Starai2025/ChildFree-/main/prototype/web-mvp1/demo.html). It runs the redesigned interface with synthetic profiles, local matching, messages, onboarding and simulated review. Like Malik to create a mutual match, then enter the conversation. Use **Demo controls → Simulate a reply**, **Start a new demo profile**, or **Reset demo**. No Claude account is needed.

If the hosting link is unavailable, [download demo-standalone.html](https://github.com/Starai2025/ChildFree-/raw/refs/heads/main/prototype/web-mvp1/demo-standalone.html) and open the downloaded file in a desktop browser. This version embeds all images and works offline. Progress stays in that browser, separately from the Expo demo. Use invented information only. Browser storage must be available to save actions.

The demo is isolated: `local-demo-runtime.js` provides synthetic, device-local compatibility APIs only in the generated demo copies. It is not authentication, real shared storage, verification, moderation or a messaging provider. The Claude source `index.html` and live-provider code are unchanged. Regenerate both copies with `node scripts/build-claude-demo.mjs`; run `node tests/claude-browser-demo.mjs` to test the shipped copies without an injected test adapter. See [browser demo evidence](../../docs/CLAUDE_BROWSER_DEMO.md). The public repository was verified; the CDN URL could not be checked from this environment because the network proxy denies its domain.

## Redesigned copy and preview

The repository copy was redesigned on October 7, 2026, using the user's LOML Figma screenshot as its visual reference: orange/white screens, photo-overlay profile names, persistent Like/Pass buttons, icon navigation, compact forms and a matching conversation composer. Direct Figma access was unavailable; no editable Figma nodes or template assets were imported.

Open [design-preview.html](design-preview.html) in a browser to compare Welcome, Onboarding, Discover, Filters, Mutual Match, Conversation, Safety, Date Planner, Matches, Profile and Review. It is a self-contained, static preview with clearly labeled synthetic people/messages and generated fictional portraits. It requires no account, Claude APIs, internet connection or backend. Its controls select screen snapshots; it does not perform real app actions.

The working `index.html` continues to require Claude's runtime and members' uploaded photos. To update the hosted Claude artifact, replace its HTML with this file in Claude. A GitHub push does not update the separately hosted artifact.

Run `node tests/claude-prototype-ui.mjs` from the repository root to exercise the actual HTML using a Playwright-only, synthetic in-memory Claude API adapter, regenerate the static preview and capture screenshots under `docs/evidence/claude-redesign`. The fixture adapter is confined to the test; it is not included in `index.html` or the static preview. Local checks cover navigation, eligibility errors, discovery/mutual match, text send/reply, safety/planner, profile/review, narrow layouts and standalone-preview switching. Real Claude account/storage/room integration is not verified by these checks.

## Original artifact reference

The supplied ZIP references this original Claude artifact; it has not been updated by the repository redesign:
https://claude.ai/artifact/N7SbnP4m7YqKfYyQaevAJo

It is a single self-contained HTML file. It only runs inside claude.ai, where it uses the artifact
runtime (`window.claude.use("db" | "user" | "room")`) for storage, sign-in and live typing indicators.
Opened anywhere else it shows a "sign in to Claude" message.

## Purpose

Validate the product with an invite-only Atlanta founding cohort and serve as the visual and behavioral
reference for the native Expo app. It is not the production app: shared data in the artifact database
is readable by anyone with access, so it is for invited testers only.

## Features to carry into the native build

- Onboarding: 18+ DOB check, six eligibility attestations, Community Pledge, invite code
- Profile: 2–4 catalog prompts, optional bio, goal, marriage view, Atlanta ZIP, 2–6 photos (EXIF stripped)
- Basics (no re-review): height, faith, politics, education, drinking, smoking, cannabis
- Passions page: 64 passions in 7 groups, pick 3–6, shared passions highlighted and used in ranking
- Discover: 5 new cards a day, Today's top pick, swipe or buttons, like/comment on a specific prompt or photo
- Filters: age (reciprocal), height, details, goal, marriage; each a preference or a dealbreaker; live count with suppression under 10
- Matches: Likes you list, match screen (also when the other person completes the match), text chat,
  typing indicator, Seen, photos in chat, unmatch/block/report
- Date planner: 10-message milestone, propose vibe/budget/up to 3 times, both swipe 3 curated venues,
  fallback (new venues or own spot), receiver confirms or counters time, locked date pinned in chat,
  graceful cancel/reschedule, Dates tab (upcoming, pending, community events)
- Events with RSVPs and capacity
- Invites: personal code, add requests to the founding team, inviter credit
- Admin (owner): review queue, members, reports, invites, recruiting gaps grid, announcements, events, venues

## Known differences from the spec

See docs/DECISIONS_2026-10-07.md. The prototype also adds photo messages and a free "Likes you" list,
which the original spec deferred; decide whether to keep them in the native V1.
