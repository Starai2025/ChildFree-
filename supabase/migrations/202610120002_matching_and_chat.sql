-- FREE MIDNIGHT public web beta: likes/passes, mutual matches, chat and blocks.
-- Runs after 202610120001_public_beta_profiles.sql. Paste into the SQL editor once.
-- Only approved members take part. Visitors see nothing. Matches and messages are
-- created and closed by the database rules below, never trusted from the browser.

create type public.reaction_kind as enum ('like', 'pass');
create type public.match_status as enum ('active', 'closed');

-- ---------- Tables ----------
create table public.profile_reactions (
  actor_id    uuid not null references public.profiles (id) on delete cascade,
  target_id   uuid not null references public.profiles (id) on delete cascade,
  kind        public.reaction_kind not null,
  created_at  timestamptz not null default now(),
  primary key (actor_id, target_id),
  constraint profile_reactions_not_self check (actor_id <> target_id)
);
create index profile_reactions_target_idx on public.profile_reactions (target_id, kind);

create table public.matches (
  id             uuid primary key default gen_random_uuid(),
  user_one       uuid not null references public.profiles (id) on delete cascade,
  user_two       uuid not null references public.profiles (id) on delete cascade,
  status         public.match_status not null default 'active',
  created_at     timestamptz not null default now(),
  closed_at      timestamptz,
  closed_reason  text check (char_length(closed_reason) <= 200),
  -- The pair is stored in a fixed order, so one pair can only ever have one match row.
  constraint matches_ordered_pair check (user_one < user_two),
  constraint matches_one_per_pair unique (user_one, user_two)
);
create index matches_user_two_idx on public.matches (user_two);

create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches (id) on delete cascade,
  sender_id   uuid not null references public.profiles (id) on delete cascade,
  body        text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index messages_match_created_idx on public.messages (match_id, created_at);

create table public.blocks (
  blocker_id  uuid not null references public.profiles (id) on delete cascade,
  blocked_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

-- ---------- Helpers (run as the definer so policies stay simple and non-recursive) ----------
-- They live in app_private, which the Supabase API does not expose, so members cannot call them
-- directly (for example to ask whether two other people have blocked each other).
create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated;

create function app_private.is_approved(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = p_user and status = 'approved');
$$;

create function app_private.is_blocked_between(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocks
     where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a)
  );
$$;

-- The signed-in user belongs to this match and it is still open for reading and writing.
create function app_private.can_use_match(p_match uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.matches m
     where m.id = p_match
       and m.status = 'active'
       and (select auth.uid()) in (m.user_one, m.user_two)
       and app_private.is_approved(m.user_one) and app_private.is_approved(m.user_two)
       and not app_private.is_blocked_between(m.user_one, m.user_two)
  );
$$;

create function app_private.close_matches_between(p_a uuid, p_b uuid, p_reason text) returns void
language sql security definer set search_path = '' as $$
  update public.matches
     set status = 'closed', closed_at = now(), closed_reason = p_reason
   where status = 'active' and user_one = least(p_a, p_b) and user_two = greatest(p_a, p_b);
$$;

-- ---------- Reactions: approved members only, never themselves, never across a block ----------
create function public.reactions_guard() returns trigger
language plpgsql set search_path = '' as $$
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
  end if;
  new.created_at := now();
  return new;
end;
$$;

create trigger profile_reactions_guard
  before insert or update on public.profile_reactions
  for each row execute function public.reactions_guard();

-- A like that meets a like back creates the match. ON CONFLICT makes repeats and races harmless.
create function public.create_match_on_mutual_like() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'like' and exists (
       select 1 from public.profile_reactions r
        where r.actor_id = new.target_id and r.target_id = new.actor_id and r.kind = 'like')
  then
    insert into public.matches (user_one, user_two)
    values (least(new.actor_id, new.target_id), greatest(new.actor_id, new.target_id))
    on conflict on constraint matches_one_per_pair do nothing;
  end if;
  return new;
end;
$$;

create trigger profile_reactions_mutual_like
  after insert or update of kind on public.profile_reactions
  for each row execute function public.create_match_on_mutual_like();

-- ---------- Blocks and removals close conversations ----------
create function public.close_matches_on_block() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.close_matches_between(new.blocker_id, new.blocked_id, 'blocked');
  return new;
end;
$$;

create trigger blocks_close_matches
  after insert on public.blocks
  for each row execute function public.close_matches_on_block();

create function public.close_matches_on_removal() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.matches
     set status = 'closed', closed_at = now(), closed_reason = 'profile removed'
   where status = 'active' and new.id in (user_one, user_two);
  return new;
end;
$$;

create trigger profiles_close_matches_on_removal
  after update of status on public.profiles
  for each row when (new.status = 'removed' and old.status is distinct from 'removed')
  execute function public.close_matches_on_removal();

-- A member ends a match ("unmatch"). Closed matches stay closed.
create function public.close_match(p_match uuid, p_reason text default 'unmatched') returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.matches
     set status = 'closed', closed_at = now(), closed_reason = left(coalesce(nullif(btrim(p_reason), ''), 'unmatched'), 200)
   where id = p_match and status = 'active' and (select auth.uid()) in (user_one, user_two);
  if not found then
    raise exception 'match not found or already closed';
  end if;
end;
$$;

-- ---------- What approved members may see of each other ----------
-- Public card fields only: never birth date, ZIP, eligibility answers or review notes.
-- With no ids it returns today's discovery candidates (approved, mutually compatible,
-- not blocked, not already reacted to). With ids it returns those members' cards if visible.
create function public.member_cards(p_ids uuid[] default null, p_limit integer default 20)
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

-- Approved members may view photos of other approved members they are not blocked from.
create function app_private.can_view_member_photos(p_owner text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles o
     where o.id::text = p_owner and o.status = 'approved'
       and app_private.is_approved((select auth.uid()))
       and not app_private.is_blocked_between((select auth.uid()), o.id)
  );
$$;

create policy "profile photos: approved members view approved members" on storage.objects
  for select to authenticated
  using (bucket_id = 'profile-photos' and app_private.can_view_member_photos((storage.foldername(name))[1]));

-- ---------- Row level security ----------
alter table public.profile_reactions enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;

revoke all on public.profile_reactions, public.matches, public.messages, public.blocks from anon, authenticated;
grant select, insert, update on public.profile_reactions to authenticated;
grant select on public.matches to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert, delete on public.blocks to authenticated;

create policy "reactions: read own" on public.profile_reactions
  for select to authenticated using (actor_id = (select auth.uid()));
create policy "reactions: add own" on public.profile_reactions
  for insert to authenticated with check (actor_id = (select auth.uid()));
create policy "reactions: change own" on public.profile_reactions
  for update to authenticated using (actor_id = (select auth.uid())) with check (actor_id = (select auth.uid()));

create policy "matches: members read" on public.matches
  for select to authenticated using ((select auth.uid()) in (user_one, user_two));

create policy "messages: read in open matches" on public.messages
  for select to authenticated using (app_private.can_use_match(match_id));
create policy "messages: send in open matches" on public.messages
  for insert to authenticated
  with check (sender_id = (select auth.uid()) and app_private.can_use_match(match_id));

create policy "blocks: read own" on public.blocks
  for select to authenticated using (blocker_id = (select auth.uid()));
create policy "blocks: add own" on public.blocks
  for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy "blocks: remove own" on public.blocks
  for delete to authenticated using (blocker_id = (select auth.uid()));

-- Functions: only what policies need, plus the two member-facing calls.
revoke execute on all functions in schema app_private from public, anon;
grant execute on function app_private.is_approved(uuid), app_private.is_blocked_between(uuid, uuid),
  app_private.can_use_match(uuid), app_private.can_view_member_photos(text) to authenticated;
revoke execute on function public.reactions_guard(), public.create_match_on_mutual_like(), public.close_matches_on_block(),
  public.close_matches_on_removal(), public.close_match(uuid, text), public.member_cards(uuid[], integer)
  from public, anon;
grant execute on function public.close_match(uuid, text), public.member_cards(uuid[], integer) to authenticated;
