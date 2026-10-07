# Build status

Specification Revision 3; execution plan Revision 2. Implementation: Codex. Integrated branch: main. Reviewed source commit: e6343951e55da8addf9f2e51489a45d895ec8025.

Starr authorized continued locally verifiable Codex work while native testing remains unavailable. F01 software scaffold is accepted; F01/F03 native-runtime and complete Foundation gates are still open.

## Current implementation

- F02: validated public settings, separate environment identifiers, pinned dependencies, shared domain workspace and committed CI workflow. GitHub CI has not executed (no remote).
- B01/B02 partial: initial private onboarding migration, permissioned session-derived RPCs, eligibility, versioned pledge/catalog, own snapshots, revision-checked drafts, complete structured-profile draft revisions. All private tables use RLS and deny direct member access. The full V1 schema is not yet implemented.
- U02 partial: email OTP SDK client, session restoration, eligibility/pledge UI, two structured prompts, explicit gender selection, private draft saves/resume, Back save and setup/error states. Photos/preferences/identity screens are not wired. OTP/deep-link and physical-device testing are pending.
- F03 preparatory: distinct app schemes/identifiers, EAS profiles, SDK-compatible SecureStore/development-client packages. No EAS credentials, signed builds or device launches.
- Admin remains the F01 static shell. MFA, reviewer roles and moderation operations are not implemented.

Profile submission always denies missing prerequisites. No real verified/approved/discoverable profiles exist. No chat or matching is implemented.

## Checks

Current focused checks: domain/SQL/Edge-handler tests, workspace typecheck/lint, Deno Edge typecheck, admin build and both iOS/Android JavaScript exports pass. Browser regression checks passed. A6 accepted the locally verifiable slice at the reviewed commit; clean-clone npm ci and checks passed (859 packages; 22 tests). See docs/ONBOARDING_VERIFICATION.md.

## Remaining gates

Real Supabase migration reset/deployment and shared-domain bundling; live JWT/PostgREST checks; actual OTP/SMTP delivery; native secure-session/keyboard/accessibility/lifecycle testing; MFA/admin review; real photo processing and Persona; preferences/PostGIS/discovery; matching and managed chat/revocation; reports/block/delete/export; legal acceptance audit; staffed support/moderation; staged release QA. Credentials and owner-reviewed legal/support pages are absent.

Do not call Milestone A or the dating MVP complete. No live-member beta or production publishing is authorized by this checkpoint.

## Next action

Prove the hosted development onboarding and native runtime when owner-controlled accounts/tooling are available. The next feature ticket is the MFA/admin permission spine, followed by photo/Persona prerequisites. Continue other locally verifiable tickets within the accepted contract without pretending external gates have passed.

Setup and contracts: docs/LOCAL_SETUP.md. Task card: docs/ONBOARDING_TASK_CARD.md. Previous scaffold evidence: docs/F01_VERIFICATION.md.
