-- FREE MIDNIGHT public web beta: applicant profiles, optional photos, founder review.
-- Paste into the Supabase SQL editor (or run as a migration). Safe to run once on a fresh project.
-- Applicants sign in by email and can only see and change their own rows.
-- Founder review runs through the service role (the admin-review Edge Function); nothing here is public.

-- ---------- Status ----------
create type public.profile_status as enum ('draft', 'submitted', 'approved', 'changes_requested', 'removed');

-- ---------- Profiles (one row per auth user) ----------
create table public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  status              public.profile_status not null default 'draft',
  first_name          text check (char_length(btrim(first_name)) between 1 and 40),
  birth_date          date,
  gender              text check (gender in ('Woman', 'Man', 'Non-binary')),
  seeking             text[] not null default '{}' check (seeking <@ array['Woman', 'Man', 'Non-binary']),
  age_min             smallint not null default 25 check (age_min between 18 and 99),
  age_max             smallint not null default 60 check (age_max between 18 and 99),
  city                text check (char_length(city) <= 60),
  zip                 text check (zip ~ '^[0-9]{5}$'),
  relationship_goal   text check (char_length(relationship_goal) <= 60),
  marriage_view       text check (char_length(marriage_view) <= 60),
  bio                 text check (char_length(bio) <= 500),
  -- [{"id": "ordinary_sunday", "answer": "..."}], up to four prompts
  prompts             jsonb not null default '[]' check (jsonb_typeof(prompts) = 'array' and jsonb_array_length(prompts) <= 4),
  -- height, faith, politics, education, drinking, smoking, cannabis
  basics              jsonb not null default '{}' check (jsonb_typeof(basics) = 'object'),
  interests           text[] not null default '{}' check (cardinality(interests) <= 6),
  -- the ten optional "life you'd share" answers
  compatibility       jsonb not null default '{}' check (jsonb_typeof(compatibility) = 'object'),
  -- self-reported eligibility answers; never shown to other members
  eligibility         jsonb not null default '{}' check (jsonb_typeof(eligibility) = 'object'),
  pledge_accepted_at  timestamptz,
  submitted_at        timestamptz,
  reviewed_at         timestamptz,
  review_note         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint profiles_age_range check (age_min <= age_max)
);

-- ---------- Photos (files live in the private profile-photos bucket) ----------
create table public.profile_photos (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  storage_path  text not null unique,
  position      smallint not null check (position between 0 and 5),
  created_at    timestamptz not null default now(),
  constraint profile_photos_one_per_slot unique (profile_id, position),
  -- a row can only point at a file inside the owner's own folder: "<profile_id>/<file>"
  constraint profile_photos_own_folder check (storage_path like profile_id::text || '/%')
);
create index profile_photos_profile_idx on public.profile_photos (profile_id);

-- ---------- Founder review log (service role only) ----------
create table public.admin_reviews (
  id          bigint generated always as identity primary key,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  decision    public.profile_status not null check (decision in ('approved', 'changes_requested', 'removed')),
  note        text check (char_length(note) <= 1000),
  reviewer    text not null default 'founder',
  created_at  timestamptz not null default now()
);
create index admin_reviews_profile_idx on public.admin_reviews (profile_id, created_at desc);
create index profiles_review_queue_idx on public.profiles (submitted_at) where status = 'submitted';

-- ---------- Rules applicants cannot bypass ----------
-- True for the service role, the SQL editor and other privileged sessions.
create function public.is_privileged() returns boolean
language sql stable as $$
  select current_user in ('service_role', 'postgres', 'supabase_admin');
$$;

-- What a profile needs before it can be submitted for review. Photos are optional.
create function public.profile_missing(p public.profiles) returns text[]
language sql stable as $$
  select array_remove(array[
    case when p.first_name is null then 'first name' end,
    case when p.birth_date is null then 'date of birth'
         when p.birth_date > current_date - interval '18 years' then 'must be 18 or older' end,
    case when p.gender is null then 'gender' end,
    case when cardinality(p.seeking) = 0 then 'who you would like to meet' end,
    case when p.city is null or btrim(p.city) = '' then 'city' end,
    case when p.zip is null then 'ZIP code' end,
    case when p.relationship_goal is null then 'relationship goal' end,
    case when jsonb_array_length(p.prompts) < 2 then 'at least two prompts' end,
    case when p.eligibility = '{}'::jsonb then 'eligibility answers' end,
    case when p.pledge_accepted_at is null then 'community pledge' end
  ], null);
$$;

create function public.profiles_guard() returns trigger
language plpgsql as $$
declare
  missing text[];
begin
  new.updated_at := now();
  if public.is_privileged() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Applicants always start as a draft with no review history.
    new.status := 'draft';
    new.submitted_at := null;
    new.reviewed_at := null;
    new.review_note := null;
    new.created_at := now();
    return new;
  end if;

  -- Applicants can never change identity or review fields.
  if new.id <> old.id then raise exception 'profile id cannot change'; end if;
  new.created_at := old.created_at;
  new.reviewed_at := old.reviewed_at;
  new.review_note := old.review_note;

  if old.status = 'removed' then
    raise exception 'this profile has been removed';
  end if;

  if new.status is distinct from old.status then
    -- The only status an applicant may set is "submitted", from a draft or after changes were requested.
    if not (new.status = 'submitted' and old.status in ('draft', 'changes_requested')) then
      raise exception 'applicants cannot change status from % to %', old.status, new.status;
    end if;
  elsif old.status = 'approved' then
    -- Editing an approved profile sends it back for review.
    new.status := 'submitted';
  end if;

  if new.status = 'submitted' then
    missing := public.profile_missing(new);
    if cardinality(missing) > 0 then
      raise exception 'profile is incomplete: %', array_to_string(missing, ', ');
    end if;
    if old.status <> 'submitted' then
      new.submitted_at := now();
    else
      new.submitted_at := old.submitted_at;
    end if;
  else
    new.submitted_at := old.submitted_at;
  end if;
  return new;
end;
$$;

create trigger profiles_guard
  before insert or update on public.profiles
  for each row execute function public.profiles_guard();

-- A founder decision is one insert into admin_reviews; this applies it to the profile.
create function public.apply_admin_review() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  current_status public.profile_status;
begin
  select status into current_status from public.profiles where id = new.profile_id for update;
  if current_status is null then
    raise exception 'profile % not found', new.profile_id;
  end if;
  if new.decision in ('approved', 'changes_requested') and current_status <> 'submitted' then
    raise exception 'only submitted profiles can be %, this one is %', new.decision, current_status;
  end if;
  update public.profiles
     set status = new.decision, reviewed_at = now(), review_note = new.note
   where id = new.profile_id;
  return new;
end;
$$;

create trigger admin_reviews_apply
  after insert on public.admin_reviews
  for each row execute function public.apply_admin_review();

-- Every new sign-up gets an empty draft, so the app only ever updates its own row.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Row level security ----------
alter table public.profiles enable row level security;
alter table public.profile_photos enable row level security;
alter table public.admin_reviews enable row level security;

revoke all on public.profiles, public.profile_photos, public.admin_reviews from anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.profile_photos to authenticated;
-- admin_reviews: no grants and no policies, so only the service role (which bypasses RLS) can use it.

-- The guard trigger runs as the applicant, so they need to call the completeness check (it only reads the row being saved).
revoke execute on function public.profile_missing(public.profiles) from public, anon;
grant execute on function public.profile_missing(public.profiles) to authenticated;
revoke execute on function public.apply_admin_review() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create policy "own profile: read" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "own profile: create" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "own profile: update" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "own profile: delete" on public.profiles
  for delete to authenticated using (id = (select auth.uid()));

create policy "own photos: read" on public.profile_photos
  for select to authenticated using (profile_id = (select auth.uid()));
create policy "own photos: add" on public.profile_photos
  for insert to authenticated with check (profile_id = (select auth.uid()));
create policy "own photos: change" on public.profile_photos
  for update to authenticated using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
create policy "own photos: remove" on public.profile_photos
  for delete to authenticated using (profile_id = (select auth.uid()));

-- ---------- Private photo bucket ----------
-- Files are stored as "<user id>/<file name>". Max 5 MB; JPEG, PNG or WebP only. Nothing is public.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "profile photos: owner reads" on storage.objects
  for select to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "profile photos: owner uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "profile photos: owner replaces" on storage.objects
  for update to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "profile photos: owner deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
