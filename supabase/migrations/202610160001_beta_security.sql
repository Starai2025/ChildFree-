-- Invite-only public beta. No grandfathered consent or founder/email inference.
-- app_private MUST remain excluded from the Data API exposed schemas.
begin;

create table app_private.founder_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create table app_private.beta_invites (
  email text primary key check (email = lower(btrim(email)) and char_length(email) between 3 and 254),
  invited_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  bound_user_id uuid unique references auth.users(id) on delete set null,
  revoked_at timestamptz
);
create table app_private.agreement_acceptances (
  user_id uuid not null references auth.users(id) on delete cascade,
  version text not null check (version = '2026-10-16.1'),
  accepted_at timestamptz not null default now(),
  terms_version text not null default '2026-10-14',
  privacy_version text not null default '2026-10-14',
  pledge_version text not null default '2026-10-16.1',
  -- SHA-256 of the exact published documents, UTF-8 with LF line endings.
  terms_sha256 text not null default '07a3d22350028bf7fad96be7f639c7a40085ccdb8e0f9e8d110df9a54e5d8af0',
  privacy_sha256 text not null default '8cbf4f4ee05855f7fe1a832d39031d4b912979a514ddcbdd709c658b0f5beaa6',
  eligibility jsonb not null,
  primary key (user_id, version)
);
create table app_private.founder_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  action text not null,
  target_id text,
  created_at timestamptz not null default now()
);
create table app_private.beta_capacity (
  singleton boolean primary key default true check (singleton),
  approved_count integer not null default 0 check (approved_count between 0 and 50)
);
insert into app_private.beta_capacity values (true, 0);
alter table app_private.founder_admins enable row level security;
alter table app_private.beta_invites enable row level security;
alter table app_private.agreement_acceptances enable row level security;
alter table app_private.founder_audit enable row level security;
alter table app_private.beta_capacity enable row level security;
revoke all on app_private.founder_admins, app_private.beta_invites,
  app_private.agreement_acceptances, app_private.founder_audit, app_private.beta_capacity
  from public, anon, authenticated, service_role;

create function app_private.eligible(p_answers jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(p_answers) = 'object' and
    p_answers @> '{"black":true,"noChildren":true,"neverChildren":true,"noStepParent":true,"honest":true,"respect":true}'::jsonb, false);
$$;

create or replace function public.profile_missing(p public.profiles) returns text[]
language sql stable set search_path = '' as $$
  select array_remove(array[
    case when p.first_name is null or btrim(p.first_name) = '' then 'first name' end,
    case when p.birth_date is null then 'date of birth'
         when p.birth_date > current_date - interval '18 years' then 'must be 18 or older' end,
    case when p.gender is null then 'gender' end,
    case when cardinality(p.seeking) = 0 then 'who you would like to meet' end,
    case when p.city is null or btrim(p.city) = '' then 'city' end,
    case when p.zip is null then 'ZIP code' end,
    case when p.relationship_goal is null or btrim(p.relationship_goal) = '' then 'relationship goal' end,
    case when (select count(*) from jsonb_array_elements(p.prompts) a
                 where jsonb_typeof(a) = 'object' and char_length(btrim(coalesce(a->>'answer',''))) > 0) < 2
         then 'at least two prompts' end,
    case when not app_private.eligible(p.eligibility) then 'all six eligibility answers must be true' end,
    case when p.pledge_accepted_at is null then 'community pledge' end
  ], null);
$$;

create function app_private.agreements_current(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from app_private.agreement_acceptances a
    where a.user_id = p_user and a.version = '2026-10-16.1' and app_private.eligible(a.eligibility));
$$;

-- This returns only the caller's access state; role assignment is SQL-editor-only.
create function app_private.founder_access() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'founder', exists (select 1 from app_private.founder_admins f
       join auth.users u on u.id = f.user_id
       where f.user_id = (select auth.uid()) and f.revoked_at is null and u.email_confirmed_at is not null),
    'mfa', coalesce((select auth.jwt())->>'aal' = 'aal2', false)
       and exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.status = 'verified' and f.factor_type = 'totp')
       and exists (select 1 from auth.sessions s where s.user_id = (select auth.uid())
         and s.id::text = (select auth.jwt())->>'session_id' and (s.not_after is null or s.not_after > now()))
  );
$$;
create function public.founder_access() returns jsonb
language sql stable security invoker set search_path = '' as $$ select app_private.founder_access(); $$;

create function app_private.require_founder() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare access jsonb := app_private.founder_access();
begin
  if access->>'founder' <> 'true' or access->>'mfa' <> 'true' then
    raise exception 'Founder login and MFA required' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

create function app_private.agreement_status() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('version', '2026-10-16.1', 'accepted', app_private.agreements_current((select auth.uid())));
$$;
create function public.agreement_status() returns jsonb
language sql stable security invoker set search_path = '' as $$ select app_private.agreement_status(); $$;

-- Explicit, authenticated acceptance. No caller-supplied identity, timestamp or document version.
create function app_private.accept_agreements(p_version text, p_answers jsonb, p_terms boolean, p_privacy boolean, p_pledge boolean)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); accepted timestamptz; snapshot jsonb;
begin
  if actor is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if p_version is distinct from '2026-10-16.1' or p_terms is distinct from true
     or p_privacy is distinct from true or p_pledge is distinct from true or not app_private.eligible(p_answers) then
    raise exception 'Confirm all six answers and the current Terms, Privacy Policy and Community Pledge';
  end if;
  perform 1 from public.profiles where id = actor and status <> 'removed' for update;
  if not found then raise exception 'Profile is unavailable'; end if;
  select jsonb_object_agg(k, p_answers->k) into snapshot from unnest(array['black','noChildren','neverChildren','noStepParent','honest','respect']) k;
  insert into app_private.agreement_acceptances (user_id, version, eligibility)
    values (actor, p_version, snapshot) on conflict (user_id, version) do nothing;
  select accepted_at into accepted from app_private.agreement_acceptances where user_id = actor and version = p_version;
  update public.profiles set eligibility = snapshot, pledge_accepted_at = accepted where id = actor;
  return accepted;
end;
$$;
create function public.accept_agreements(p_version text, p_answers jsonb, p_terms boolean, p_privacy boolean, p_pledge boolean)
returns timestamptz language sql security invoker set search_path = '' as $$
  select app_private.accept_agreements(p_version, p_answers, p_terms, p_privacy, p_pledge);
$$;

-- Preserve history, but never invent consent/invitations for existing accounts.
update public.profiles set status = 'changes_requested',
  review_note = 'Please confirm the current agreements and resubmit. Beta approval now requires a founder invitation.'
  where status in ('submitted', 'approved');

-- Runs after profiles_guard; applies even to service-role updates and review-trigger updates.
create function public.profiles_security_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare accepted timestamptz; invite_email text; missing text[]; slot integer;
begin
  select accepted_at into accepted from app_private.agreement_acceptances
    where user_id = new.id and version = '2026-10-16.1';
  new.pledge_accepted_at := accepted;
  if new.status in ('submitted','approved') then
    missing := public.profile_missing(new);
    if cardinality(missing) > 0 then raise exception 'profile is incomplete: %', array_to_string(missing, ', '); end if;
    if not app_private.agreements_current(new.id) then raise exception 'Accept the current agreements before submitting'; end if;
  end if;
  if new.status = 'approved' then
    select lower(btrim(email)) into invite_email from auth.users where id = new.id and email_confirmed_at is not null;
    perform 1 from app_private.beta_invites where email = invite_email and revoked_at is null
      and (bound_user_id is null or bound_user_id = new.id) for update;
    if not found then raise exception 'Approval requires an active invitation for the confirmed account email'; end if;
    update app_private.beta_invites set bound_user_id = new.id where email = invite_email;
  end if;
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status <> 'approved') then
    update app_private.beta_capacity set approved_count = approved_count + 1
      where singleton and approved_count < 50 returning approved_count into slot;
    if not found then raise exception 'The 50-member beta is full'; end if;
  elsif tg_op = 'UPDATE' and old.status = 'approved' and new.status <> 'approved' then
    update app_private.beta_capacity set approved_count = approved_count - 1 where singleton;
  end if;
  return new;
end;
$$;
create trigger profiles_security_guard before insert or update on public.profiles
  for each row execute function public.profiles_security_guard();

-- Deletion also frees the capacity slot (auth deletion cascades to the profile).
create function public.profiles_capacity_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'approved' then update app_private.beta_capacity set approved_count = approved_count - 1 where singleton; end if;
  return old;
end;
$$;
create trigger profiles_capacity_delete after delete on public.profiles for each row execute function public.profiles_capacity_delete();

create or replace function app_private.is_approved(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p join auth.users u on u.id = p.id
    join app_private.beta_invites i on i.bound_user_id = p.id and i.email = lower(btrim(u.email))
    where p.id = p_user and p.status = 'approved' and i.revoked_at is null and u.email_confirmed_at is not null
      and app_private.eligible(p.eligibility) and cardinality(public.profile_missing(p)) = 0
      and app_private.agreements_current(p.id));
$$;
create or replace function app_private.can_view_member_photos(p_owner text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id::text = p_owner
    and app_private.is_approved(p.id) and app_private.is_approved((select auth.uid()))
    and not app_private.is_blocked_between((select auth.uid()), p.id));
$$;

-- Direct table reads must enforce the same membership gate as the convenience RPC.
drop policy "matches: members read" on public.matches;
create policy "matches: members read" on public.matches for select to authenticated
  using (app_private.can_use_match(id));

-- Keep the existing card contract, ranking and filters; require the stronger gate on both ends.
do $$
declare definition text;
begin
  select pg_get_functiondef('app_private.member_cards(uuid[],integer)'::regprocedure) into definition;
  definition := replace(definition, 'p.status = ''approved''', 'app_private.is_approved(p.id)');
  definition := replace(definition, 'c.status = ''approved''', 'app_private.is_approved(c.id)');
  execute definition;
end;
$$;

alter table public.admin_reviews add column reviewer_id uuid references auth.users(id) on delete set null;
create or replace function public.apply_admin_review() returns trigger
language plpgsql security definer set search_path = '' as $$
declare current_status public.profile_status;
begin
  if new.reviewer_id is null or not exists (select 1 from app_private.founder_admins
     where user_id = new.reviewer_id and revoked_at is null) then raise exception 'A named founder must make this decision'; end if;
  select status into current_status from public.profiles where id = new.profile_id for update;
  if current_status is null then raise exception 'Profile not found'; end if;
  if new.decision in ('approved','changes_requested') and current_status <> 'submitted' then raise exception 'only submitted profiles can be reviewed'; end if;
  update public.profiles set status = new.decision, reviewed_at = now(), review_note = new.note where id = new.profile_id;
  return new;
end;
$$;

create function app_private.founder_action(p_action text, p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := app_private.require_founder(); email_address text; result jsonb; target uuid; decision text; note text;
begin
  if p_action = 'invitations' then
    select coalesce(jsonb_agg(jsonb_build_object('email', email, 'created_at', created_at,
      'revoked_at', revoked_at, 'bound_user_id', bound_user_id) order by created_at desc), '[]') into result from app_private.beta_invites;
    return jsonb_build_object('invitations', result);
  elsif p_action in ('invite','revoke_invite') then
    email_address := lower(btrim(p_payload->>'email'));
    if email_address is null or email_address !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or char_length(email_address) > 254 then raise exception 'Enter a valid email'; end if;
    if p_action = 'invite' then
      insert into app_private.beta_invites(email, invited_by) values(email_address, actor)
        on conflict (email) do update set revoked_at = null, invited_by = actor;
    else
      update app_private.beta_invites set revoked_at = now() where email = email_address;
    end if;
    -- Email stays in the restricted invitation table, never duplicated in the audit log.
    insert into app_private.founder_audit(actor_id,action) values(actor,p_action);
    return '{"ok":true}';
  elsif p_action = 'decide' then
    target := (p_payload->>'profile_id')::uuid;
    decision := p_payload->>'decision'; note := nullif(left(btrim(p_payload->>'note'),1000),'');
    if decision is null or decision not in ('approved','changes_requested','removed') then raise exception 'Invalid decision'; end if;
    if decision = 'changes_requested' and note is null then raise exception 'Say what needs to change'; end if;
    insert into public.admin_reviews(profile_id, decision, note, reviewer, reviewer_id)
      values(target,decision::public.profile_status,note,actor::text,actor);
  elsif p_action = 'resolve_report' then
    target := (p_payload->>'report_id')::uuid;
    if coalesce(p_payload->>'status','') not in ('reviewed','actioned') then raise exception 'Invalid report status'; end if;
    update public.reports set status = (p_payload->>'status')::public.report_status,
      resolved_at = now(), resolution_note = left(btrim(p_payload->>'note'),1000) where id = target;
    if not found then raise exception 'Report not found'; end if;
  elsif p_action in ('authorize_photo_removal','finish_photo_removal') then
    target := (p_payload->>'photo_id')::uuid;
    select jsonb_build_object('storage_path', storage_path) into result from public.profile_photos where id = target;
    if result is null then raise exception 'Photo not found'; end if;
    if p_action = 'finish_photo_removal' then delete from public.profile_photos where id = target; end if;
  elsif p_action in ('queue','reports','member_photos') then
    -- Edge data reads are logged after the same live JWT/session/MFA check.
    if p_action = 'member_photos' then target := (p_payload->>'profile_id')::uuid; end if;
  else raise exception 'Unknown founder action';
  end if;
  insert into app_private.founder_audit(actor_id,action,target_id) values(actor,p_action,target::text);
  return coalesce(result,'{"ok":true}');
end;
$$;
create function public.founder_action(p_action text, p_payload jsonb default '{}') returns jsonb
language sql security invoker set search_path = '' as $$ select app_private.founder_action(p_action,p_payload); $$;

revoke execute on function public.profiles_security_guard(), public.profiles_capacity_delete(), public.apply_admin_review()
  from public, anon, authenticated;
revoke execute on function app_private.require_founder() from public, anon, authenticated;
revoke execute on function app_private.eligible(jsonb), app_private.agreements_current(uuid) from public, anon;
grant execute on function app_private.eligible(jsonb) to authenticated;
-- agreements_current is only called under definer execution, never granted to browsers.
revoke execute on function app_private.agreements_current(uuid) from authenticated;
revoke execute on function app_private.founder_access(), app_private.agreement_status(),
  app_private.accept_agreements(text,jsonb,boolean,boolean,boolean), app_private.founder_action(text,jsonb),
  public.founder_access(), public.agreement_status(), public.accept_agreements(text,jsonb,boolean,boolean,boolean), public.founder_action(text,jsonb)
  from public, anon;
grant execute on function app_private.founder_access(), app_private.agreement_status(),
  app_private.accept_agreements(text,jsonb,boolean,boolean,boolean), app_private.founder_action(text,jsonb),
  public.founder_access(), public.agreement_status(), public.accept_agreements(text,jsonb,boolean,boolean,boolean), public.founder_action(text,jsonb)
  to authenticated;

commit;
