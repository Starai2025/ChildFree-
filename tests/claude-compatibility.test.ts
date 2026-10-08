import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

type Answers = { version: 1; answers: Record<string, string> };
type Question = { id: string; group: string; q: string; options: string[][]; shared?: string };
type Domain = { questions: Question[]; clean: (value: unknown) => Answers; shared: (a: unknown, b: unknown) => string[] };
const source = readFileSync('prototype/web-mvp1/index.html', 'utf8');
const domainSource = source.split('// ---------- Compatibility domain (versioned, optional self-reported answers) ----------')[1]
  .split('// ---------- End compatibility domain ----------')[0];
const domain = runInNewContext(`${domainSource}\n({questions:COMPATIBILITY_QUESTIONS,clean:cleanCompatibility,shared:sharedCompatibility})`) as Domain;
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const answers = (values: Record<string, string>): Answers => ({ version: 1, answers: values });

test('compatibility has ten distinct questions and rejects forged, malformed and future-version answers', () => {
  assert.equal(domain.questions.length, 10);
  assert.equal(new Set(domain.questions.map(q => q.id)).size, 10);
  for (const value of [null, {}, {version:2,answers:{faithPractice:'daily'}}, {version:1,answers:[]}]) {
    assert.deepEqual(plain(domain.clean(value)), answers({}));
  }
  const filtered = domain.clean(answers({faithPractice:'daily',dateBudget:'casual',faithPartner:'<script>bad()</script>',unknown:'approved',faithImportance:'prefer'}));
  assert.deepEqual(plain(filtered), answers({faithPractice:'daily',dateBudget:'casual',faithImportance:'prefer'}));
});

test('missing, skipped and unsupported answers never become evidence of alignment', () => {
  assert.equal(domain.shared(undefined, undefined).length, 0);
  assert.equal(domain.shared(answers({faithPractice:'daily'}), answers({})).length, 0);
  assert.equal(domain.shared(answers({faithPractice:''}), answers({faithPractice:''})).length, 0);
  assert.equal(domain.shared(answers({faithImportance:'essential'}), answers({faithImportance:'essential'})).length, 0);
});

test('shared-life reasons are symmetric and limited to matching known answers', () => {
  const a = answers({faithPractice:'personal',faithPartner:'respect',dateBudget:'casual',weekend:'home',faithImportance:'essential'});
  const b = answers({faithPractice:'personal',faithPartner:'shared',dateBudget:'casual',weekend:'culture',faithImportance:'flexible'});
  assert.deepEqual(plain(domain.shared(a,b)), ['Same role for faith or spirituality','Same first-date budget preference']);
  assert.deepEqual(plain(domain.shared(a,b)), plain(domain.shared(b,a)));
  assert.equal(domain.shared(a,{version:2,answers:a.answers}).length, 0);
});

test('valid optional answers survive serialization without filling unanswered fields', () => {
  const partial = answers({spendingPriority:'saving',socialPace:'quiet',dateAvailability:'coordinate'});
  assert.deepEqual(plain(domain.clean(JSON.parse(JSON.stringify(partial)))), partial);
  const full = answers(Object.fromEntries(domain.questions.map(q=>[q.id,q.options[0][0]])));
  assert.equal(Object.keys(domain.clean(full).answers).length, 10);
  assert.equal(domain.shared(full,full).length, 7);
});
