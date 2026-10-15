-- Keep the existing RPC contracts, with invoker entry points in the exposed schema.
-- The private implementations retain their existing auth.uid()/membership guards,
-- owner, volatility and empty search_path. app_private is not an API schema.
do $$
declare
  f record;
  call_arguments text;
begin
  for f in
    select p.oid, p.proname, p.pronargs, p.provolatile,
           pg_get_function_identity_arguments(p.oid) as identity_arguments,
           pg_get_function_arguments(p.oid) as declaration_arguments,
           pg_get_function_result(p.oid) as result_type
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
       and p.oid in (
         'public.close_match(uuid,text)'::regprocedure,
         'public.member_cards(uuid[],integer)'::regprocedure,
         'public.my_matches()'::regprocedure,
         'public.likes_received()'::regprocedure,
         'public.date_planner_ready(uuid)'::regprocedure
       )
  loop
    select coalesce(string_agg('$' || i, ', ' order by i), '') into call_arguments
      from generate_series(1, f.pronargs) i;
    execute format('alter function public.%I(%s) set schema app_private', f.proname, f.identity_arguments);
    execute format('create function public.%I(%s) returns %s language sql %s security invoker set search_path = %L as %L',
      f.proname, f.declaration_arguments, f.result_type,
      case f.provolatile when 's' then 'stable' when 'i' then 'immutable' else 'volatile' end,
      '', format('select * from app_private.%I(%s)', f.proname, call_arguments));
    execute format('revoke execute on function public.%I(%s) from public, anon', f.proname, f.identity_arguments);
    execute format('grant execute on function public.%I(%s) to authenticated', f.proname, f.identity_arguments);
    execute format('revoke execute on function app_private.%I(%s) from public, anon', f.proname, f.identity_arguments);
    execute format('grant execute on function app_private.%I(%s) to authenticated', f.proname, f.identity_arguments);
  end loop;
end;
$$;
