-- FREE MIDNIGHT / No Seeds public beta: Google sign-in fills the first name too.
-- Email sign-up sends first_name; Google sends given_name / full_name / name instead.
-- Google does not share a birthday, so members still enter it on the account step.
-- Runs after 202610130001_signup_profile_basics.sql. Paste into the SQL editor once.

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  name text := nullif(left(btrim(coalesce(
    nullif(btrim(meta ->> 'first_name'), ''),
    nullif(btrim(meta ->> 'given_name'), ''),
    split_part(btrim(coalesce(nullif(btrim(meta ->> 'full_name'), ''), meta ->> 'name', '')), ' ', 1)
  )), 40), '');
  dob date;
begin
  begin
    if (meta ->> 'birth_date') ~ '^\d{4}-\d{2}-\d{2}$' then
      dob := (meta ->> 'birth_date')::date;
      if dob > current_date or dob < date '1900-01-01' then dob := null; end if;
    end if;
  exception when others then
    dob := null;
  end;
  insert into public.profiles (id, first_name, birth_date)
  values (new.id, name, dob)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
