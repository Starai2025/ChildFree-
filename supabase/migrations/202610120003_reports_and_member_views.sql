-- FREE MIDNIGHT public web beta: safety reports, plus the two member views the app needs
-- (my matches with the other person's card and last message, and who liked me).
-- Runs after 202610120002_matching_and_chat.sql. Paste into the SQL editor once.

-- ---------- Reports ----------
create type public.report_reason as enum
  ('fake_or_misleading', 'harassment', 'sexual_content', 'scam_or_money', 'underage', 'safety_concern', 'other');
create type public.report_status as enum ('open', 'reviewed', 'actioned');

create table public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null references public.profiles (id) on delete cascade,
  reported_id      uuid not null references public.profiles (id) on delete cascade,
  match_id         uuid references public.matches (id) on delete set null,
  reason           public.report_reason not null,
  details          text check (char_length(details) <= 1000),
  status           public.report_status not null default 'open',
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz,
  resolution_note  text check (char_length(resolution_note) <= 1000),
  constraint reports_not_self check (reporter_id <> reported_id)
);
create index reports_open_idx on public.reports (created_at) where status = 'open';
create index reports_reported_idx on public.reports (reported_id);

-- Members file reports; only the founder (service role) changes their status.
create function public.reports_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.is_privileged() then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    raise exception 'reports cannot be changed after they are sent';
  end if;
  new.status := 'open';
  new.resolved_at := null;
  new.resolution_note := null;
  new.created_at := now();
  if new.match_id is not null and not exists (
       select 1 from public.matches m
        where m.id = new.match_id and new.reporter_id in (m.user_one, m.user_two) and new.reported_id in (m.user_one, m.user_two))
  then
    raise exception 'that match does not belong to this report';
  end if;
  return new;
end;
$$;

create trigger reports_guard
  before insert or update on public.reports
  for each row execute function public.reports_guard();

alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant select, insert on public.reports to authenticated;

create policy "reports: file own" on public.reports
  for insert to authenticated with check (reporter_id = (select auth.uid()));
create policy "reports: read own" on public.reports
  for select to authenticated using (reporter_id = (select auth.uid()));

-- ---------- My matches: open conversations with the other person's card and the latest message ----------
create function public.my_matches()
returns table (
  match_id uuid, matched_at timestamptz, other_id uuid, other_first_name text, other_age integer,
  other_city text, other_photo_path text, last_message text, last_message_at timestamptz, last_message_mine boolean
)
language sql stable security definer set search_path = '' as $$
  select m.id, m.created_at, o.id, o.first_name, extract(year from age(o.birth_date))::integer, o.city,
         (select ph.storage_path from public.profile_photos ph where ph.profile_id = o.id order by ph.position limit 1),
         lm.body, lm.created_at, lm.sender_id = (select auth.uid())
    from public.matches m
    join public.profiles o
      on o.id = case when m.user_one = (select auth.uid()) then m.user_two else m.user_one end
    left join lateral (
      select msg.body, msg.created_at, msg.sender_id from public.messages msg
       where msg.match_id = m.id order by msg.created_at desc limit 1
    ) lm on true
   where (select auth.uid()) in (m.user_one, m.user_two)
     and app_private.can_use_match(m.id)
   order by coalesce(lm.created_at, m.created_at) desc;
$$;

-- ---------- Likes you: approved people who liked me and I have not answered yet ----------
create function public.likes_received()
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
     and not exists (select 1 from public.profile_reactions mine
                      where mine.actor_id = (select auth.uid()) and mine.target_id = r.actor_id)
   order by r.created_at desc;
$$;

revoke execute on function public.reports_guard(), public.my_matches(), public.likes_received() from public, anon;
grant execute on function public.my_matches(), public.likes_received() to authenticated;
