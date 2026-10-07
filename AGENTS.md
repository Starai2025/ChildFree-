# Project instructions for all coding agents

Read docs/Native_Dating_MVP_Build_Spec.md and docs/MVP1_Agent_Execution_Plan.md before implementing a ticket. The product specification is authoritative. Read BUILD_STATUS.md for current progress and accepted ownership.

- Work on one assigned slice. Starr authorized continued Codex implementation while native testing remains unavailable. F02 and locally verifiable backend/onboarding work may proceed; F01/F03 native evidence and release gates remain unresolved.
- Preserve eligibility, free mutual-match messaging and all explicit V1 exclusions.
- One writer owns migrations; one writer owns manifests/lockfile. Coordinate overlapping changes.
- Keep source strongly typed; use the committed npm lockfile and run npm ci from the root.
- Run npm run check for typecheck, lint, focused domain/SQL tests and admin build. Export native JavaScript after mobile changes. Report hosted-provider and native-runtime checks separately.
- SDK 57 targets React Native 0.86 and React 19.2.3. Read current official versioned docs before adding native modules; use expo install for SDK-compatible dependencies.
- Synthetic fixtures only in isolated development. Never label mock approval/verification/matches as real.
- Secrets and personal member data stay out of source, prompts and logs. No production publishing or paid-plan commitment without owner authorization.
- Return commands actually run, results, changed files, limitations and the review handoff. Never claim native launch from a successful web/native JavaScript export.
- The independent A6 reviewer may work read-only against a fixed commit/diff; report findings to the builder rather than editing files concurrently.
