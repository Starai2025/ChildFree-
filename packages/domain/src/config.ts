import { z } from 'zod';

const url = z.url().refine(value => new URL(value).protocol === 'https:', 'Use HTTPS.');
const configSchema = z.strictObject({
  stage: z.enum(['development', 'staging', 'production']),
  supabaseUrl: z.url(),
  publishableKey: z.string().regex(/^sb_publishable_[A-Za-z0-9_-]{16,}$/, 'Use a Supabase publishable key, never a secret or service-role key.'),
  termsUrl: url, privacyUrl: url, supportUrl: url,
}).superRefine((config, ctx) => {
  const parsed = new URL(config.supabaseUrl);
  const local = config.stage === 'development' && ['localhost', '127.0.0.1'].includes(parsed.hostname);
  if (parsed.username || parsed.password || (parsed.protocol !== 'https:' && !local)) {
    ctx.addIssue({code: 'custom', path: ['supabaseUrl'], message: 'Use HTTPS (local development may use loopback HTTP).'});
  }
});
export type PublicConfig = z.infer<typeof configSchema>;
export function readPublicConfig(input: unknown): {ok: true; config: PublicConfig} | {ok: false; fields: string[]} {
  const parsed = configSchema.safeParse(input);
  return parsed.success ? {ok: true, config: parsed.data} : {ok: false, fields: [...new Set(parsed.error.issues.map(issue => issue.path[0]?.toString() ?? 'configuration'))]};
}
