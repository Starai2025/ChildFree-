# No Seeds backend delivery — October 15, 2026

Render serves `prototype/no-seeds-public-beta/dist` from `handoff/free-midnight-claude` at https://noseedsdatingsite.com and https://no-seeds-dating.onrender.com. Every push deploys; pull with rebase and test first. Main and ChatGPT Sites are outside this workflow.

## Delivered commits and live evidence

| Commit | Change | Verification |
|---|---|---|
| `56f635d` | Retire unused legacy beta intake; remove public insert policy and browser insert grants | SQL regression covers absent table, repeat execution, table/column grants, preserved rows and server access. Live audit: unsafe policies 0, anon/member INSERT false. |
| `0c1267d` | Revoke browser EXECUTE on public trigger functions | Matching/planner SQL suites pass. Live audit found no browser-executable public trigger functions. |
| `48b2442` | Keep guarded member RPC implementations private behind same-contract invoker wrappers | Matching 18 and planner tests pass. Live exposed definer count 0; REST rejects `app_private` with PGRST106. |
| `799c56e` | Store only Google place IDs; fetch fresh details per view; small `loadPlan` logic edit | Planner SQL 7, helper/Edge 6 and frontend response/race/error checks pass. Migration 004 and function deployed before frontend. Live anonymous POST returns 401, `Cache-Control: no-store`, correct primary-origin CORS. |
| `d9a2f29` | Founder Resend SMTP/GoDaddy runbook | Reviewed against official Supabase/Resend instructions. Guide only: no DNS or SMTP credentials changed. |

Migrations 202610150001–004 were applied through the signed-in Supabase SQL editor and recorded in `supabase_migrations.schema_migrations`. The new Edge helper is a sibling of `index.ts`. Both live hostnames returned HTTP 200 and exactly the committed app.js contents after the planner push. No member data, review decisions or credentials were used for those probes.

Claude's `66ac3bd` adds signup Back navigation and Google Maps credit; `83bcf30` refines signup styling. These were pulled before publishing the planner change. The backend change does not restyle or restructure member screens.

## Test scope and limitations

Before each push: account routing 17, onboarding sync 9, photo upload 11, public beta SQL 8, matching/chat SQL 18, planner SQL 7, and legacy intake security regression all passed. Planner helper/handler tests and the actual frontend loader check also passed. A6 independently accepted the security, planner and SMTP changes.

SQL tests use isolated PGlite; Edge/provider tests use mocked auth and Google responses. No real approved-member date plan or live Google billing/key flow is claimed. `npm run check` was attempted but failed because workspace TypeScript dependencies were unavailable after Windows denied workspace symlink installation. Deno checking was blocked by Windows executable access denial. The focused tests passed; the full native/workspace check did not.

## Remaining next steps

1. Founder: follow [SMTP setup](NO_SEEDS_SMTP_SETUP.md), add only the generated new DNS records, enter the sending key directly into Supabase, then verify Gmail and another provider's sign-in delivery/redirects.
2. Claude: verify Google Maps attribution beside real suggestions, display returned third-party attributions, distinguish custom places and check Google end-user Terms/Privacy notices. See [planner contract](NO_SEEDS_GOOGLE_PLACES.md).
3. With controlled approved-member sessions, exercise plan creation, two-person voting/confirmation, reopen/refresh, unavailable-place handling and blocked-match denial on the live site.
4. Security Advisor rerun: **0 errors, 1 warning** remains for leaked-password protection. Supabase documents this as Pro+; this project is Free. An owner-approved plan upgrade is needed to enable it. It was not dismissed or represented as fixed.
5. Separately review `update-location`/`zip_locations` provider provenance and retention before claiming app-wide Google retention compliance. The planner no longer reads or writes that Google cache.

Owner decisions, provider setup and native/store release remain separate from this backend delivery.
