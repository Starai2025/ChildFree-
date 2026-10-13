-- FREE MIDNIGHT / No Seeds: date planner + live chat.
-- Runs after 202610120002_matching_and_chat.sql. Paste into the SQL editor once.
--
-- After both people in a match have sent at least 5 messages, either of them can start a date
-- plan. The date-planner Edge Function (server side, Google Places key in Supabase secrets)
-- creates the plan with 3 suggested places near the halfway point between their ZIP codes and
-- 6 suggested times. Each member taps the places and times that work; either can add their own.
-- When both have picked the same place and the same time, the plan confirms itself.
-- Members never see each other's ZIP code or location; only the suggested public places.

create type public.date_plan_status as enum ('open', 'confirmed', 'cancelled');
create type public.date_option_kind as enum ('place', 'time');

-- ---------- Tables ----------
create table public.date_plans (
  id               uuid primary key default gen_random_uuid(),
  match_id         uuid not null references public.matches (id) on delete cascade,
  status           public.date_plan_status not null default 'open',
  midpoint_label   text check (char_length(midpoint_label) <= 120),
  created_by       uuid references public.profiles (id) on delete set null,
  confirmed_place  uuid,
  confirmed_time   uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
-- One live plan per match at a time.
create unique index date_plans_one_live_per_match on public.date_plans (match_id) where status <> 'cancelled';

create table public.date_plan_options (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.date_plans (id) on delete cascade,
  kind        public.date_option_kind not null,
  label       text not null check (char_length(btrim(label)) between 1 and 120),
  detail      text check (char_length(detail) <= 240),       -- address, or the kind of place
  reason      text check (char_length(reason) <= 120),       -- e.g. "You both like Live music"
  maps_url    text check (maps_url ~ '^https://'),
  rating      numeric(2, 1) check (rating between 0 and 5),
  starts_at   timestamptz,
  created_by  uuid references public.profiles (id) on delete cascade,  -- null = suggested by No Seeds
  created_at  timestamptz not null default now(),
  constraint date_plan_options_time_has_start check (kind <> 'time' or starts_at is not null)
);
create index date_plan_options_plan_idx on public.date_plan_options (plan_id, kind);

create table public.date_plan_picks (
  option_id   uuid not null references public.date_plan_options (id) on delete cascade,
  member_id   uuid not null references public.profiles (id) on delete cascade,
  plan_id     uuid not null references public.date_plans (id) on delete cascade,  -- filled in automatically
  created_at  timestamptz not null default now(),
  primary key (option_id, member_id)
);
create index date_plan_picks_plan_idx on public.date_plan_picks (plan_id);

-- ZIP code -> map point cache for the halfway-point search. Only the server (service role) uses it.
create table public.zip_locations (
  zip         text primary key check (zip ~ '^[0-9]{5}$'),
  lat         double precision not null,
  lng         double precision not null,
  updated_at  timestamptz not null default now()
);

-- ---------- Helpers ----------
-- The signed-in member belongs to this plan's match and the match is still open.
create function app_private.can_use_plan(p_plan uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.date_plans dp
     where dp.id = p_plan and app_private.can_use_match(dp.match_id)
  );
$$;

create function app_private.plan_is_open(p_plan uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.date_plans where id = p_plan and status = 'open');
$$;

-- Both people in the match have sent at least 5 messages each.
create function public.date_planner_ready(p_match uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app_private.can_use_match(p_match)
     and (select count(*) from (
            select msg.sender_id from public.messages msg
             where msg.match_id = p_match
             group by msg.sender_id
            having count(*) >= 5
          ) senders) = 2;
$$;

-- Picks remember their plan, and only point at options in that plan.
create function public.date_plan_picks_fill_plan() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select plan_id into new.plan_id from public.date_plan_options where id = new.option_id;
  return new;
end;
$$;
create trigger date_plan_picks_fill_plan
  before insert on public.date_plan_picks
  for each row execute function public.date_plan_picks_fill_plan();

-- Members may add at most 5 options of their own to a plan.
create function public.date_plan_options_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is not null and (
    select count(*) from public.date_plan_options where plan_id = new.plan_id and created_by = new.created_by
  ) >= 5 then
    raise exception 'You can add up to 5 of your own options to a date plan.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger date_plan_options_guard
  before insert on public.date_plan_options
  for each row execute function public.date_plan_options_guard();

-- When both members have picked the same place and the same time, the plan is confirmed:
-- the place they both picked first and the earliest time they both picked.
create function public.date_plan_confirm_when_agreed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_place uuid;
  v_time  uuid;
begin
  select o.id into v_place
    from public.date_plan_options o join public.date_plan_picks pk on pk.option_id = o.id
   where o.plan_id = new.plan_id and o.kind = 'place'
   group by o.id, o.created_at
  having count(distinct pk.member_id) >= 2
   order by o.created_at
   limit 1;
  select o.id into v_time
    from public.date_plan_options o join public.date_plan_picks pk on pk.option_id = o.id
   where o.plan_id = new.plan_id and o.kind = 'time'
   group by o.id, o.starts_at
  having count(distinct pk.member_id) >= 2
   order by o.starts_at
   limit 1;
  if v_place is not null and v_time is not null then
    update public.date_plans
       set status = 'confirmed', confirmed_place = v_place, confirmed_time = v_time, updated_at = now()
     where id = new.plan_id and status = 'open';
  end if;
  return new;
end;
$$;
create trigger date_plan_picks_confirm
  after insert on public.date_plan_picks
  for each row execute function public.date_plan_confirm_when_agreed();

-- ---------- Access ----------
alter table public.date_plans enable row level security;
alter table public.date_plan_options enable row level security;
alter table public.date_plan_picks enable row level security;
alter table public.zip_locations enable row level security;  -- no policies: server only

revoke all on public.date_plans, public.date_plan_options, public.date_plan_picks, public.zip_locations from anon, authenticated;
grant select on public.date_plans to authenticated;
grant select, insert, delete on public.date_plan_options to authenticated;
grant select, insert, delete on public.date_plan_picks to authenticated;

create policy "date plans: match members read" on public.date_plans
  for select to authenticated using (app_private.can_use_match(match_id));

create policy "date options: match members read" on public.date_plan_options
  for select to authenticated using (app_private.can_use_plan(plan_id));
create policy "date options: add your own while open" on public.date_plan_options
  for insert to authenticated
  with check (created_by = (select auth.uid()) and app_private.can_use_plan(plan_id) and app_private.plan_is_open(plan_id)
              and maps_url is null and rating is null);
create policy "date options: remove your own while open" on public.date_plan_options
  for delete to authenticated
  using (created_by = (select auth.uid()) and app_private.plan_is_open(plan_id));

create policy "date picks: match members read" on public.date_plan_picks
  for select to authenticated using (app_private.can_use_plan(plan_id));
create policy "date picks: pick for yourself while open" on public.date_plan_picks
  for insert to authenticated
  with check (member_id = (select auth.uid())
              and app_private.can_use_plan((select o.plan_id from public.date_plan_options o where o.id = option_id))
              and app_private.plan_is_open((select o.plan_id from public.date_plan_options o where o.id = option_id)));
create policy "date picks: unpick your own while open" on public.date_plan_picks
  for delete to authenticated
  using (member_id = (select auth.uid()) and app_private.plan_is_open(plan_id));

revoke execute on function app_private.can_use_plan(uuid), app_private.plan_is_open(uuid) from public, anon;
grant execute on function app_private.can_use_plan(uuid), app_private.plan_is_open(uuid) to authenticated;
revoke execute on function public.date_planner_ready(uuid), public.date_plan_picks_fill_plan(),
  public.date_plan_options_guard(), public.date_plan_confirm_when_agreed() from public, anon, authenticated;
grant execute on function public.date_planner_ready(uuid) to authenticated;

-- ---------- Live updates (Supabase Realtime respects the read policies above) ----------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['messages', 'date_plans', 'date_plan_options', 'date_plan_picks'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
