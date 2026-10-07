-- Milestone A: private, owner-scoped onboarding only. No approval/discovery grants.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  lifecycle text not null default 'onboarding' check (lifecycle in
    ('onboarding','ineligible','pending_review','changes_requested','active','paused','suspended','banned','deletion_pending','deleted')),
  current_eligibility_id uuid,
  created_at timestamptz not null default now()
);
create table private.private_details (
  user_id uuid primary key references private.accounts(user_id) on delete cascade,
  dob date not null
);
-- Location/PostGIS is deliberately added by B03, not represented as fake coordinates.
create table private.eligibility_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references private.accounts(user_id) on delete cascade,
  policy_version integer not null,
  answers jsonb not null,
  passed boolean not null,
  attested_at timestamptz not null default now(),
  unique (user_id,id)
);
alter table private.accounts add constraint accounts_current_eligibility_fk
  foreign key (user_id,current_eligibility_id) references private.eligibility_versions(user_id,id);
create table private.pledge_versions (
  version integer primary key,
  text text not null,
  text_hash text not null,
  effective_at timestamptz not null default now(),
  current boolean not null default false
);
create unique index one_current_pledge on private.pledge_versions ((current)) where current;
create table private.pledge_acceptances (
  user_id uuid not null references private.accounts(user_id) on delete cascade,
  pledge_version integer not null references private.pledge_versions(version),
  accepted_at timestamptz not null default now(),
  primary key(user_id,pledge_version)
);
create table private.prompt_catalog (
  id text not null, version integer not null, text text not null, enabled boolean not null default true,
  primary key(id,version)
);
create table private.onboarding_drafts (
  user_id uuid primary key references private.accounts(user_id) on delete cascade,
  current_step text not null default 'eligibility' check(current_step in ('eligibility','profile','photos')),
  fields jsonb not null default '{}'::jsonb,
  revision integer not null default 0 check(revision>=0),
  updated_at timestamptz not null default now()
);
create table private.profile_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references private.accounts(user_id) on delete cascade,
  revision_number integer not null check(revision_number>0),
  fields jsonb not null,
  review_status text not null default 'draft' check(review_status in ('draft','pending','approved','changes_requested')),
  created_at timestamptz not null default now(),
  unique(user_id,revision_number)
);

-- Even private tables use RLS as defense in depth; no member table privileges/policies.
alter table private.accounts enable row level security;
alter table private.private_details enable row level security;
alter table private.eligibility_versions enable row level security;
alter table private.pledge_versions enable row level security;
alter table private.pledge_acceptances enable row level security;
alter table private.prompt_catalog enable row level security;
alter table private.onboarding_drafts enable row level security;
alter table private.profile_revisions enable row level security;
revoke all on all tables in schema private from public, anon, authenticated;
alter default privileges in schema private revoke all on tables from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public;

insert into private.pledge_versions(version,text,text_hash,current)
values(1,
'I will be truthful about my identity, relationship history and decision not to become a parent. I will respect other members'' boundaries and accept a no. I will not pressure anyone to change their childfree choice. I will not harass, threaten, discriminate, impersonate others, solicit money or send sexual content. I will use reporting when something is wrong and understand that violations can lead to removal.',
md5('I will be truthful about my identity, relationship history and decision not to become a parent. I will respect other members'' boundaries and accept a no. I will not pressure anyone to change their childfree choice. I will not harass, threaten, discriminate, impersonate others, solicit money or send sexual content. I will use reporting when something is wrong and understand that violations can lead to removal.'),true);
-- Hash detects accidental content changes; it is not a security signature.
insert into private.prompt_catalog(id,version,text) values
('life_together',1,'A life together without parenthood would include…'),
('tradition',1,'The tradition I''d bring into our relationship is…'),
('cared_for',1,'I feel most cared for when…'),
('ordinary_sunday',1,'An ordinary Sunday with me looks like…'),
('building',1,'The life I want to build with someone is…'),
('culture',1,'A part of my culture I''d love to share is…'),
('partnership',1,'A strong partnership means…'),
('joy',1,'Something that always brings me joy is…');

create function private.actor() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
    raise exception 'UNAUTHENTICATED' using errcode='P0001';
  end if;
  return actor;
end $$;
create function private.ensure_account() returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.actor();
begin
  insert into private.accounts(user_id) values(actor) on conflict do nothing;
  insert into private.onboarding_drafts(user_id) values(actor) on conflict do nothing;
  return actor;
end $$;
create function private.editable_actor() returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.ensure_account(); state text;
begin
  select lifecycle into state from private.accounts where user_id=actor for update;
  if state in ('suspended','banned','deletion_pending','deleted','pending_review') then
    raise exception 'RESTRICTED' using errcode='P0001';
  end if;
  return actor;
end $$;
create function private.eligible(actor uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select e.passed and e.policy_version=1
    and d.dob <= (current_date - interval '18 years')::date
    from private.accounts a join private.eligibility_versions e on e.id=a.current_eligibility_id
    join private.private_details d on d.user_id=a.user_id where a.user_id=actor),false);
$$;
create function private.pledged(actor uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from private.pledge_acceptances a
    join private.pledge_versions p on p.version=a.pledge_version where a.user_id=actor and p.current);
$$;
create function private.require_eligible(actor uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.eligible(actor) then raise exception 'INELIGIBLE' using errcode='P0001'; end if;
  if not private.pledged(actor) then raise exception 'STALE_PLEDGE' using errcode='P0001'; end if;
end $$;
create function public.api_onboarding() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.ensure_account(); result jsonb;
begin
  select jsonb_build_object(
    'lifecycle',a.lifecycle,'eligible',private.eligible(actor),'policy_version',1,
    'dob',d.dob,'answers',e.answers,
    'pledge',(select jsonb_build_object('version',p.version,'text',p.text,'accepted',private.pledged(actor)) from private.pledge_versions p where p.current),
    'prompts',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'version',version,'text',text) order by id),'[]'::jsonb) from private.prompt_catalog where enabled),
    'draft',jsonb_build_object('revision',o.revision,'step',o.current_step,'fields',o.fields),
    'profile_revision',coalesce((select max(revision_number) from private.profile_revisions where user_id=actor),0)
  ) into result from private.accounts a join private.onboarding_drafts o on o.user_id=a.user_id
    left join private.private_details d on d.user_id=a.user_id
    left join private.eligibility_versions e on e.id=a.current_eligibility_id where a.user_id=actor;
  return result;
end $$;
create function public.api_eligibility(p_dob text,p_answers jsonb,p_policy_version integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.editable_actor(); old_dob date; dob date; v_passed boolean; eid uuid;
begin
  if p_policy_version is distinct from 1 then raise exception 'STALE_POLICY' using errcode='P0001'; end if;
  if p_dob is null or p_dob !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'INVALID_INPUT' using errcode='P0001'; end if;
  dob := p_dob::date;
  if jsonb_typeof(p_answers) is distinct from 'object' then raise exception 'INVALID_INPUT' using errcode='P0001'; end if;
  if (select array_agg(key order by key) from jsonb_object_keys(p_answers) key) is distinct from
    array['identifies_black','never_married','never_parent','no_children','no_parental_role','seeks_black']
    or exists(select 1 from jsonb_each(p_answers) where jsonb_typeof(value)<>'boolean') then
    raise exception 'INVALID_INPUT' using errcode='P0001';
  end if;
  select d.dob into old_dob from private.private_details d where user_id=actor;
  if old_dob is not null and old_dob<>dob then raise exception 'CONFLICT' using errcode='P0001'; end if;
  insert into private.private_details(user_id,dob) values(actor,dob) on conflict do nothing;
  v_passed := dob <= (current_date - interval '18 years')::date and not exists(select 1 from jsonb_each(p_answers) where value='false'::jsonb);
  -- Retrying unchanged attestations is idempotent; changed eligibility creates an audit version.
  if exists(select 1 from private.accounts a join private.eligibility_versions e on e.id=a.current_eligibility_id
    where a.user_id=actor and e.policy_version=1 and e.answers=p_answers and e.passed=v_passed) then
    return public.api_onboarding();
  end if;
  insert into private.eligibility_versions(user_id,policy_version,answers,passed)
    values(actor,1,p_answers,v_passed) returning id into eid;
  update private.accounts set current_eligibility_id=eid,
    lifecycle=case when not v_passed then 'ineligible' when lifecycle='ineligible' then 'onboarding' else lifecycle end where user_id=actor;
  return public.api_onboarding();
end $$;
create function public.api_accept_pledge(p_version integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.editable_actor();
begin
  if not exists(select 1 from private.pledge_versions where version=p_version and current) then
    raise exception 'STALE_PLEDGE' using errcode='P0001';
  end if;
  insert into private.pledge_acceptances(user_id,pledge_version) values(actor,p_version) on conflict do nothing;
  return public.api_onboarding();
end $$;

-- Authoritative field allowlist is enforced in SQL even when Edge validation is bypassed.
create function private.validate_fields(fields jsonb,complete boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare entry jsonb;
begin
  if fields is null or jsonb_typeof(fields)<>'object' or exists(select 1 from jsonb_object_keys(fields) key
    where key not in ('display_name','gender','gender_description','bio','prompts','relationship_goal','marriage_intent')) then
    raise exception 'INVALID_INPUT' using errcode='P0001';
  end if;
  if complete and not fields ?& array['display_name','gender','gender_description','bio','prompts','relationship_goal','marriage_intent'] then
    raise exception 'INVALID_INPUT' using errcode='P0001';
  end if;
  if exists(select 1 from jsonb_each(fields) where key<>'prompts' and jsonb_typeof(value)<>'string') then
    raise exception 'INVALID_INPUT' using errcode='P0001';
  end if;
  if length(fields->>'display_name')>60 or (complete and length(btrim(fields->>'display_name'))<2)
    or length(fields->>'bio')>500 or length(fields->>'gender_description')>60
    or (fields ? 'gender' and fields->>'gender' not in ('woman','man','nonbinary','self_described'))
    or (complete and fields->>'gender'='self_described' and length(btrim(fields->>'gender_description'))<2)
    or (fields ? 'relationship_goal' and fields->>'relationship_goal'<>'serious_relationship')
    or (fields ? 'marriage_intent' and fields->>'marriage_intent' not in ('wants_marriage','open','not_seeking_marriage','prefer_not_to_say')) then
    raise exception 'INVALID_INPUT' using errcode='P0001';
  end if;
  if fields ? 'prompts' then
    if jsonb_typeof(fields->'prompts')<>'array' then raise exception 'INVALID_INPUT' using errcode='P0001'; end if;
    if jsonb_array_length(fields->'prompts')>2 or (complete and jsonb_array_length(fields->'prompts')<>2) then
      raise exception 'INVALID_INPUT' using errcode='P0001';
    end if;
    for entry in select value from jsonb_array_elements(fields->'prompts') loop
      if jsonb_typeof(entry)<>'object' then raise exception 'INVALID_INPUT' using errcode='P0001'; end if;
      if (select array_agg(key order by key) from jsonb_object_keys(entry) key) is distinct from array['answer','id','version']
        or jsonb_typeof(entry->'answer') is distinct from 'string'
        or jsonb_typeof(entry->'id') is distinct from 'string'
        or jsonb_typeof(entry->'version') is distinct from 'number'
        or (entry->>'version') !~ '^[1-9][0-9]*$'
        or length(entry->>'answer')>200 or (complete and length(btrim(entry->>'answer'))<20)
        or not exists(select 1 from private.prompt_catalog c where c.id=entry->>'id' and c.version=(entry->>'version')::integer and c.enabled) then
        raise exception 'INVALID_INPUT' using errcode='P0001';
      end if;
    end loop;
    if complete and fields->'prompts'->0->>'id'=fields->'prompts'->1->>'id' then
      raise exception 'INVALID_INPUT' using errcode='P0001';
    end if;
  end if;
end $$;
create function public.api_save_draft(p_fields jsonb,p_expected_revision integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.editable_actor();
begin
  perform private.require_eligible(actor);
  perform private.validate_fields(p_fields,false);
  update private.onboarding_drafts set fields=p_fields,revision=revision+1,updated_at=now(),current_step='profile'
    where user_id=actor and revision=p_expected_revision;
  if not found then raise exception 'CONFLICT' using errcode='P0001'; end if;
  -- Editing an approved profile hides it immediately; approval is never copied to drafts.
  update private.accounts set lifecycle='onboarding' where user_id=actor and lifecycle in ('active','paused');
  return public.api_onboarding();
end $$;
create function public.api_save_profile(p_fields jsonb,p_expected_revision integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.editable_actor(); v_revision integer;
begin
  perform private.require_eligible(actor);
  perform private.validate_fields(p_fields,true);
  update private.onboarding_drafts set fields=p_fields,revision=revision+1,updated_at=now(),current_step='photos'
    where user_id=actor and revision=p_expected_revision;
  if not found then raise exception 'CONFLICT' using errcode='P0001'; end if;
  select coalesce(max(revision_number),0)+1 into v_revision from private.profile_revisions where user_id=actor;
  insert into private.profile_revisions(user_id,revision_number,fields) values(actor,v_revision,p_fields);
  update private.accounts set lifecycle='onboarding' where user_id=actor;
  return public.api_onboarding();
end $$;
create function public.api_submit_profile(p_revision integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.editable_actor();
begin
  perform private.require_eligible(actor);
  if not exists(select 1 from private.profile_revisions where user_id=actor and revision_number=p_revision) then
    raise exception 'CONFLICT' using errcode='P0001';
  end if;
  -- Fail closed until B/I tickets implement real approved photos, preferences and verified adult identity.
  raise exception 'PREREQUISITES_MISSING' using errcode='P0001';
end $$;

create function private.immutable_catalog_text() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.version is distinct from old.version or new.text is distinct from old.text then
    raise exception 'Catalog content changes require a new version';
  end if;
  if tg_table_name='prompt_catalog' then
    if new.id is distinct from old.id then raise exception 'Prompt identifiers are immutable'; end if;
  else
    if new.text_hash is distinct from old.text_hash then raise exception 'Pledge content hashes are immutable'; end if;
  end if;
  return new;
end $$;
create trigger pledge_content_immutable before update on private.pledge_versions
  for each row execute function private.immutable_catalog_text();
create trigger prompt_content_immutable before update on private.prompt_catalog
  for each row execute function private.immutable_catalog_text();

revoke execute on all functions in schema private from public,anon,authenticated;
revoke execute on function public.api_onboarding() from public,anon;
revoke execute on function public.api_eligibility(text,jsonb,integer) from public,anon;
revoke execute on function public.api_accept_pledge(integer) from public,anon;
revoke execute on function public.api_save_draft(jsonb,integer) from public,anon;
revoke execute on function public.api_save_profile(jsonb,integer) from public,anon;
revoke execute on function public.api_submit_profile(integer) from public,anon;
grant execute on function public.api_onboarding() to authenticated;
grant execute on function public.api_eligibility(text,jsonb,integer) to authenticated;
grant execute on function public.api_accept_pledge(integer) to authenticated;
grant execute on function public.api_save_draft(jsonb,integer) to authenticated;
grant execute on function public.api_save_profile(jsonb,integer) to authenticated;
grant execute on function public.api_submit_profile(integer) to authenticated;
