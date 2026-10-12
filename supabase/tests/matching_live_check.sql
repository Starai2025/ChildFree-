-- FREE MIDNIGHT: repeatable live check for matching, chat, blocks and reports.
-- Paste into the Supabase SQL editor after all three public-beta migrations.
-- Everything runs in one transaction and is ROLLED BACK, so it leaves no data behind.
-- Success: the final row says 'ALL MATCHING CHECKS PASSED'. Any failure stops with an error naming the check.

begin;

-- Two test applicants, approved by the founder.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('0b000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-a@freemidnight.invalid', '', now(), '{"provider":"email"}', '{}', now(), now()),
       ('0b000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-b@freemidnight.invalid', '', now(), '{"provider":"email"}', '{}', now(), now());
update public.profiles set first_name = case id when '0b000000-0000-4000-8000-00000000000a' then 'QA Ava' else 'QA Ben' end,
  birth_date = '1990-01-01', gender = case id when '0b000000-0000-4000-8000-00000000000a' then 'Woman' else 'Man' end,
  seeking = case id when '0b000000-0000-4000-8000-00000000000a' then '{Man}' else '{Woman}' end::text[],
  city = 'Atlanta', zip = '30308', relationship_goal = 'A committed relationship',
  prompts = '[{"id":"a","answer":"QA"},{"id":"b","answer":"QA"}]', eligibility = '{"qa":true}', pledge_accepted_at = now(), status = 'submitted'
 where id in ('0b000000-0000-4000-8000-00000000000a', '0b000000-0000-4000-8000-00000000000b');
insert into public.admin_reviews (profile_id, decision) values
  ('0b000000-0000-4000-8000-00000000000a', 'approved'), ('0b000000-0000-4000-8000-00000000000b', 'approved');

-- Act as Ava.
select set_config('request.jwt.claim.sub', '0b000000-0000-4000-8000-00000000000a', true),
       set_config('request.jwt.claims', '{"sub":"0b000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if not exists (select 1 from public.member_cards() where id = '0b000000-0000-4000-8000-00000000000b') then
    raise exception 'CHECK FAILED: Ava should see Ben in discovery';
  end if;
  insert into public.profile_reactions (actor_id, target_id, kind) values ('0b000000-0000-4000-8000-00000000000a', '0b000000-0000-4000-8000-00000000000b', 'like');
  if exists (select 1 from public.matches) then raise exception 'CHECK FAILED: a one-way like must not create a match'; end if;
end $$;
reset role;

-- Act as Ben: like back, see the like, get exactly one match, send a message.
select set_config('request.jwt.claim.sub', '0b000000-0000-4000-8000-00000000000b', true),
       set_config('request.jwt.claims', '{"sub":"0b000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
do $$
declare m uuid;
begin
  if not exists (select 1 from public.likes_received() where id = '0b000000-0000-4000-8000-00000000000a') then
    raise exception 'CHECK FAILED: Ben should see that Ava liked him';
  end if;
  insert into public.profile_reactions (actor_id, target_id, kind) values ('0b000000-0000-4000-8000-00000000000b', '0b000000-0000-4000-8000-00000000000a', 'like')
    on conflict (actor_id, target_id) do update set kind = excluded.kind;
  insert into public.profile_reactions (actor_id, target_id, kind) values ('0b000000-0000-4000-8000-00000000000b', '0b000000-0000-4000-8000-00000000000a', 'like')
    on conflict (actor_id, target_id) do update set kind = excluded.kind;
  if (select count(*) from public.matches) <> 1 then raise exception 'CHECK FAILED: a mutual like must create exactly one match'; end if;
  select id into m from public.matches;
  insert into public.messages (match_id, sender_id, body) values (m, '0b000000-0000-4000-8000-00000000000b', 'Hi Ava, QA check');
  if (select count(*) from public.my_matches()) <> 1 then raise exception 'CHECK FAILED: Ben should have one open match'; end if;
end $$;
reset role;

-- Act as Ava: read the message, reply, then block Ben.
select set_config('request.jwt.claim.sub', '0b000000-0000-4000-8000-00000000000a', true),
       set_config('request.jwt.claims', '{"sub":"0b000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$
declare m uuid;
begin
  select id into m from public.matches;
  if (select count(*) from public.messages where match_id = m) <> 1 then raise exception 'CHECK FAILED: Ava should read Ben''s message'; end if;
  insert into public.messages (match_id, sender_id, body) values (m, '0b000000-0000-4000-8000-00000000000a', 'Hi Ben');
  insert into public.reports (reporter_id, reported_id, match_id, reason, details)
    values ('0b000000-0000-4000-8000-00000000000a', '0b000000-0000-4000-8000-00000000000b', m, 'other', 'QA report');
  insert into public.blocks (blocker_id, blocked_id) values ('0b000000-0000-4000-8000-00000000000a', '0b000000-0000-4000-8000-00000000000b');
  if (select status from public.matches where id = m) <> 'closed' then raise exception 'CHECK FAILED: blocking must close the match'; end if;
end $$;
reset role;

-- Act as Ben: after the block he cannot message, read the chat, or see Ava.
select set_config('request.jwt.claim.sub', '0b000000-0000-4000-8000-00000000000b', true),
       set_config('request.jwt.claims', '{"sub":"0b000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
do $$
declare m uuid;
begin
  select id into m from public.matches;
  begin
    insert into public.messages (match_id, sender_id, body) values (m, '0b000000-0000-4000-8000-00000000000b', 'are you there?');
    raise exception 'CHECK FAILED: a blocked user was able to send a message';
  exception when insufficient_privilege then null;  -- refused by row-level security, as intended
  end;
  if exists (select 1 from public.messages) then raise exception 'CHECK FAILED: blocked chat should not be readable'; end if;
  if exists (select 1 from public.member_cards(array['0b000000-0000-4000-8000-00000000000a']::uuid[])) then
    raise exception 'CHECK FAILED: Ben should no longer see Ava';
  end if;
  if exists (select 1 from public.reports) then raise exception 'CHECK FAILED: Ben must not see Ava''s report'; end if;
end $$;
reset role;

-- Visitors see nothing.
set local role anon;
do $$ begin
  begin
    perform 1 from public.matches;
    raise exception 'CHECK FAILED: visitors can read matches';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select 'ALL MATCHING CHECKS PASSED' as result;
rollback;
