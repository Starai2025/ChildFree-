import { z } from 'zod';

export const POLICY_VERSION = 1;
export const eligibilityLabels = {
  identifies_black: 'I identify as Black, including multiracial Black.',
  never_married: 'I have never been legally married.',
  no_children: 'I have no biological or adopted children.',
  no_parental_role: 'I have no current parental or stepparental role.',
  never_parent: 'I never want to become a parent.',
  seeks_black: 'I am seeking Black partners.',
} as const;
export const answersSchema = z.strictObject({
  identifies_black: z.boolean(), never_married: z.boolean(), no_children: z.boolean(),
  no_parental_role: z.boolean(), never_parent: z.boolean(), seeks_black: z.boolean(),
});
export type EligibilityAnswers = z.infer<typeof answersSchema>;
export const emptyAnswers: EligibilityAnswers = {
  identifies_black: false, never_married: false, no_children: false,
  no_parental_role: false, never_parent: false, seeks_black: false,
};

export const dobSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.').refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Enter a real calendar date.');
export function ageOn(dob: string, today: string): number {
  dobSchema.parse(dob); dobSchema.parse(today);
  const [by, bm, bd] = dob.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - by - Number(tm < bm || (tm === bm && td < bd));
}
export const genderSchema = z.enum(['woman', 'man', 'nonbinary', 'self_described']);
export const profileSchema = z.strictObject({
  display_name: z.string().trim().min(2).max(60),
  gender: genderSchema,
  gender_description: z.string().trim().max(60).default(''),
  bio: z.string().trim().max(500),
  prompts: z.array(z.strictObject({ id: z.string().min(1).max(50), version: z.number().int().positive(), answer: z.string().trim().min(20).max(200) })).length(2),
  relationship_goal: z.literal('serious_relationship'),
  marriage_intent: z.enum(['wants_marriage', 'open', 'not_seeking_marriage', 'prefer_not_to_say']),
}).refine(p => p.prompts.length === 2 && p.prompts[0].id !== p.prompts[1].id, 'Choose two different prompts.')
  .refine(p => p.gender !== 'self_described' || p.gender_description.length >= 2, 'Describe your gender.');
export type Profile = z.infer<typeof profileSchema>;
export const draftSchema = z.strictObject({
  display_name: z.string().max(60).optional(), gender: genderSchema.optional(),
  gender_description: z.string().max(60).optional(), bio: z.string().max(500).optional(),
  prompts: z.array(z.strictObject({id: z.string().max(50), version: z.number().int().positive(), answer: z.string().max(200)})).max(2).optional(),
  relationship_goal: z.literal('serious_relationship').optional(),
  marriage_intent: z.enum(['wants_marriage', 'open', 'not_seeking_marriage', 'prefer_not_to_say']).optional(),
});
export const requestSchema = z.discriminatedUnion('action', [
  z.strictObject({action: z.literal('bootstrap')}),
  z.strictObject({action: z.literal('eligibility'), dob: dobSchema, answers: answersSchema, policy_version: z.literal(POLICY_VERSION)}),
  z.strictObject({action: z.literal('pledge_accept'), version: z.number().int().positive()}),
  z.strictObject({action: z.literal('draft_save'), expected_revision: z.number().int().nonnegative(), fields: draftSchema}),
  z.strictObject({action: z.literal('profile_save'), expected_revision: z.number().int().nonnegative(), fields: profileSchema}),
  z.strictObject({action: z.literal('profile_submit'), revision: z.number().int().positive()}),
]);
export type ApiRequest = z.infer<typeof requestSchema>;
export const lifecycleSchema = z.enum(['onboarding', 'ineligible', 'pending_review', 'changes_requested', 'active', 'paused', 'suspended', 'banned', 'deletion_pending', 'deleted']);
export const snapshotSchema = z.strictObject({
  lifecycle: lifecycleSchema,
  eligible: z.boolean(), policy_version: z.number().int(),
  dob: dobSchema.nullable(), answers: answersSchema.nullable(),
  pledge: z.strictObject({version: z.number().int(), text: z.string(), accepted: z.boolean()}),
  prompts: z.array(z.strictObject({id: z.string(), version: z.number().int(), text: z.string()})),
  draft: z.strictObject({revision: z.number().int(), step: z.enum(['eligibility', 'profile', 'photos']), fields: draftSchema}),
  profile_revision: z.number().int().nonnegative(),
});
export type Snapshot = z.infer<typeof snapshotSchema>;
export const errorCodes = ['UNAUTHENTICATED', 'INVALID_INPUT', 'INELIGIBLE', 'RESTRICTED', 'CONFLICT', 'STALE_POLICY', 'STALE_PLEDGE', 'PREREQUISITES_MISSING', 'PROVIDER_UNAVAILABLE'] as const;
export const responseSchema = z.discriminatedUnion('ok', [
  z.strictObject({ok: z.literal(true), data: snapshotSchema}),
  z.strictObject({ok: z.literal(false), code: z.enum(errorCodes)}),
]);
export function onboardingRoute(state: Snapshot): 'restricted' | 'status' | 'eligibility' | 'profile' | 'photos' {
  if (['suspended', 'banned', 'deletion_pending', 'deleted'].includes(state.lifecycle)) return 'restricted';
  if (!state.eligible || !state.pledge.accepted) return 'eligibility';
  if (['pending_review', 'active', 'paused'].includes(state.lifecycle)) return 'status';
  return state.draft.step === 'photos' && state.profile_revision > 0 ? 'photos' : 'profile';
}
