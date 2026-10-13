-- FREE MIDNIGHT / No Seeds public beta: save first name and date of birth at account creation.
-- The app passes them as sign-up metadata (supabase.auth.signInWithOtp options.data), so the
-- draft profile has them immediately, even before the person opens the emailed link.
-- Invalid or missing values are simply skipped; account creation never fails because of them.
-- Runs after 202610120001_public_beta_profiles.sql. Paste into the SQL editor once.

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  name text := nullif(left(btrim(coalesce(meta ->> 'first_name', '')), 40), '');
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
