import test from 'node:test';
import assert from 'node:assert/strict';
import { ageOn, dobSchema, profileSchema, requestSchema, onboardingRoute, type Snapshot } from '../packages/domain/src/index.ts';
import { readPublicConfig } from '../packages/domain/src/config.ts';

test('calendar dates and adult birthday boundaries', () => {
  assert.equal(ageOn('2008-10-06', '2026-10-06'),18);
  assert.equal(ageOn('2008-10-07', '2026-10-06'),17);
  assert.equal(ageOn('2008-02-29', '2026-02-28'),17);
  assert.equal(ageOn('2008-02-29', '2026-03-01'),18);
  for (const date of ['2025-02-29','2000-02-30','1990-13-01','1/1/2000','']) assert.equal(dobSchema.safeParse(date).success,false);
});
test('a client cannot add actor, approval or sensitive draft fields', () => {
  for (const extra of ['user_id','lifecycle','verified_adult','dob','answers']) {
    assert.equal(requestSchema.safeParse({action:'draft_save', expected_revision:0, fields:{[extra]:'spoof'}}).success,false);
  }
  assert.equal(requestSchema.safeParse({action:'bootstrap',user_id:'someone-else'}).success,false);
});
test('structured answers cannot be replaced with a bio or duplicate prompt', () => {
  const profile = {display_name:'Jordan', gender:'nonbinary',gender_description:'',bio:'',prompts:[{id:'joy',version:1,answer:'Cooking and spending time with loved ones.'},{id:'building',version:1,answer:'A thoughtful life filled with love and travel.'}],relationship_goal:'serious_relationship',marriage_intent:'prefer_not_to_say'};
  assert.equal(profileSchema.safeParse(profile).success,true);
  for (const prompts of [[],[profile.prompts[0],profile.prompts[0]], [{...profile.prompts[0],answer:'short'},profile.prompts[1]], [{...profile.prompts[0],answer:' '.repeat(25)},profile.prompts[1]]]) assert.equal(profileSchema.safeParse({...profile,prompts}).success,false);
  assert.equal(profileSchema.safeParse({...profile,gender:'self_described'}).success,false);
  assert.equal(profileSchema.safeParse({...profile,gender:undefined}).success,false);
});
test('configuration fails closed and only reports field names', () => {
  const good = {stage:'development',supabaseUrl:'http://127.0.0.1:54321',publishableKey:'sb_publishable_abcdefghijklmnop',termsUrl:'https://example.org/terms',privacyUrl:'https://example.org/privacy',supportUrl:'https://example.org/support'};
  assert.equal(readPublicConfig(good).ok,true);
  for (const key of ['sb_secret_abcdefghijklmnop','eyJhbGciOiJIUzI1NiJ9.private','']) {
    const result = readPublicConfig({...good,publishableKey:key});
    assert.equal(result.ok,false); assert.equal(JSON.stringify(result).includes(key),key==='');
  }
  assert.equal(readPublicConfig({...good,stage:'production'}).ok,false);
  assert.equal(readPublicConfig({...good,supabaseUrl:'https://user:pass@example.org'}).ok,false);
  assert.equal(readPublicConfig({...good,privacyUrl:'http://example.org/privacy'}).ok,false);
  for (const field of ['supabaseUrl','termsUrl','privacyUrl','supportUrl']) {
    for (const value of ['', 'not a URL']) assert.equal(readPublicConfig({...good,[field]:value}).ok,false);
  }
  assert.equal(readPublicConfig({...good,supabaseUrl:'ftp://localhost'}).ok,false);
});
test('routing comes from server eligibility, pledge and account status', () => {
  const base: Snapshot = {lifecycle:'onboarding',eligible:true,policy_version:1,dob:'1990-01-01',answers:null,pledge:{version:1,text:'Pledge',accepted:true},prompts:[],draft:{revision:1,step:'photos',fields:{}},profile_revision:1};
  assert.equal(onboardingRoute(base),'photos');
  assert.equal(onboardingRoute({...base,eligible:false}),'eligibility');
  assert.equal(onboardingRoute({...base,pledge:{...base.pledge,accepted:false}}),'eligibility');
  assert.equal(onboardingRoute({...base,lifecycle:'banned',eligible:false}),'restricted');
  assert.equal(onboardingRoute({...base,lifecycle:'pending_review'}),'status');
});
