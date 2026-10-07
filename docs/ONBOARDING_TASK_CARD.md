# Codex task card: environment and first onboarding slice

Owner: Codex (one writer across A1/A2/A3 boundaries). Branch: feat/member-onboarding. Base: 5b99993a8616d2398f7e3c71877e62f8dac88992.

Starr authorized continued Codex work while device tooling remains unavailable. This allows locally verifiable implementation to proceed; it does not pass F01/F03 native or release gates.

Owned paths: root manifests/lockfile/config/CI, packages/domain, supabase migrations/functions, mobile screens/services, build-status/setup/evidence documents. Admin remains untouched.

Goal: F02 configuration/CI plus B01/B02/U02 portions that can be implemented and tested without external credentials. Do not mark complete Milestone A; hosted auth/SMTP, native builds, complete schema, seeded review fixtures and MFA/admin review are outstanding.

Acceptance: missing config fails closed; strict typed inputs deny actor/approval spoofing; session-derived RPC ownership; private tables inaccessible; adult/current attestation and pledge prerequisites enforced; two prompt references validated by catalog; stale draft writes denied; native screens handle errors/loading, restore server drafts and save on Back; no profile becomes visible; submission denied until remaining prerequisites exist. Meaningful Node/SQL/handler checks, rendered browser tests and mobile exports. Independent A6 review required.

Excluded: live vendor accounts/deployment, paid services, genuine verification/approval, photo upload, location/discovery, matching/chat, moderation/admin operations, privacy jobs, production publishing, signed native-build claims.

Migration is an initial development-only schema. No deployed baseline exists, so corrections are made in the initial migration. Once deployed, add forward migrations rather than editing applied history.

Rollback: no external deployment performed. Restore the prior source commit to return to F01; do not apply a destructive rollback to any future live database without an independently reviewed data plan.
