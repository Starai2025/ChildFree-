-- Run only after the founder confirms this specific access grant.
-- This grants review/invitation access to Starr's EXISTING confirmed member Auth account.
-- It does not create an account, accept agreements, enroll MFA or invite/approve any member.
do $$
declare founder_id uuid; matches integer;
begin
  select count(*), (array_agg(id))[1] into matches, founder_id from auth.users
    where lower(btrim(email)) = 'thegiftedbystarr@gmail.com' and email_confirmed_at is not null;
  if matches <> 1 then raise exception 'Expected exactly one confirmed founder Auth account'; end if;
  insert into app_private.founder_admins(user_id) values(founder_id)
    on conflict(user_id) do update set revoked_at = null;
end;
$$;
