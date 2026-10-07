import { requestSchema, responseSchema, type ApiRequest, type Snapshot } from '@black-childfree/domain';
import { configuration, getClient } from './client';

export class MemberApiError extends Error {}
export async function memberApi(input: ApiRequest, signal?: AbortSignal): Promise<Snapshot> {
  if (!configuration.ok) throw new MemberApiError('CONFIGURATION_REQUIRED');
  const request = requestSchema.safeParse(input);
  if (!request.success) throw new MemberApiError('INVALID_INPUT');
  const {data: {session}, error} = await getClient().auth.getSession();
  if (error || !session) throw new MemberApiError('UNAUTHENTICATED');
  let result: Response;
  try {
    result = await fetch(`${configuration.config.supabaseUrl}/functions/v1/onboarding`, {
      method: 'POST', signal,
      headers: {Authorization: `Bearer ${session.access_token}`, apikey: configuration.config.publishableKey, 'Content-Type': 'application/json'},
      body: JSON.stringify(request.data),
    });
  } catch { throw new MemberApiError('PROVIDER_UNAVAILABLE'); }
  let body: unknown;
  try { body = await result.json(); } catch { throw new MemberApiError('PROVIDER_UNAVAILABLE'); }
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) throw new MemberApiError('PROVIDER_UNAVAILABLE');
  if (!parsed.data.ok) throw new MemberApiError(parsed.data.code);
  if (!result.ok) throw new MemberApiError('PROVIDER_UNAVAILABLE');
  return parsed.data.data;
}

export function explainError(error: unknown): string {
  const code = error instanceof MemberApiError ? error.message : '';
  switch (code) {
    case 'CONFLICT': return 'Your saved information changed. Reload it before saving again. Birth date corrections need support.';
    case 'INVALID_INPUT': return 'Check the date, required fields and prompt answers before trying again.';
    case 'STALE_POLICY': case 'STALE_PLEDGE': return 'Our requirements have been updated. Reload and review the current version.';
    case 'INELIGIBLE': return 'Your current answers do not meet the membership requirements. You can correct them or contact support.';
    case 'UNAUTHENTICATED': return 'Your session has expired. Sign out and sign in again.';
    case 'RESTRICTED': return 'This action is unavailable for your account. Contact support for help.';
    case 'PREREQUISITES_MISSING': return 'Photos, preferences and identity verification must be completed before review.';
    default: return 'We could not connect or save your information. Check your connection and try again.';
  }
}
