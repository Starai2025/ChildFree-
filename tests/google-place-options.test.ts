import assert from 'node:assert/strict';
import {test} from 'node:test';
import {freshPlaceOptions, storedGoogleOption} from '../supabase/functions/date-planner/google-place-options.ts';

test('Google suggestions store only their ID and our own explanation', () => {
  assert.deepEqual(storedGoogleOption('plan', {id: 'place/123', reason: 'You both love art',
    label: 'Provider name', detail: 'Provider address', maps_url: 'https://example.com', rating: 5} as any),
  {plan_id: 'plan', kind: 'place', place_id: 'place/123', label: 'Suggested place', reason: 'You both love art'});
});

const suggested = {id: 'option', kind: 'place', created_by: null, place_id: 'place/123', label: 'Stale name', detail: 'Stale address', rating: 5, maps_url: 'https://stale.invalid'};
test('every display fetches fresh Google details without mutating stored rows or custom options', async () => {
  let calls = 0;
  const custom = {...suggested, id: 'custom', created_by: 'member', label: 'My own place'};
  const time = {...suggested, id: 'time', kind: 'time'};
  const fetcher = (async (url: string, init: RequestInit) => {
    assert.equal(url, 'https://places.googleapis.com/v1/places/place%2F123');
    assert.equal((init.headers as Record<string, string>)['X-Goog-Api-Key'], 'test-key');
    assert.ok((init.headers as Record<string, string>)['X-Goog-FieldMask'].includes('attributions'));
    calls++;
    return Response.json({id: 'place/123', displayName: {text: `Fresh ${calls}`}, formattedAddress: 'Fresh address',
      rating: 4.6, businessStatus: 'OPERATIONAL', googleMapsUri: 'https://maps.google.com/test', attributions: [{provider: 'example'}]});
  }) as typeof fetch;
  const first = await freshPlaceOptions([suggested, custom, time], 'test-key', fetcher);
  const second = await freshPlaceOptions([suggested], 'test-key', fetcher);
  assert.equal(first[0].label, 'Fresh 1'); assert.equal(second[0].label, 'Fresh 2');
  assert.equal(first[0].detail, 'Fresh address'); assert.equal(first[0].rating, 4.6);
  assert.equal(first[1], custom); assert.equal(first[2], time);
  assert.equal(suggested.label, 'Stale name'); assert.equal(calls, 2);
});

test('provider errors, missing IDs, closures and bad responses never fall back to stored provider content', async () => {
  for (const fetcher of [async () => {throw Error('offline')}, async () => new Response('', {status: 429}),
    async () => Response.json({id: 'wrong', displayName: {text: 'Wrong place'}}),
    async () => Response.json({id: 'place/123', displayName: {text: 'Closed place'}, businessStatus: 'CLOSED_PERMANENTLY'})]) {
    const [result] = await freshPlaceOptions([suggested], 'test-key', fetcher as typeof fetch);
    assert.equal(result.label, 'Suggested place unavailable');
    assert.equal(result.detail, null); assert.equal(result.rating, null); assert.equal(result.maps_url, null);
  }
  let calls = 0;
  const noFetch = (async () => { calls++; throw Error('must not fetch') }) as typeof fetch;
  await freshPlaceOptions([{...suggested, place_id: null}], 'test-key', noFetch);
  await freshPlaceOptions([suggested], '', noFetch);
  assert.equal(calls, 0);
});
