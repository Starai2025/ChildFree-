alter table public.date_plan_options add column place_id text;

update public.date_plan_options
   set label = 'Suggested place', detail = null, maps_url = null, rating = null
 where kind = 'place' and created_by is null;

update public.date_plans set midpoint_label = null where midpoint_label is not null;

alter table public.date_plan_options
  add constraint date_options_place_id_valid check (
    place_id is null or (kind = 'place' and created_by is null and char_length(place_id) between 1 and 1024 and place_id = btrim(place_id))
  ),
  add constraint date_options_google_content_not_stored check (
    kind <> 'place' or created_by is not null or
    (label = 'Suggested place' and detail is null and maps_url is null and rating is null)
  );

alter table public.date_plans add constraint date_plans_midpoint_not_stored check (midpoint_label is null);

alter policy "date options: add your own while open" on public.date_plan_options
  with check (created_by = (select auth.uid()) and app_private.can_use_plan(plan_id) and app_private.plan_is_open(plan_id)
              and maps_url is null and rating is null and place_id is null);
