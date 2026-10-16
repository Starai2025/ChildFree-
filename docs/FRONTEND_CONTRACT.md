# FREE MIDNIGHT beta: frontend ↔ Supabase contract

For the member app (Codex). Everything below uses **supabase-js v2 with the public key only**. The database enforces every rule, so the app never needs, and must never contain:
- the service-role key
- shared admin credentials (review now uses the founder's own MFA-protected login)
- calls to `admin-review`

## Connection (public values, safe in the browser)

    SUPABASE_URL      = https://btnrophnyfuwnqzwiooh.supabase.co
    SUPABASE_ANON_KEY = sb_publishable_7bUb95CMiZ7AVoXqJWsE5Q_TZZDlxBw
    SITE_URL          = https://noseedsdatingsite.com

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

Render publishes `prototype/no-seeds-public-beta/dist` from `handoff/free-midnight-claude` on push, without a build command or environment variables. Use the current page origin for auth redirects; SITE_URL is the production fallback. The Render backup is https://no-seeds-dating.onrender.com. ChatGPT Sites is retired. See [email setup](NO_SEEDS_SMTP_SETUP.md) and [planner storage/display](NO_SEEDS_GOOGLE_PLACES.md).

## Sign in and return later

    await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: SITE_URL } })
    supabase.auth.onAuthStateChange((_event, session) => { /* session?.user.id is `me` */ })

- Email confirmation is on, so first sign-in completes from the emailed link.
- A `profiles` row (status `draft`) exists as soon as the account does. Never insert one; only update it.

## Which screens a member may use

| `profiles.status` | Show |
|---|---|
| `draft` | Sign-up steps |
| `changes_requested` | Sign-up steps plus `review_note` ("What to change"), then resubmit |
| `submitted` | "Your profile is in review" |
| `approved` | Discover, Matches, Chat, Profile |
| `removed` | Account removed notice; no editing |

Discover, Matches and Chat calls return nothing, or are refused, unless the member is approved, still invited, has a confirmed account email, is fully eligible and has recorded current agreements. Status alone cannot grant server access. See [security contract](NO_SEEDS_SECURITY_20261016.md).

## Profile (own row only)

**Read:**

    const { data: profile } = await supabase.from('profiles').select('*, profile_photos(id, storage_path, position)').single()

**Fields the app writes:**

| Field | Type | Notes |
|---|---|---|
| `first_name` | text | 1–40 characters |
| `birth_date` | `YYYY-MM-DD` | Must be 18+ to submit; never shown to others (members see `age`) |
| `gender` | text | `Woman`, `Man` or `Non-binary` |
| `seeking` | text[] | Any of the gender values |
| `age_min`, `age_max` | integer | 18–99, min ≤ max (defaults 25–60) |
| `city` | text | ≤ 60 characters |
| `zip` | text | 5 digits; never shown to others |
| `relationship_goal`, `marriage_view` | text | ≤ 60 characters |
| `bio` | text | ≤ 500 characters |
| `prompts` | jsonb | `[{ "id": "ordinary_sunday", "answer": "…" }]`, at most 4 |
| `basics` | jsonb | `{ height, faith, politics, education, drinking, smoking, cannabis }` |
| `interests` | text[] | At most 6 |
| `compatibility` | jsonb | The 10 "life you'd share" answers, by question id |
| `eligibility` | jsonb | The sign-up eligibility answers (private) |
| `pledge_accepted_at` | timestamptz (read only) | Server timestamp from `accept_agreements`; omit from member patches |

**Read-only for the app:** `status`, `submitted_at`, `reviewed_at`, `review_note`.

**Save and submit:**

    await supabase.from('profiles').update({ ...fields }).eq('id', me)          // save any subset, any time
    const { error } = await supabase.from('profiles').update({ status: 'submitted' }).eq('id', me)
    // error.message lists what is missing, e.g. "profile is incomplete: at least two prompts, ZIP code"

- **Required to submit:** first name, date of birth (18+), gender, who to meet, city, ZIP, relationship goal, at least 2 prompts, eligibility answers and the pledge. Photos are optional.
- **Editing an approved profile** puts it back in review automatically.

## Photos (private bucket `profile-photos`)

1. Re-encode each photo through a `<canvas>` (strips location data), ideally as JPEG of 1080 px width or less, under 5 MB.
2. Upload it to the member's own folder:

       const path = `${me}/${crypto.randomUUID()}.jpg`
       await supabase.storage.from('profile-photos').upload(path, blob, { contentType: 'image/jpeg' })

3. Record which slot it fills:

       await supabase.from('profile_photos').insert({ profile_id: me, storage_path: path, position })   // position 0–5

4. To show any photo (yours, or another approved member's from `photo_paths`), use a signed link:

       const { data } = await supabase.storage.from('profile-photos').createSignedUrls(paths, 3600)

5. To remove a photo, delete the `profile_photos` row and run `storage.from('profile-photos').remove([path])`.

## Discover

    const { data: cards } = await supabase.rpc('member_cards')                    // today's candidates, up to 20
    const { data: some }  = await supabase.rpc('member_cards', { p_ids: [id1, id2] })  // cards for known people

**Card fields:** `id`, `first_name`, `age`, `gender`, `city`, `relationship_goal`, `marriage_view`, `bio`, `prompts`, `basics`, `interests`, `compatibility`, `photo_paths` (ordered).

There's no birth date, ZIP, eligibility answers or review data. Candidates are approved, mutually compatible (gender and age both ways), not blocked, and not yet liked or passed.

**Like / pass** (safe to repeat; a like met by a like back creates the match):

    await supabase.from('profile_reactions').upsert({ actor_id: me, target_id: card.id, kind: 'like' })   // or 'pass'

**Did it match?** After a like, check:

    const { data: m } = await supabase.from('matches').select('id')
      .or(`and(user_one.eq.${me},user_two.eq.${card.id}),and(user_one.eq.${card.id},user_two.eq.${me})`)
      .eq('status', 'active').maybeSingle()   // m → show the "It's a match" screen

**Shared answers** ("Why {name}", "The life you'd share"): compare the member's own `compatibility` with `card.compatibility` in the app.

## Matches

    const { data: likes }   = await supabase.rpc('likes_received')   // people who liked me and I haven't answered
    const { data: matches } = await supabase.rpc('my_matches')       // open conversations, newest activity first

- **`likes_received`:** same fields as a card, plus `liked_at`. Answer with a like or pass upsert as in Discover.
- **`my_matches`:** `match_id`, `matched_at`, `other_id`, `other_first_name`, `other_age`, `other_city`, `other_photo_path`, `last_message`, `last_message_at`, `last_message_mine`.
  - A null `last_message` means a new match ("Say hello").
  - Closed or blocked matches drop out of this list.

## Chat

    const { data: msgs } = await supabase.from('messages').select('id, sender_id, body, created_at')
      .eq('match_id', matchId).order('created_at')
    await supabase.from('messages').insert({ match_id: matchId, sender_id: me, body })   // 1–2000 characters

- Sending fails with a row-level-security error once the match is closed or either person is blocked or removed. Show "This conversation has ended."
- **Live updates** (optional): enable Realtime on `messages` in the dashboard, then subscribe with filter `match_id=eq.${matchId}`. Policies already limit who receives what.

## Safety

    await supabase.rpc('close_match', { p_match: matchId, p_reason: 'unmatched' })                  // unmatch
    await supabase.from('blocks').insert({ blocker_id: me, blocked_id: otherId })                   // block: also closes the match
    await supabase.from('reports').insert({ reporter_id: me, reported_id: otherId, match_id, reason, details })

- **Report reasons:** `fake_or_misleading`, `harassment`, `sexual_content`, `scam_or_money`, `underage`, `safety_concern`, `other`. `details` is optional, up to 1000 characters.
- **"Also block":** insert a block as well.
- **Blocked list:** `from('blocks').select('blocked_id, created_at')`. Unblock with `.delete().eq('blocked_id', id)`. Unblocking does not reopen a match.

## Error messages to show

| When | Message from the database | Show |
|---|---|---|
| Submit an incomplete profile | `profile is incomplete: …` | The listed items |
| Like or pass while not approved | `only approved members can like or pass` | Send to the in-review screen |
| Like someone removed or blocked | `that profile is not available` | Skip the card |
| Message a closed or blocked match | new row violates row-level security policy | "This conversation has ended." |
| Edit a removed profile | `this profile has been removed` | Removed notice |

## Applied migration baseline

These baseline migrations are already applied on the live project. Do not paste them again. Check `supabase_migrations.schema_migrations` and [current delivery evidence](NO_SEEDS_BACKEND_DELIVERY_20261015.md) before applying any new migration.

| File | Status on the live project |
|---|---|
| `supabase/migrations/202610120001_public_beta_profiles.sql` | Applied (with the `search_path` fix) |
| `supabase/migrations/202610120002_matching_and_chat.sql` | Applied |
| `supabase/migrations/202610120003_reports_and_member_views.sql` | Applied |

The isolated regression suite runs `supabase/tests/matching_live_check.sql`, expects `ALL MATCHING CHECKS PASSED`, and rolls back its synthetic fixtures. Live provider/member checks are listed separately in the delivery evidence.
