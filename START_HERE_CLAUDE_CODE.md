# Claude Code kickoff prompt

Open this folder in Claude Code and paste:

```text
Read CLAUDE.md, AGENTS.md, BUILD_STATUS.md, docs/DECISIONS_2026-10-07.md,
docs/Native_Dating_MVP_Build_Spec.md and docs/LOCAL_SETUP.md.
DECISIONS_2026-10-07.md overrides the spec where they conflict
(Supabase Realtime chat instead of Stream, manual admin review instead of
Persona, free tiers only, no video).

Continue the existing code. Do not regenerate the scaffold or replace the
lockfile. First commit the uncommitted decision docs.

Build MVP1 in this order, one phase at a time. After each phase run
npm run check, show me the results, and wait for my OK:

1. Backend live: walk me through creating a free Supabase project, apply the
   existing migration, set apps/mobile/.env.local, and get email OTP login +
   eligibility + pledge + profile draft working on my phone.
2. Profile complete: photo upload (2–6, private storage, EXIF stripped),
   preferences (age range, distance, Atlanta ZIP), profile submission.
3. Admin review: minimal admin web app to approve/reject profiles and photos.
   Admin access restricted to my account.
4. Discovery + matching: 5 new candidates per day, like/pass, reciprocal
   filters, atomic mutual match with the canonical-pair lock from the spec.
5. Chat: text-only Supabase Realtime chat per DECISIONS D1, with
   connections list, unread state, unmatch, block and report.
6. Safety + settings: report categories from the pledge, block list,
   pause/resume, account deletion, help/support link.
7. Test builds: EAS free builds for TestFlight and Google Play internal testing.

Explain each step in plain language for a non-developer. Tell me before
anything costs money or needs an account I must create.
```
