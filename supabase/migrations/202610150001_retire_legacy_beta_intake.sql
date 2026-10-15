do $$
declare
  column_names text;
begin
  if to_regclass('public.beta_applications') is null then
    return;
  end if;

  drop policy if exists beta_applications_insert_anyone on public.beta_applications;
  revoke insert on public.beta_applications from public, anon, authenticated;

  select string_agg(quote_ident(attname), ', ' order by attnum)
    into column_names
    from pg_attribute
   where attrelid = 'public.beta_applications'::regclass
     and attnum > 0 and not attisdropped;
  if column_names is not null then
    execute format('revoke insert (%s) on public.beta_applications from public, anon, authenticated', column_names);
  end if;
end;
$$;
