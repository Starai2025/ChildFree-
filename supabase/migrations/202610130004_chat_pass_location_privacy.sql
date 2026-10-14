-- NO SEEDS: typing indicators, final passes, and private distance matching.
-- Runs after 202610130003_date_planner_and_live_chat.sql.

-- ---------- Typing indicators ----------
create table public.match_typing (
  match_id    uuid not null references public.matches (id) on delete cascade,
  member_id   uuid not null references public.profiles (id) on delete cascade,
  updated_at  timestamptz not null default now(),
  primary key (match_id, member_id)
);

alter table public.match_typing enable row level security;
revoke all on public.match_typing from anon, authenticated;
grant select, insert, update, delete on public.match_typing to authenticated;

create policy "typing: match members read" on public.match_typing
  for select to authenticated using (app_private.can_use_match(match_id));
create policy "typing: set own in open match" on public.match_typing
  for insert to authenticated
  with check (member_id = (select auth.uid()) and app_private.can_use_match(match_id));
create policy "typing: update own in open match" on public.match_typing
  for update to authenticated
  using (member_id = (select auth.uid()) and app_private.can_use_match(match_id))
  with check (member_id = (select auth.uid()) and app_private.can_use_match(match_id));
create policy "typing: clear own" on public.match_typing
  for delete to authenticated using (member_id = (select auth.uid()));

-- ---------- Final pass / no means no ----------
create function app_private.has_pass_between(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profile_reactions
     where kind = 'pass'
       and ((actor_id = p_a and target_id = p_b) or (actor_id = p_b and target_id = p_a))
  );
$$;

create or replace function public.reactions_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.is_approved(new.actor_id) then
    raise exception 'only approved members can like or pass';
  end if;
  if not app_private.is_approved(new.target_id) then
    raise exception 'that profile is not available';
  end if;
  if app_private.is_blocked_between(new.actor_id, new.target_id) then
    raise exception 'that profile is not available';
  end if;
  if tg_op = 'UPDATE' then
    new.actor_id := old.actor_id;
    new.target_id := old.target_id;
    if old.kind = 'pass' and new.kind <> 'pass' then
      raise exception 'passes are final';
    end if;
  end if;
  if new.kind = 'like' and exists (
       select 1 from public.profile_reactions r
        where r.kind = 'pass'
          and (
            (r.actor_id = new.actor_id and r.target_id = new.target_id)
            or (r.actor_id = new.target_id and r.target_id = new.actor_id)
          ))
  then
    raise exception 'that profile is not available';
  end if;
  new.created_at := now();
  return new;
end;
$$;

create function public.close_match_on_pass() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'pass' then
    delete from public.profile_reactions
      where actor_id = new.target_id
        and target_id = new.actor_id
        and kind = 'like';
    perform app_private.close_matches_between(new.actor_id, new.target_id, 'passed');
  end if;
  return new;
end;
$$;

create trigger profile_reactions_close_on_pass
  after insert or update of kind on public.profile_reactions
  for each row execute function public.close_match_on_pass();

-- ---------- Private distance matching ----------
create function app_private.travel_miles(p_basics jsonb) returns integer
language sql immutable set search_path = '' as $$
  select case
    when lower(coalesce(p_basics->>'travelDistance', '')) = 'anywhere' then null
    when coalesce(p_basics->>'travelDistance', '') ~ '[0-9]+' then substring(p_basics->>'travelDistance' from '[0-9]+')::integer
    else 50
  end;
$$;

create function app_private.zip_distance_miles(p_a text, p_b text) returns numeric
language sql stable security definer set search_path = '' as $$
  select case
    when za.zip is null or zb.zip is null then null
    else 3958.7613 * 2 * asin(sqrt(
      power(sin(radians((zb.lat - za.lat) / 2)), 2) +
      cos(radians(za.lat)) * cos(radians(zb.lat)) *
      power(sin(radians((zb.lng - za.lng) / 2)), 2)
    ))
  end
  from (select 1) seed
  left join public.zip_locations za on za.zip = p_a
  left join public.zip_locations zb on zb.zip = p_b;
$$;

create function app_private.travel_compatible(p_a_zip text, p_a_basics jsonb, p_b_zip text, p_b_basics jsonb) returns boolean
language sql stable security definer set search_path = '' as $$
  with limits as (
    select app_private.travel_miles(p_a_basics) as a_miles,
           app_private.travel_miles(p_b_basics) as b_miles,
           app_private.zip_distance_miles(p_a_zip, p_b_zip) as miles
  )
  select case
    when miles is null then true
    when a_miles is null or b_miles is null then true
    else miles <= least(a_miles, b_miles)
  end
  from limits;
$$;

create or replace function public.member_cards(p_ids uuid[] default null, p_limit integer default 20)
returns table (
  id uuid, first_name text, age integer, gender text, city text, relationship_goal text,
  marriage_view text, bio text, prompts jsonb, basics jsonb, interests text[],
  compatibility jsonb, photo_paths text[]
)
language sql stable security definer set search_path = '' as $$
  with me as (
    select p.* from public.profiles p where p.id = (select auth.uid()) and p.status = 'approved'
  )
  select c.id, c.first_name, extract(year from age(c.birth_date))::integer, c.gender, c.city,
         c.relationship_goal, c.marriage_view, c.bio, c.prompts, c.basics, c.interests, c.compatibility,
         coalesce((select array_agg(ph.storage_path order by ph.position)
                     from public.profile_photos ph where ph.profile_id = c.id), '{}')
    from me, public.profiles c
   where c.status = 'approved'
     and c.id <> me.id
     and not app_private.is_blocked_between(me.id, c.id)
     and not app_private.has_pass_between(me.id, c.id)
     and app_private.travel_compatible(me.zip, me.basics, c.zip, c.basics)
     and (
       (p_ids is not null and c.id = any (p_ids))
       or (p_ids is null
           and c.gender = any (me.seeking) and me.gender = any (c.seeking)
           and extract(year from age(c.birth_date)) between me.age_min and me.age_max
           and extract(year from age(me.birth_date)) between c.age_min and c.age_max
           and not exists (select 1 from public.profile_reactions r where r.actor_id = me.id and r.target_id = c.id))
     )
   order by c.updated_at desc
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

create or replace function public.likes_received()
returns table (
  id uuid, first_name text, age integer, gender text, city text, relationship_goal text,
  marriage_view text, bio text, prompts jsonb, basics jsonb, interests text[],
  compatibility jsonb, photo_paths text[], liked_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select c.*, r.created_at
    from public.profile_reactions r
    cross join lateral public.member_cards(array[r.actor_id]) c
   where r.target_id = (select auth.uid()) and r.kind = 'like'
     and not app_private.has_pass_between((select auth.uid()), r.actor_id)
     and not exists (select 1 from public.profile_reactions mine
                      where mine.actor_id = (select auth.uid()) and mine.target_id = r.actor_id)
   order by r.created_at desc;
$$;

revoke execute on function app_private.has_pass_between(uuid, uuid), app_private.travel_miles(jsonb),
  app_private.zip_distance_miles(text, text), app_private.travel_compatible(text, jsonb, text, jsonb)
  from public, anon;
grant execute on function app_private.has_pass_between(uuid, uuid), app_private.travel_miles(jsonb),
  app_private.zip_distance_miles(text, text), app_private.travel_compatible(text, jsonb, text, jsonb)
  to authenticated;
revoke execute on function public.close_match_on_pass() from public, anon, authenticated;
grant execute on function public.member_cards(uuid[], integer), public.likes_received() to authenticated;

-- Live updates for chat typing. Supabase Realtime still applies the RLS policies above.
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['match_typing'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
