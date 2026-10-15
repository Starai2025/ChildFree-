import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import vm from 'node:vm';
import {transform} from 'esbuild';
import {freshPlaceOptions, storedGoogleOption} from '../supabase/functions/date-planner/google-place-options.ts';

const matchId = '10000000-0000-4000-8000-000000000001';
async function harness(user: {id: string} | null, plan: unknown, error: unknown = null) {
  const source = await readFile('supabase/functions/date-planner/index.ts', 'utf8');
  const code = (await transform(source.replace(/^import .*;\r?\n/gm, ''), {loader: 'ts', format: 'cjs'})).code;
  let handler: (req: Request) => Promise<Response>;
  let providerCalls = 0;
  const member = {
    auth: {getUser: async () => ({data: {user}})},
    from(table: string) {
      assert.equal(table, 'date_plans');
      return {select(columns: string) {
        assert.equal(columns, '*, date_plan_options(*, date_plan_picks(member_id))');
        return {eq(column: string, value: string) {
          assert.equal(column, 'match_id'); assert.equal(value, matchId);
          return {neq() {return {maybeSingle: async () => ({data: plan, error})}}};
        }};
      }};
    },
  };
  const provider = (async () => {providerCalls++; return Response.json({id: 'place', displayName: {text: 'Fresh name'}})}) as typeof fetch;
  vm.runInNewContext(code, {
    createClient(_url: string, key: string, options: any) {
      if (key === 'server-key') return {from() {assert.fail('view must never use privileged database reads')}};
      assert.equal(options.global.headers.Authorization, user ? 'Bearer member-token' : '');
      return member;
    },
    freshPlaceOptions: (options: any, key: string) => freshPlaceOptions(options, key, provider), storedGoogleOption,
    Deno: {env: {get: (key: string) => ({SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'public-key',
      SUPABASE_SERVICE_ROLE_KEY: 'server-key', GOOGLE_MAPS_API_KEY: 'google-key', ALLOWED_ORIGINS: 'https://noseedsdatingsite.com'}[key])},
      serve(fn: typeof handler) {handler = fn}},
    Request, Response, TextEncoder, URL, AbortSignal, fetch: provider, console,
  });
  const response = await handler!(new Request('https://example.supabase.co/functions/v1/date-planner', {
    method: 'POST', headers: {'Content-Type': 'application/json', Origin: 'https://noseedsdatingsite.com',
      ...(user ? {Authorization: 'Bearer member-token'} : {})}, body: JSON.stringify({action: 'view', match_id: matchId}),
  }));
  return {response, providerCalls};
}

test('planner view verifies login before reading or contacting Google', async () => {
  const {response, providerCalls} = await harness(null, null);
  assert.equal(response.status, 401); assert.equal(providerCalls, 0);
});
test('RLS-hidden, blocked and outsider plans never trigger Google lookups', async () => {
  const {response, providerCalls} = await harness({id: 'outsider'}, null);
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), {plan: null}); assert.equal(providerCalls, 0);
  const failed = await harness({id: 'member'}, null, {message: 'database error'});
  assert.equal(failed.response.status, 500); assert.equal(failed.providerCalls, 0);
});
test('authorized plan view hydrates options without privileged reads and forbids response caching', async () => {
  const plan = {id: 'plan', confirmed_place: 'option', date_plan_options: [
    {id: 'option', kind: 'place', created_by: null, place_id: 'place', label: 'Suggested place', date_plan_picks: [{member_id: 'member'}]},
  ]};
  const {response, providerCalls} = await harness({id: 'member'}, plan);
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  const result = await response.json(); assert.equal(result.plan.date_plan_options[0].label, 'Fresh name');
  assert.equal(result.plan.confirmed_place, 'option'); assert.equal(result.plan.date_plan_options[0].date_plan_picks[0].member_id, 'member');
  assert.equal(providerCalls, 1); assert.equal(plan.date_plan_options[0].label, 'Suggested place');
});
