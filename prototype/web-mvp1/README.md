# Web prototype (MVP1 founding beta)

`index.html` is the clickable, working prototype built in Claude and published as a claude.ai artifact:
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
