# Public web beta backend (Supabase)

Applicants sign in by email or Google, save a profile, upload optional photos and submit for founder review. Approved members use discovery, mutual matches, text chat and date planning. This is the public web beta; native/store release gates remain separate.

Current hosting (October 15, 2026): https://noseedsdatingsite.com on Render, with https://no-seeds-dating.onrender.com as backup. Render serves the committed `prototype/no-seeds-public-beta/dist` directory from `handoff/free-midnight-claude`, with no build or environment variables. Supabase functions and migrations deploy separately. Do not publish to ChatGPT Sites.

Backend follow-ups and evidence: [October 15 delivery](NO_SEEDS_BACKEND_DELIVERY_20261015.md), [SMTP and GoDaddy setup](NO_SEEDS_SMTP_SETUP.md), [Google Places storage/display](NO_SEEDS_GOOGLE_PLACES.md). The unused legacy `beta_applications` intake is closed to browser inserts by migration 202610150001. Migration 002 removes browser EXECUTE on public trigger functions; 003 preserves member RPC contracts with private guarded implementations; 004 restricts Google suggestions to place IDs and app-authored fields. All four are applied live and recorded. Keep `app_private` outside exposed API schemas. The Free plan's leaked-password-protection warning requires an owner-approved Pro upgrade; do not dismiss it as fixed.

| Part | Path |
|---|---|
| SQL (tables, statuses, rules, row-level security, private bucket) | `supabase/migrations/202610120001_public_beta_profiles.sql` |
| Founder review endpoint (service role + passcode, server-side only) | `supabase/functions/admin-review/index.ts` |
| Automated database checks | `tests/public-beta-sql.mjs` |

This sits beside the earlier Expo onboarding schema (`private.*`, `api_*` functions); nothing is shared or renamed.

## What the SQL does

- **`profiles`:** one row per signed-in user, created automatically as `draft` when they sign up. Status is one of `draft`, `submitted`, `approved`, `changes_requested` or `removed`.
- **`profile_photos`:** up to 6 photo slots per profile. A row can only point at a file in the owner's own folder (`<user id>/…`).
- **`admin_reviews`:** the log of founder decisions. One insert applies the decision to the profile.
- **Rules a browser cannot bypass** (enforced in the database):
  - Applicants can only set their own status to `submitted`, and only from `draft` or `changes_requested`.
  - Submitting requires: first name, date of birth (18+), gender, who they'd like to meet, city, ZIP, relationship goal, at least 2 prompts, eligibility answers and the pledge. Photos are optional.
  - Applicants can't touch review notes or review dates.
  - Editing an approved profile sends it back to `submitted`.
  - A `removed` profile can't be edited.
- **Access:**
  - Applicants read and write only their own profile and photos.
  - Visitors who aren't signed in can read nothing.
  - `admin_reviews` has no applicant access at all; only the service role can use it.
- **Storage:** a private `profile-photos` bucket (5 MB limit; JPEG, PNG or WebP). Owners upload, view and delete only in their own folder. The founder sees photos through short-lived signed links.

## Environment variables

**Only two values ever go into the frontend.** The service-role key bypasses every security rule above, and the admin passcode unlocks review. In a browser, anyone can read both with View Source, so they live only in Supabase's server-side secrets.

| Variable | Where it goes | Value |
|---|---|---|
| `SUPABASE_URL` | Frontend (public) and Edge Function (set automatically) | Project Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Frontend (public) | Project Settings → API → `anon` / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Edge Function only** (set automatically by Supabase) | Never in frontend code, `.env` files the site serves, or Git |
| `ADMIN_PASSCODE` | **Edge Function secret only** | 24+ random characters, e.g. from a password manager |
| `ALLOWED_ORIGINS` | Edge Function secret | Your site origin(s), comma-separated, e.g. `https://freemidnight.com` |

Frontend `.env` (or the equivalent for your host):

    SUPABASE_URL=https://YOUR-PROJECT.supabase.co
    SUPABASE_ANON_KEY=YOUR-ANON-KEY

The founder's review page asks for the passcode when it opens and sends it to the `admin-review` function in the `x-admin-passcode` header. The passcode is never stored in the site's code.

## Setup steps

1. **Create a Supabase project.** Copy the Project URL and `anon` key into the frontend `.env`.
2. **Run the SQL.** Open SQL Editor, paste the whole of `supabase/migrations/202610120001_public_beta_profiles.sql`, and run it once. It creates the type, tables, triggers, policies, bucket and storage policies.
3. **Configure email sign-in** (Authentication):
   - Providers → Email: on, **Confirm email** on.
   - URL Configuration: set **Site URL** to the beta's address and add it to **Redirect URLs**.
   - The frontend signs in with `supabase.auth.signInWithOtp({ email })` (magic link or 6-digit code). Before real users arrive, set up custom SMTP (Authentication → SMTP), because the built-in sender is rate-limited.
4. **Deploy the founder review function** (Supabase CLI, from the repo root):

       supabase login
       supabase link --project-ref YOUR-PROJECT-REF
       supabase secrets set ADMIN_PASSCODE='paste-24+-random-characters' ALLOWED_ORIGINS='https://your-beta-site'
       supabase functions deploy admin-review --no-verify-jwt

   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to Edge Functions automatically. `--no-verify-jwt` is right here: the passcode, not a member login, authorises this endpoint.
5. **Uploading photos from the frontend:**
   - Re-encode each photo through a canvas before upload. This strips location (EXIF) data, which the beta promises.
   - Upload to `profile-photos` at `<user id>/<random name>.jpg`.
   - Insert a `profile_photos` row with that `storage_path` and a slot `position` from 0 to 5.
   - To show the applicant their own photos, call `createSignedUrl` on the path.
6. **Founder review:**
   - `POST https://YOUR-PROJECT.supabase.co/functions/v1/admin-review` with header `x-admin-passcode`:
     - `{"action":"queue"}` returns submitted profiles, oldest first, with signed photo links.
     - `{"action":"decide","profile_id":"…","decision":"approved"|"changes_requested"|"removed","note":"…"}` records a decision. A note is required for `changes_requested`.
   - Every decision is kept in `admin_reviews`.

## Frontend calls (supabase-js v2, anon key)

    // sign in / return later
    await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin } })
    // load my profile (always exactly my row)
    const { data: profile } = await supabase.from('profiles').select('*, profile_photos(*)').single()
    // save a draft (any subset of fields)
    await supabase.from('profiles').update({ first_name, city, prompts }).eq('id', user.id)
    // submit for review (the database reports anything missing)
    const { error } = await supabase.from('profiles').update({ status: 'submitted' }).eq('id', user.id)

## Test checklist

**Automated database checks** (run before deploying; uses the repo's PGlite dev dependency):

    npm ci
    node tests/public-beta-sql.mjs

These 8 checks cover:
- signup creating a draft
- save and reload of your own profile
- blocking self-approval and review-field tampering
- refusing an incomplete or under-18 submit
- own-folder photos
- another user, a visitor or an applicant being blocked from other profiles and the review log
- the full review cycle (changes requested → resubmit → approve → edit re-queues → remove locks)
- the private bucket

**Live checks** (on the real project, after the setup steps):

| # | Test | Steps | Expected |
|---|---|---|---|
| 1 | Applicant signup | Sign in with a new email; open the emailed link or code | Signed in. Table Editor → `profiles` shows a new row with status `draft` |
| 2 | Save profile | Fill in name, birthday, gender, who to meet, city, ZIP, goal, two prompts, eligibility, pledge; save; upload one photo | Row updated; `profile_photos` has 1 row; the file is in `profile-photos/<user id>/` |
| 3 | Reload profile | Sign out, sign back in with the same email | The same profile and photo come back; nothing to re-enter |
| 4 | Submit profile | Press Submit; then try submitting a second account with prompts missing | First: status `submitted` with `submitted_at` set. Second: error "profile is incomplete: at least two prompts" |
| 5 | Admin review | Call `admin-review` with the passcode: `queue`, then `decide` → `changes_requested` with a note, then the applicant resubmits, then `approved` | Applicant sees the note while changes are requested; status ends `approved`; 2 rows in `admin_reviews`. A wrong passcode returns 401 |
| 6 | Unauthorized user cannot read another profile | Signed in as applicant B, run `supabase.from('profiles').select('*').eq('id', '<A id>')`; signed out, run `supabase.from('profiles').select('*')`; as B, try `supabase.storage.from('profile-photos').download('<A id>/…')` | B gets `[]`; signed-out gets a permission error or `[]`; the photo download is refused |
| 7 | No self-approval | As an applicant, run `update({ status: 'approved' })` | Error: "applicants cannot change status" |

## Matching and chat (second migration)

`supabase/migrations/202610120002_matching_and_chat.sql` runs after the first. Paste it into the SQL Editor once.

| Table | Purpose |
|---|---|
| `profile_reactions` | One like or pass per member per person (`actor_id`, `target_id`, `kind`) |
| `matches` | One row per pair (`user_one < user_two`, unique); `active` or `closed`, with `closed_at` and `closed_reason` |
| `messages` | Text messages inside a match (1–2000 characters) |
| `blocks` | Who blocked whom |

**Rules the database enforces:**
- **Liking:**
  - Only approved members can like or pass, never themselves and never across a block.
  - A like that meets a like back creates exactly one match; repeats and simultaneous likes can't duplicate it.
- **Seeing matches and messages:**
  - Members see only matches they belong to.
  - They read and send messages only in their own active matches, and only while both people are approved and neither has blocked the other.
  - The sender is always the signed-in member.
- **Closing a match:**
  - A block closes the pair's match (`closed_reason = 'blocked'`).
  - Removing a profile closes all of its matches.
  - `close_match(match_id, reason)` lets a member unmatch.
  - A closed match never reopens.
- **What members see of each other:** `member_cards()` returns today's discovery list: approved, mutually compatible (gender and age), not blocked, not already reacted to. `member_cards(array[ids])` returns cards for known people, e.g. matches. Both return public card fields only, never birth date, ZIP, eligibility answers or review notes.
- **Photos:** approved members can view approved members' photos; never unapproved, removed or blocked owners'.
- **Visitors:** see nothing.

Internal helpers live in the `app_private` schema, which the API does not expose.

**Frontend calls:**

    // discovery
    await supabase.rpc('member_cards')
    // like / pass (repeat-safe)
    await supabase.from('profile_reactions').upsert({ actor_id: me, target_id, kind: 'like' })
    // my matches
    await supabase.from('matches').select('*')
    // chat
    await supabase.from('messages').select('*').eq('match_id', id).order('created_at')
    await supabase.from('messages').insert({ match_id: id, sender_id: me, body })
    // block / unmatch
    await supabase.from('blocks').insert({ blocker_id: me, blocked_id: them })
    await supabase.rpc('close_match', { p_match: id, p_reason: 'unmatched' })

**Automated checks:** `node tests/matching-chat-sql.mjs`. Its 10 checks cover:
- visitors seeing nothing
- approved-only and no self-likes
- discovery privacy
- a one-way like making no chat
- a mutual like making one match, with no duplicates
- outsiders unable to read or post, spoof a sender, or create a match
- blocks closing chats
- a closed match refusing messages
- removed profiles leaving matching
- photo visibility

For live chat updates later, add `messages` to Supabase Realtime. Policies already limit what each member receives.

## Reports, member views and the frontend contract

`supabase/migrations/202610120003_reports_and_member_views.sql` adds:
- `reports`: members file their own; only the founder resolves them, through `admin-review` actions `reports` and `resolve_report`.
- `my_matches()` and `likes_received()`.

The member-app contract (tables, fields, query patterns, error messages) is in [FRONTEND_CONTRACT.md](FRONTEND_CONTRACT.md).

The repeatable live check is `supabase/tests/matching_live_check.sql`. Paste it into the SQL Editor; it rolls itself back.
