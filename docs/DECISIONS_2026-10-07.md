# Owner decisions — 7 October 2026

Recorded by Starr (owner). These decisions amend the Build Spec (Revision 3) and Execution Plan (Revision 2) where they conflict. Everything else in the spec stays authoritative, including eligibility, the Community Pledge, the prompt catalog, safety rules and V1 exclusions.

Goal: the easiest free setup that reaches a working MVP1 for an invite-only Atlanta founding beta.

## D1. Chat: Supabase Realtime, not Stream

- Replaces Stream Chat for V1. This is the explicit budget decision required by spec section 2. Stream is not installed; there is one chat backend only.
- Messages live in a Supabase `messages` table (match_id, sender_id, body, created_at, status). RLS: only the two members of an active match can read; nobody inserts directly.
- Sending goes through one authenticated server path (RPC or Edge Function) that rechecks match status, blocks, lifecycle and the 20 messages/minute limit before insert. Text only, 1–1000 characters, no links rendered as clickable.
- Clients subscribe with Supabase Realtime (Postgres changes) filtered to their match. RLS must also apply to Realtime.
- Block/unmatch closes the match in the same transaction; RLS then denies reads and sends immediately. No vendor revocation step is needed.
- Spec sections about Stream channel provisioning, outbox chat jobs and Stream webhooks are deferred. Keep a thin chat module so a provider could be swapped later.

## D2. Identity: manual admin review for the beta; Persona deferred

- No Persona integration in MVP1. Do not show any "verified" or "ID checked" label anywhere.
- Approval prerequisites become: current eligibility, current pledge acceptance, adult by DOB, complete profile, approved photos, approved revision, admin approval, not suspended/banned.
- Beta admission is invite-only. Persona (or another ID provider) is required before any public launch.

## D3. Email: Supabase built-in email first, Resend free tier when testers join

- Development uses Supabase's default email OTP sender (rate-limited, fine for the builders).
- Before inviting testers, connect Resend's free tier as custom SMTP.

## D4. Builds: Expo free tier only

- Develop with a development build or Expo Go where compatible; use EAS free builds for TestFlight/Play internal testing. No paid EAS plan.

## D5. No video or voice in V1

- Confirmed. Video/voice and the timed-chat concept are V2.

## Cost target

$0/month for development and the invite-only beta: Supabase Free, Expo/EAS Free, Resend Free. Store developer accounts (Apple $99/year, Google $25 one-time) are needed only for TestFlight/Play testing.
