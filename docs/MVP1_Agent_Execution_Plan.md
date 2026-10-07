# MVP1 agent execution plan

For Starr • 6 October 2026

Execution revision 2: step-by-step task gates, checkpoints and the first ready-to-run assignment.

## Purpose and authority

Build the native dating MVP defined by Native_Dating_MVP_Build_Spec.md, Revision 3. The product specification remains authoritative for eligibility, privacy, screens, vendor choices and V1 exclusions. This plan organizes implementation; it does not introduce additional product features or claim the app is implemented.

Use eight named task roles across Claude Code and Codex. These are reusable work assignments, not eight required subscriptions or eight simultaneous agents. Default: Claude Code implements; Codex independently reviews. Codex can implement an isolated assignment and Claude Code can review it. Starr decides product changes and controls external accounts. Do not confuse an AI task role with a staffed production moderator.

Recommended initial staffing: one implementation session and one review session. After contracts and boundaries are stable, permit at most three simultaneous implementation tasks in distinct worktrees with disjoint ownership. One coordinator is responsible for integration. Do not parallelize edits in a single checkout. No agent may approve its own work as independently reviewed.

## The eight roles

| ID | Role | Responsibilities | Typical tool/session |
|---|---|---|---|
| A0 | Build coordinator and integrator | Freeze scope, break down tickets, track dependencies, assign ownership, integrate reviewed commits, report blockers | Codex or Claude Code coordinator |
| A1 | Foundation and native environment | Repository, Expo, minimal web admin scaffold, locked dependencies, environment validation and CI | Claude Code implementation |
| A2 | Backend and authorization | All migrations/RLS, domain validation, auth/eligibility/profile APIs, discovery and atomic matching | Claude Code or isolated Codex implementation |
| A3 | Native product and UI | Design tokens, accessible screens, onboarding resume, photo/profile interactions and discovery/connection UI | Claude Code implementation |
| A4 | Managed-service integrations | Stream, Persona, SMTP, image processing, outbox workers, webhooks and push integration | Claude Code or isolated Codex implementation |
| A5 | Trust, moderation and member controls | Minimal admin workflows, reports, block/unmatch UX, deletion/export orchestration and community standards drafts | Claude Code implementation; human reviews operational policies |
| A6 | Independent security and QA | Adversarial API/provider access checks, SQL/concurrency tests, native E2E, regression verification | Codex reviewing Claude changes; reverse when Codex built |
| A7 | Release and operations | Environment deployment, builds, secret configuration, migrations rollout, recovery, store submission package and readiness evidence | Coding agent with authorized account access; Starr owns accounts |

No dedicated AI matching, livestream, payments, growth automation or data-science agent is needed for MVP1. Candidate-density instrumentation is part of A2/A4; marketing and member recruitment can proceed separately without blocking the code skeleton.

## File ownership and change boundaries

The repository paths below are targets to create, not a claim that files already exist.

| Owner | Exclusive/shared boundary |
|---|---|
| A0 | Task status and integration branch. Coordinates shared files and merges; does not silently revise product requirements. |
| A1 | Workspace configuration, package manifests, lockfile, Expo/EAS config, root tooling and CI until foundation handoff. |
| A2 | supabase/migrations, SQL authorization functions and packages/domain contracts. Other roles request changes through A2. |
| A3 | apps/mobile screens/components, excluding integration modules claimed by A4. |
| A4 | apps/mobile/services adapters and supabase/functions integration/worker directories, agreed in each task. |
| A5 | apps/admin and member-control screens explicitly released by A3; requests SQL/API changes from A2. |
| A6 | Security/native test directories and review findings. Read-only toward implementation during review; fixes return to the owning role unless explicitly reassigned. |
| A7 | Deployment/runbooks and build configuration after A1 hands off those files. No concurrent lockfile/config edits. |

Ownership is by task, not permanent bureaucracy. A0 can reassign a module after recording the handoff. Database migration ownership always has exactly one writer. Generated database types are regenerated from migrations; never hand-patch them in multiple branches.

## Shared start instructions for every role

1. Read the product specification, this plan and repository AGENTS.md/CLAUDE.md if present. Later numbered specification revisions supersede earlier wording; flag unresolved contradictions before implementing the affected behavior.
2. Read the assigned ticket, dependencies and accepted base commit. Work in its branch/worktree. Record owned files before edits. Ask A0 to resolve overlaps; do not modify a sibling's uncommitted files.
3. Follow the existing stack/contracts. Implement routine details autonomously, but document material choices. Do not change eligibility, free messaging, trust claims or V1 exclusions.
4. Implement a complete behavior with loading, empty, error, offline and restricted states relevant to that ticket. Authorization lives on the server/vendor boundary, not only in the UI.
5. Use synthetic data. Vendor secrets stay in environment/secret managers, never source, screenshots, logs or prompts. A sandbox success is not production readiness.
6. Run the ticket's focused checks, then return the handoff below. Never mark an unrun test as passed or a mocked integration as complete.

## Task state and handoff contract

States: ready → implementing → review → changes_requested → review → integrated. blocked is explicit and contains the missing dependency plus useful work still available. A task is integrated only after reviewed code is merged and its affected checks pass on the integration branch.

Every ticket contains: ID, role, goal, accepted dependencies/base commit, owned paths, inputs, implementation steps, acceptance tests and excluded scope.

Every handoff returns:

- Ticket ID; branch and commit; actual behavior completed.
- Changed files and any migration/config changes.
- Commands run, pass/fail results and relevant native/provider evidence.
- Mocked or unavailable integrations and residual limitations.
- New dependencies, unresolved blockers and rollback considerations.
- Reviewer findings resolved or still open.

Required review outcomes: accept, request_changes, or blocked_on_evidence. Findings identify severity, reproduction, affected files and expected repair. Missing credentials or a missing test device cannot be disguised as implementation success.

## Execution waves and build gates

| Wave | Work | Safe concurrency | Gate to advance |
|---|---|---|---|
| 0 | A0 scope/tickets; A1 native foundation; Starr starts vendor/store/domain setup | Account setup alongside one foundation writer | Clean install and native development builds open; versions/config owned |
| 1 | A2 contracts/schema; A3 isolated design components; A4 integration feasibility spikes | Disjoint worktrees; UI may use labeled synthetic fixtures locally | Migrations rebuild, permissions pass, provider integration limitations established |
| 2: Milestone A | Auth → eligibility/pledge → saved structured profile → seeded review queue | Backend/API first; mobile/admin attach to accepted contracts | Onboarding drafts resume; admin works with labeled seeded review fixtures; real submission/access stays denied until required photos/verification exist |
| 3: Milestone B | Private photos → Persona → approval → reciprocal discovery | Integration/backend/mobile tasks can proceed after interfaces freeze | Two eligible verified sandbox adults become approved and appear only within reciprocal filters |
| 4: Milestone C | Atomic likes → one match/channel → text chat → block/unmatch | Matching before chat binding; independent UI theming can overlap | Two native users converse; race/idempotency/revocation tests pass |
| 5: Milestone D | Reports/admin, deletion/export, push, instrumentation, accessibility | Reports are designed earlier; final implementation joins stable APIs | Safety/member-control checks, privacy review and device smoke suite pass |
| 6 | A7 staging rollout/recovery and store packages; A6 final regression | Documentation/account tasks alongside review | Release evidence complete; owner-authorized distribution; real moderation coverage |

Safety features must exist before real-member beta. Milestone C demonstrations use synthetic accounts in isolated environments. Do not invite real members because matching works while reporting/deletion remain unfinished.

Sequencing clarification: the authoritative submission endpoint requires approved photos and completed verification. Therefore Milestone A cannot claim a genuine end-to-end member submission before Milestone B. Test its draft-save behavior and prerequisite rejection; exercise the admin queue with explicitly seeded staging review fixtures. Milestone B proves the full actual submission → approval path. Do not weaken prerequisites or fabricate verified labels to make Milestone A appear complete.

## A0: coordinator steps

1. Copy the authoritative specification into repository docs; reference it from AGENTS.md/CLAUDE.md. Keep this execution plan as an operational companion, not a replacement spec.
2. Initialize ticket ledger with the task IDs below. Confirm the accepted default scope. Working name and configurable palette cannot block functional work.
3. Assign one writer to migrations, lockfile and each active path. Create branches/worktrees from the accepted base commit and record dependencies.
4. Start A1; queue A2/A3/A4 only when their foundation dependencies are accepted. Ask A6 for focused review after each meaningful change.
5. Integrate reviewed commits one at a time; rerun affected checks. Reconcile migration order/generated types before accepting dependent work.
6. Maintain a short build status: completed milestone, current tickets, evidence, blocked external setup and next gate. Freeze additions until the core slice passes.

Copy-ready assignment: “Act as A0 for MVP1. Read the specification and execution plan. Create the ticket ledger, ownership map and dependency order for Wave 0 and Milestone A. Do not introduce product features. Establish the accepted base commit and prepare A1's assignment. Integrate only independently reviewed changes with test evidence.”

## A1: foundation steps

1. Create Expo/React Native/TypeScript mobile app and minimal web admin scaffold; select compatible versions from current official docs when actually initializing.
2. Configure environment parsing, dev/staging/prod identifiers, secret exclusion and .env.example with placeholders. Validate missing config clearly.
3. Add shared domain workspace only as needed, lint/typecheck/test commands and CI. Record exact runtime/package versions and commit lockfile.
4. Configure native development builds, auth redirect schemes and safe-area/keyboard basics. Document reproducible clean installation and build steps.
5. Prove that an iOS build and an Android build launch. Report any device/build access gap explicitly; browser preview alone does not satisfy the gate.
6. Handoff shared config ownership and dependency snapshot to A0/A7. Do not install deferred payment/video/AI SDKs.

Copy-ready assignment: “Act as A1. Implement F01–F03 only. Bootstrap the selected native stack, minimal admin scaffold, environment validation and CI. Pin compatible versions. Return clean-install and native-build evidence plus unresolved external credentials. No discovery/chat/payments implementation yet.”

## A2: backend and authorization steps

1. Convert table descriptions into executable migrations, constraints/indexes and typed domain validation. Define role/resource/action matrix before exposing records.
2. Add synthetic fixtures, owner/nonowner RLS tests and server-controlled admin/moderator assignment. Privileged fields cannot be member-written.
3. Implement auth-linked identity, eligibility, pledge/catalog, saved drafts with revision checks and structured-profile submission APIs. Approval remains denied until prerequisites are complete.
4. Implement profile review state transitions; connect A5 decisions to audited server endpoints. Incorporate verified vendor result only from A4's validated webhook flow.
5. Add reciprocal age/gender/radius discovery, privacy-safe projections and persisted unanswered assignments. Test birthdays, exhausted pools, changed preferences and resumed sessions.
6. Implement pair-locked Like/Pass/Block/Unmatch, unique matches and transactional outbox. Validate concurrent requests and retries.
7. Provide member-control/report/export/deletion endpoints with A5/A4. No raw message duplication or broad elevated SQL discovery grants.

Copy-ready assignment: “Act as A2. Implement the assigned B-series ticket against the current specification. You own migrations and shared API/domain contracts. Write meaningful authorization/state/concurrency tests before wiring client access. Derive actor identity from verified sessions. Return reproducible reset/test output and typed contracts for UI/integration roles.”

## A3: native product/UI steps

1. Define compact semantic tokens and reusable Button, Field, StepHeader, Avatar, ProfileCard and EmptyState. Use original configurable branding, not copied Tinder assets.
2. Implement native login/session routing and six-step onboarding, including pledge, two structured prompts and saved progress. Server state controls routing.
3. Attach photo/preference/identity screens to A4/A2 contracts; show pending/rejected/upload/retry states honestly.
4. Implement discovery cards, approved-photo navigation and Like/Pass controls; preserve unanswered cards and daily assignment counts.
5. Add confirmed-match celebration, provisioning state and connections grouping from accepted messages. Bind existing native Stream components; A4 owns the authorized send adapter.
6. Add accessible member settings and A5 control screens, then test keyboard, small phones, enlarged text, screen reader and reduced motion.

Copy-ready assignment: “Act as A3. Implement only the assigned U-series native screens using accepted typed contracts and selected SDK UI. Include server-state routing, error/offline states and accessibility. Fixtures may be used in isolated development only. Never claim mock matches or verification are live. Do not change eligibility or add paid/media features.”

## A4: managed-service integration steps

1. Run early compatibility spikes for Expo, Stream and Persona sandbox/hosted flow. Prove the restricted Stream permission model before committing to chat UI wiring; report a vendor limitation rather than circumventing it.
2. Configure Supabase SMTP integration and OTP deliverability/redirect tests without exposing credentials.
3. Implement private photo upload/finalization, byte inspection, normalization/EXIF removal, quarantine and approved URL delivery. Demonstrate actual server-side processing on the chosen runtime; client-only metadata stripping is insufficient.
4. Implement Persona start/reconciliation, signature validation and deduplicated webhook processing. Store minimum provider references and verified-adult status; client redirects cannot set approval.
5. Implement outbox claim/lease/retry/dead-letter worker; deterministic Stream channel creation and scoped sessions. Disable client send/channel mutation permissions and route sends through the authorized server composer.
6. Implement vendor access revocation for block/unmatch/suspension/deletion and test existing tokens/open sockets. Report pending revocation honestly during vendor failure.
7. Implement one push delivery path, signed/deduplicated Stream webhooks, receipts/token retirement and generic notifications. Add allowlisted analytics only after core integration works.

Copy-ready assignment: “Act as A4. Implement the assigned I-series integration through a narrow typed adapter. Use the selected providers; no second chat store. Validate signatures, retries, idempotency and direct-client bypass attempts. Provide sandbox/provider evidence and mark production approvals separately. Keep secrets and message content out of logs.”

## A5: trust/admin/member-control steps

1. Build MFA-protected minimal admin queue with audited review decisions. Moderators see only needed profile/report data.
2. Implement profile/photo review, clear correction feedback and supported appeals. Identity approval and community eligibility are distinct.
3. Map pledge standards to report categories; implement report evidence association, receipt and status handling. Block and report remain independent.
4. Implement member block/unmatch/settings screens with A2/A4 enforcement; pending provider revocation is not displayed as confirmed success.
5. Implement deletion/export jobs, restricted report evidence retention and vendor cleanup proof. Export must not reveal another member's private details.
6. Prepare community/privacy/support drafts for owner review and operator procedures. Identify who handles urgent/routine reports; do not invent staffing or legal approval.

Copy-ready assignment: “Act as A5. Implement the assigned T-series admin/member-control ticket using A2 APIs and A4 provider actions. Enforce MFA/roles and audit trails. Map reporting to community standards and retain scoped evidence. Return direct-access tests and realistic operational gaps. Do not decide production legal policy or fabricate moderator coverage.”

## A6: independent security/QA steps

1. Review each change against the specification, affected contract and prior accepted behavior. Inspect actual source and migrations, not only the builder summary.
2. Test unauthorized SQL/API/storage/provider calls: stale or foreign sessions, actor spoofing, private data exposure, forged verification and self-approval.
3. Test simultaneous mutual likes, Like versus Block, duplicated webhook/jobs, worker crash/retry and interrupted onboarding/discovery.
4. Test block/unmatch with an already-issued Stream token and open socket, including provider outage. Confirm actual configured permissions prevent direct sending.
5. Execute native E2E for two synthetic accounts on both platforms, plus appropriate accessibility/layout and lifecycle cases.
6. Return reproducible findings to the owner; verify fixes and re-review changed code. Never call a mocked two-account demo production-ready.

Copy-ready assignment: “Act as A6, independent reviewer. Review the assigned commit range against the specification. Inspect database, API, storage and vendor authorization paths. Run focused tests and reproduce failures; distinguish passed, failed and unrun checks. Return accept/request_changes/blocked_on_evidence with severity, reproduction and expected repair. Do not rewrite feature code during review unless ownership is explicitly transferred.”

## A7: release/operations steps

1. Inventory required owner accounts, accepted programs, domains, store identities and secrets; distinguish sandbox and production. Do not purchase plans or create contractual commitments without owner authorization.
2. Configure staging deployment/build profiles, server rollout switches, worker scheduling and migrations order. Native and server versions must be compatible.
3. Test backup/restore and failed rollout recovery. Preserve report/block/delete availability during incidents.
4. Assemble TestFlight/Play test packages with accurate metadata, synthetic reviewer accounts and functional backend. Apply applicable testing requirements to the actual owner account.
5. Audit SDK data collection against privacy disclosures and check deletion/support/child-safety documentation with the owner. A generated policy is not a completed legal review.
6. Obtain A6 regression evidence and verified operator coverage. Deliver a concrete release candidate for owner review; production release is a separate authorized action.

Copy-ready assignment: “Act as A7. Prepare the assigned R-series staging/release candidate and runbook from reviewed commits. Validate secrets, deployment order, restore behavior, native test builds and disclosure completeness. Return exact build/commit identifiers and readiness evidence. Do not claim store approval or publish production without the owner's release authorization.”

## Initial ticket ledger

| ID | Owner | Task | Depends on |
|---|---|---|---|
| F01 | A1 | Repository/native/admin foundation and pinned dependencies | A0 assignment |
| F02 | A1 | Environment validation and CI | F01 |
| F03 | A1 | iOS/Android build and auth redirect baseline | F01–F02 |
| B01 | A2 | Migrations, RLS, roles and domain contracts | F01–F02 |
| U01 | A3 | Native tokens/components, screen states | F01–F02 |
| I01 | A4 | Stream/Persona compatibility and permission spikes | F03; minimum auth contract from B01 |
| B02 | A2 | Eligibility, pledge/catalog, drafts and submission APIs | B01 |
| I02 | A4 | SMTP/OTP integration | F03, B01 |
| U02 | A3 | Login and resumable structured onboarding | B02, I02, U01 |
| T01 | A5 | Minimal MFA admin review queue | B02; admin role/MFA configuration |
| I03 | A4 | Private photo pipeline | B01; photo contract accepted |
| I04 | A4 | Persona reconciliation/webhooks | I01, B02 |
| B03 | A2 | Approval prerequisites/review transitions and safe discovery | B02, I03–I04 |
| U03 | A3 | Photo/preferences/identity and discovery screens | U02, I03–I04, B03 |
| B04 | A2 | Pair-locked reactions/matches/block/unmatch plus outbox | B03 |
| I05 | A4 | Stream sessions/channel worker/authorized send/revocation | I01, B04 |
| U04 | A3 | Match celebration, connections and native text chat | U03, I05 |
| T02 | A5 | Reports and member safety/admin workflows | T01, B04, I05; report API from A2 |
| T03 | A5 | Deletion/export/retention orchestration | T02; A2/A4 cleanup contracts |
| I06 | A4 | Push receipts, deduped notification worker and minimal analytics | I05; accepted report/block state |
| Q01 | A6 | Independent focused reviews after each change | Assigned reviewed commit range |
| Q02 | A6 | Complete native/safety regression | U04, T02–T03, I06 |
| R01 | A7 | Staging configuration, deploy/restore proof | F03, reviewed backend/integrations; may progress incrementally |
| R02 | A7 | Test distributions and release candidate evidence | Q02, R01, owner accounts/operator readiness |

These are implementation tickets, not elapsed-time estimates. A0 may split an oversized ticket into sub-tasks preserving contracts and dependencies. Integration spikes are required early evidence; do not hold basic UI/domain work until every production account is accepted.

## Completion standard

Engineering-complete MVP1: two synthetic eligible adults can sign up, attest/accept pledge, build profiles, upload photos, verify adult identity, receive audited approval, discover each other within reciprocal preferences, mutually match and exchange accepted messages. Block/unmatch/reports/deletion work through direct API/provider access tests; retries and interrupted sessions do not corrupt state; builds run on both native platforms.

Ready for real-member beta additionally requires production vendor approvals/configuration, accurate policies/disclosures, moderator coverage, controlled admission and tested recovery. App-store approval and healthy candidate density are separate outcomes; no agent can guarantee them from a passing code test.

## How Starr runs this without managing eight people

Start one builder session with A1 and one independent reviewer session with A6. Keep A0's ticket ledger as the handoff memory. After A1 passes, reuse the builder session for A2; open a separate UI session only once A2 contracts are accepted. Assign A4 when actual provider integration work is ready. Reuse sessions for A5/A7 later. Give each session its role prompt plus exactly one ticket and the same accepted specification/commit. A0 coordinates merges, rather than having Starr manually reconcile every file.

No agents were launched and no app code was built as part of authoring this execution plan. The next action is assigning F01 to the coding environment where the repository will live.

## Step-by-step control loop: apply to every ticket

The mechanism below reduces skipped steps and unverified handoffs. It cannot guarantee business success or app-store approval. It is mandatory engineering workflow, not a requirement for Starr to approve each reversible implementation action.

1. **Select the next ready ticket.** A0 checks that required dependencies are integrated and identifies the accepted base commit. Unfinished dependencies cannot be replaced by guessed data contracts. Independent work with explicitly satisfied prerequisites may proceed while another ticket is blocked.
2. **Complete its task card.** Before coding, fill the goal, owned paths, inputs, ordered substeps, acceptance criteria and excluded scope. Keep this brief and concrete. A0 expands the next ticket only; do not spend days writing every future ticket in advance.
3. **Establish the baseline.** Record current repository status and run checks relevant to the affected area. Identify existing failures separately. Work in the assigned worktree; preserve unrelated user changes. Claim shared-file ownership before installing/upgrading dependencies.
4. **Implement the smallest complete behavior.** Finish its server/client/error paths together where the ticket calls for them. Do not substitute screens for functionality, mocks for real integration, or disabled validation for a successful demo. Update contracts first when the accepted task requires an interface change.
5. **Verify the ticket.** Run its actual commands/tests and capture outputs plus native/provider evidence where required. A screenshot verifies appearance, not authorization. Unrun checks remain unrun; blocked checks identify their missing input.
6. **Independent review and repair.** A6 inspects the exact commit/diff and evidence. The owner fixes reproducible findings. Rerun affected checks and return the fix for review. Do not repeatedly patch symptoms without inspecting the cause.
7. **Integrate and verify together.** A0 merges reviewed commits, regenerates migration-derived types if applicable, and runs the affected integrated checks. Standalone branch success does not establish integration success.
8. **Checkpoint and advance.** Record the accepted commit, review result, evidence and next ready task in repository status. Move the ticket to integrated only now. Continue without a new user confirmation unless scope, spending, sensitive account access or release authorization actually requires it.

## Task card template

Use this form in the repository ticket ledger, not a separate planning document per task:

```text
ID / owner / independent reviewer:
Goal: one observable result
Dependency tickets and accepted base commit:
Owned paths; files requiring coordinated changes:
Inputs and required environment variables (names only):
Implementation steps: ordered, bounded actions
Acceptance criteria: behavior + forbidden behavior + failure handling
Verification commands/evidence: actual commands resolved for this repository
Excluded scope:
Blocker/fallback: what can proceed without weakening requirements
Result: branch/commit, checks, review outcome, integrated commit, next task
```

Default status is not_started. A task card's existence is not evidence of completion. Expected commands are populated when the repository/tooling exists; this document does not invent successful test logs.

## Ready-to-run F01 assignment

**Owner:** A1 Foundation. **Reviewer:** A6, independent session. **Goal:** a reproducibly installable native app skeleton and minimal admin skeleton, with pinned compatible dependencies.

**Inputs:** the accepted Revision 3 specification; this plan; the chosen code workspace/repository. If no repository exists, create an isolated local git repository in the coding workspace and commit the scaffold. Creating an external remote or publishing is not part of F01. Brand can use an explicitly temporary configurable working name. No production vendor credentials required.

**Own:** root workspace tooling/manifests/lockfile, apps/mobile scaffold, apps/admin scaffold, README and initial repository agent instructions. Hand off mobile/admin ownership after this task; do not edit either concurrently with their next role.

**Steps:**

1. Inspect the workspace and any existing git status/AGENTS.md. Reuse an existing intended repository; do not overwrite unrelated projects or initialize over unknown work.
2. Establish the workspace/runtime/package-manager choice and validate current Expo/native compatibility using official docs. Pin versions and one lockfile; avoid unused UI/backend frameworks.
3. Initialize apps/mobile with Expo/React Native/TypeScript/Router and a minimal apps/admin web shell. Do not implement login, eligibility, matching or chat yet.
4. Add repository README instructions for installing and starting both shells. Add AGENTS.md/CLAUDE.md pointing to the specification and ownership/review rules; include the future testing commands only as implemented tooling becomes available.
5. Verify a clean installation from the committed dependency state. Launch the mobile shell in an available native development environment and the admin shell in its local environment; record which platforms were actually exercised.
6. Commit the scaffold and hand off evidence to A6. If native launch requires unavailable tools/devices, complete available work but mark the native evidence blocked. F03 still owns the full iOS/Android development-build proof; do not claim F01 alone satisfies that gate.

**Acceptance:** both entrypoints exist and start in the available environments; clean install is reproducible; TypeScript compiles for created code using configured checks; versions and lockfile are committed; configuration contains no secrets; copied source/assets are licensed; documentation matches actual commands. No fake dating profiles, verification badges or placeholder production success states.

**Excluded:** vendor provisioning, payments, AI, livestreaming, production deployment, real member data and final brand design. Environment validation/CI implementation belongs to F02; native build/auth redirect proof belongs to F03.

**Handoff:** exact commit, install/start/check commands and outputs, actual platform/device evidence, unavailable tooling and the ready F02 assignment. A6 reviews F01 before A0 integrates it.

## Milestone evidence gates

| Gate | Required demonstrated result | Cannot count as completion |
|---|---|---|
| Foundation | Clean install, checks/CI and iOS/Android development builds launch | Browser preview alone, package install alone or untested generated screens |
| A | Real email login and resumed eligibility/pledge/profile drafts; direct prerequisite rejection; admin controls tested with labeled seeded fixtures | Fabricated verification/photo status to permit premature submission |
| B | Actual private upload/review, signed vendor verification reconciliation, submission/approval and reciprocal discovery | Client callback setting verified, public photos or bypassed age/radius rules |
| C | One atomic mutual match/channel, accepted text messages, permission and block/unmatch race/revocation checks | Optimistic fake match, duplicate channel, UI-only block or unrestricted vendor client send |
| D | Reports, deletion/export, notification deduplication, accessibility, whole native/safety regression | A happy-path demo without direct-access and failure tests |
| Release candidate | Staging deployment/recovery, owner-account configuration, operator coverage and complete test-distribution package | Claimed store approval, mock production account or absent human moderation |

## Failure handling and controlled changes

- **A check fails:** diagnose and repair within the ticket, then rerun affected checks. Do not proceed with that ticket's dependent work as if it passed.
- **An SDK/service cannot satisfy the security contract:** mark the integration blocked, document the exact limitation and proposed alternative/impact; get the architecture decision resolved before building around it. Do not add a second backend silently.
- **A contract/migration must change:** A2 owns the change; A0 identifies dependent tasks and new tests. Regenerate types and rerun those affected integration checks before merging consumers.
- **An external credential/device is missing:** complete independent work; track exact required input and evidence gap. Do not invent a sandbox result or require Starr to resend an already available specification.
- **The task grows too large:** split it into smaller complete tickets with explicit dependencies. Avoid arbitrary line-count limits and unfinished partial paths labeled done.
- **A release fails:** stop new exposure/admission using controlled server switches while preserving safety/settings; recover using the tested runbook. Code revert and database rollback are different actions: do not assume reverting a commit reverses a migration or deletes vendor data safely.
- **A new feature is suggested:** record it in deferred scope and continue the accepted MVP unless Starr explicitly changes the objective.

## Progress and session continuity

A0 maintains one repository status file with task states, accepted commits, reviewer outcomes, active ownership, actual checks, external blockers and the next ready ticket. Keep evidence references close to each ticket. On resume, an agent reads this file and git status before editing; it must not trust a chat summary over repository state.

After each integrated ticket, send Starr a brief update: completed behavior, actual verification, remaining blocker if any, next task. Do not require Starr to coordinate every agent or approve every merge. During implementation, communicate meaningful findings regularly rather than remaining silent until an entire milestone finishes.

**The next executable action remains F01.** These controls refine how the existing tickets are carried out; they do not create another feature phase or imply code has already been built.
