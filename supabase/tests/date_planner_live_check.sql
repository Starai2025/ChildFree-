-- No Seeds: repeatable date planner check (run after migration 202610150004).
-- Everything happens inside one transaction that is deliberately cancelled at the end, so it
-- leaves no data behind. Success: the run ends with the error "RESULT: ALL DATE PLANNER CHECKS PASSED".
-- Any other error names the check that failed.

begin;

-- Three test members, approved: Ava and Ben will match; Cal is an outsider.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('0c000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-plan-a@freemidnight.invalid', '', now(), '{"provider":"email"}', '{"first_name":"QA Ava"}', now(), now()),
       ('0c000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-plan-b@freemidnight.invalid', '', now(), '{"provider":"email"}', '{"first_name":"QA Ben"}', now(), now()),
       ('0c000000-0000-4000-8000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-plan-c@freemidnight.invalid', '', now(), '{"provider":"email"}', '{"first_name":"QA Cal"}', now(), now());
update public.profiles set birth_date = '1990-01-01',
  gender = case id when '0c000000-0000-4000-8000-00000000000a' then 'Woman' else 'Man' end,
  seeking = case id when '0c000000-0000-4000-8000-00000000000a' then '{Man}' else '{Woman}' end::text[],
  city = 'Atlanta', zip = case id when '0c000000-0000-4000-8000-00000000000a' then '30308' else '30060' end,
  relationship_goal = 'Committed relationship', interests = '{Live music,Travel}',
  prompts = '[{"id":"a","answer":"QA"},{"id":"b","answer":"QA"}]', eligibility = '{"qa":true}', pledge_accepted_at = now(), status = 'submitted'
 where id in ('0c000000-0000-4000-8000-00000000000a', '0c000000-0000-4000-8000-00000000000b', '0c000000-0000-4000-8000-00000000000c');
insert into public.admin_reviews (profile_id, decision) values
  ('0c000000-0000-4000-8000-00000000000a', 'approved'), ('0c000000-0000-4000-8000-00000000000b', 'approved'), ('0c000000-0000-4000-8000-00000000000c', 'approved');

-- Ava likes Ben, Ben likes back (match), then they chat 4 messages each.
select set_config('request.jwt.claims', '{"sub":"0c000000-0000-4000-8000-00000000000a","role":"authenticated"}', true),
       set_config('request.jwt.claim.sub', '0c000000-0000-4000-8000-00000000000a', true);
set local role authenticated;
insert into public.profile_reactions (actor_id, target_id, kind) values ('0c000000-0000-4000-8000-00000000000a', '0c000000-0000-4000-8000-00000000000b', 'like');
reset role;
select set_config('request.jwt.claims', '{"sub":"0c000000-0000-4000-8000-00000000000b","role":"authenticated"}', true),
       set_config('request.jwt.claim.sub', '0c000000-0000-4000-8000-00000000000b', true);
set local role authenticated;
insert into public.profile_reactions (actor_id, target_id, kind) values ('0c000000-0000-4000-8000-00000000000b', '0c000000-0000-4000-8000-00000000000a', 'like');
do $$
declare m uuid;
begin
  select id into m from public.matches;
  if m is null then raise exception 'CHECK FAILED: mutual like should create a match'; end if;
  insert into public.messages (match_id, sender_id, body) select m, '0c000000-0000-4000-8000-00000000000b', 'QA hi ' || g from generate_series(1, 4) g;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"0c000000-0000-4000-8000-00000000000a","role":"authenticated"}', true),
       set_config('request.jwt.claim.sub', '0c000000-0000-4000-8000-00000000000a', true);
set local role authenticated;
do $$
declare m uuid;
begin
  select id into m from public.matches;
  insert into public.messages (match_id, sender_id, body) select m, '0c000000-0000-4000-8000-00000000000a', 'QA hey ' || g from generate_series(1, 5) g;
  if public.date_planner_ready(m) then raise exception 'CHECK FAILED: planner must stay locked until both have sent 5'; end if;
end $$;
reset role;

-- Ben's fifth message unlocks the planner.
select set_config('request.jwt.claims', '{"sub":"0c000000-0000-4000-8000-00000000000b","role":"authenticated"}', true),
       set_config('request.jwt.claim.sub', '0c000000-0000-4000-8000-00000000000b', true);
set local role authenticated;
do $$
declare m uuid;
begin
  select id into m from public.matches;
  insert into public.messages (match_id, sender_id, body) values (m, '0c000000-0000-4000-8000-00000000000b', 'QA fifth');
  if not public.date_planner_ready(m) then raise exception 'CHECK FAILED: planner should unlock after 5 messages each'; end if;
  begin
    insert into public.date_plans (match_id) values (m);
    raise exception 'CHECK FAILED: members must not create plans directly';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- The server (as the date-planner function does) creates the plan with places and times.
do $$
declare m uuid; p uuid;
begin
  select id into m from public.matches where user_one in ('0c000000-0000-4000-8000-00000000000a', '0c000000-0000-4000-8000-00000000000b');
  insert into public.date_plans (match_id, created_by) values (m, '0c000000-0000-4000-8000-00000000000a') returning id into p;
  insert into public.date_plan_options (plan_id, kind, label, place_id, reason) values
    (p, 'place', 'Suggested place', 'synthetic-jazz', 'You both like Live music'),
    (p, 'place', 'Suggested place', 'synthetic-rooftop', 'You both like Travel');
  insert into public.date_plan_options (plan_id, kind, label, starts_at) values
    (p, 'time', 'QA Fri 7 PM', now() + interval '3 days'), (p, 'time', 'QA Sat 11 AM', now() + interval '4 days');
end $$;

-- Cal (outsider) sees nothing and cannot add or pick.
select set_config('request.jwt.claims', '{"sub":"0c000000-0000-4000-8000-00000000000c","role":"authenticated"}', true),
       set_config('request.jwt.claim.sub', '0c000000-0000-4000-8000-00000000000c', true);
set local role authenticated;
do $$ begin
  if exists (select 1 from public.date_plans) or exists (select 1 from public.date_plan_options) then
    raise exception 'CHECK FAILED: an outsider can see the date plan';
  end if;
end $$;
reset role;

-- Ava adds her own place and picks; Ben picks the same place and time -> confirmed.
select set_config('request.jwt.claims', '{"sub":"0c000000-0000-4000-8000-00000000000a","role":"authenticated"}', true),
       set_config('request.jwt.claim.sub', '0c000000-0000-4000-8000-00000000000a', true);
set local role authenticated;
do $$
declare p uuid;
begin
  select id into p from public.date_plans;
  if p is null then raise exception 'CHECK FAILED: Ava should see the plan'; end if;
  insert into public.date_plan_options (plan_id, kind, label, created_by) values (p, 'place', 'QA taco spot', '0c000000-0000-4000-8000-00000000000a');
  insert into public.date_plan_picks (option_id, member_id) select id, '0c000000-0000-4000-8000-00000000000a' from public.date_plan_options where place_id = 'synthetic-jazz' or label in ('QA Sat 11 AM', 'QA Fri 7 PM');
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"0c000000-0000-4000-8000-00000000000b","role":"authenticated"}', true),
       set_config('request.jwt.claim.sub', '0c000000-0000-4000-8000-00000000000b', true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.date_plan_options) <> 5 then raise exception 'CHECK FAILED: Ben should see all 5 options including Ava''s'; end if;
  insert into public.date_plan_picks (option_id, member_id) select id, '0c000000-0000-4000-8000-00000000000b' from public.date_plan_options where label = 'QA Sat 11 AM';
  if (select status from public.date_plans) <> 'open' then raise exception 'CHECK FAILED: no shared place yet, plan must stay open'; end if;
  insert into public.date_plan_picks (option_id, member_id) select id, '0c000000-0000-4000-8000-00000000000b' from public.date_plan_options where place_id = 'synthetic-jazz';
  if (select status from public.date_plans) <> 'confirmed' then raise exception 'CHECK FAILED: plan should confirm when both pick the same place and time'; end if;
  if (select o.place_id from public.date_plans p join public.date_plan_options o on o.id = p.confirmed_place) <> 'synthetic-jazz' then raise exception 'CHECK FAILED: wrong confirmed place'; end if;
  if (select o.label from public.date_plans p join public.date_plan_options o on o.id = p.confirmed_time) <> 'QA Sat 11 AM' then raise exception 'CHECK FAILED: wrong confirmed time'; end if;
end $$;
reset role;

-- Live updates are switched on for chat and the planner.
do $$ begin
  if (select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'
       and tablename in ('messages', 'date_plans', 'date_plan_options', 'date_plan_picks')) <> 4 then
    raise exception 'CHECK FAILED: live updates are not enabled for chat and the planner';
  end if;
  raise exception 'RESULT: ALL DATE PLANNER CHECKS PASSED (all test data discarded)';
end $$;

rollback;
