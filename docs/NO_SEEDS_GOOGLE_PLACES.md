# No Seeds date-planner storage and display

October 15, 2026. [Google's Places policy](https://developers.google.com/maps/documentation/places/web-service/policies) permits indefinite retention of place IDs, while restricting storage of provider content. The planner now stores `place_id` plus app-authored reason/generic labels. Names, addresses, map links, ratings and third-party attributions are fetched through Place Details for each display, returned with `Cache-Control: no-store`, and never written back to the database. An unavailable/closed/deleted place displays an unavailable placeholder; it never falls back to stale provider details.

Member-entered places and time suggestions retain their existing text. Plan/option IDs, votes and confirmed selections remain stable. Migration `202610150004` removes legacy server-suggested provider fields and midpoint names, then adds constraints to prevent them being stored again. Legacy options without place IDs remain unavailable; IDs cannot be reconstructed by guessing. The pre-rollout live metadata audit found **zero server-suggested place rows**.

## Deployment sequence

1. Apply migration 004 after migrations 001–003. Deploy the updated date-planner function and its sibling `google-place-options.ts` module immediately afterward. The old creator cannot store Google fields under the new constraints, so do this as one controlled rollout.
2. Verify the function's authenticated `action: "view"` path before publishing the small frontend `loadPlan` change. Render only deploys static files; it does not deploy SQL or Edge Functions.
3. The frontend invokes `date-planner` with `{action: "view", match_id}`. The function reads using the caller's RLS permissions, then hydrates only those visible options. Existing create requests remain supported.
4. Run SQL tests and helper/handler tests, verify unauthenticated requests are rejected, and test a real approved match when authorized test-member sessions are available. Do not claim an end-to-end member test from synthetic tests alone.

## Claude's display work

No screen structure or styles were changed. `loadPlan` is the only member-screen logic change. The hydrated option shape retains `label`, `detail`, `maps_url`, `rating`, picks and IDs, and adds `attributions` for fresh Google results.

Claude must display the required provider attribution alongside those results and any returned third-party attributions. Current Google guidance calls for **Google Maps** attribution for new implementations, using the official logo where possible; check the linked policy rather than inventing a logo or assuming a generic credit covers every result. Keep user-entered custom options visually distinguishable from Google results. Check the existing Terms/Privacy links also satisfy Google's end-user notice requirements. These UI/legal acceptance checks remain separate from the backend storage change.

## Separate location-cache follow-up

The planner no longer reads or writes the Google ZIP centroid cache. The separate `update-location` function and matching distance logic still use `zip_locations`, and reverse-geocoded city/ZIP values are saved on profiles. Review that data's provenance and retention under the [Geocoding policy](https://developers.google.com/maps/documentation/geocoding/policies) and the applicable [service terms](https://cloud.google.com/maps-platform/terms/maps-service-terms). Use a permitted source or a tested expiry/refresh strategy before claiming app-wide Google retention compliance. Do not silently remove matching-distance data or user-entered locations.

Validation: `node tests/date-planner-sql.mjs`; `node --import tsx --test tests/google-place-options.test.ts tests/date-planner-edge.test.ts`. These test cleanup constraints, option/vote identity, member isolation, matching/blocked access, fresh-per-view hydration, no privileged view reads, no stale fallback, and failures. The Edge test uses mocked provider/auth responses; it does not verify Google billing, live credentials or a real member's plan.
