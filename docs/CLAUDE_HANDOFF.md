# FREE MIDNIGHT — Claude handoff

You are continuing the existing Starai2025/ChildFree- app. Read this first, then AGENTS.md, docs/Native_Dating_MVP_Build_Spec.md, docs/MVP1_Agent_Execution_Plan.md, BUILD_STATUS.md and docs/FREE_MIDNIGHT_REFINEMENT.md.

## Which version this is

This package contains the current source, documentation, assets, screenshots, tests and runnable demos from local commit 8299b8aecf7908293a683517abbec28a208f7491. The latest implementation is a5cf8314bdc301c94cbd36854829530c40d68c4f, independently accepted by A6; the later commit records delivery evidence.

Public GitHub main remains 637ceb3518705cdb29c373481908e333809e2d72. The published branch preview/free-midnight-a5cf831 adds ONLY prototype/web-mvp1/free-midnight-preview.html to that older public main. Its other source files and design documents are older. Do not mistake that branch's index.html for the current editable implementation. Use this snapshot's index.html and builder.

Public preview commit: b7b0367fe6f52eb9755d0616fe1e5f25af6c660a.
Preview: https://raw.githack.com/Starai2025/ChildFree-/b7b0367fe6f52eb9755d0616fe1e5f25af6c660a/prototype/web-mvp1/free-midnight-preview.html
The public GitHub bytes were verified against the reviewed artifact; this cloud environment blocks CDN access. Actual app flows were tested locally.

The compact handoff omits only the reproducible `prototype/web-mvp1/design-preview.html` static gallery. Its source test script and all screenshots remain included; `node tests/claude-prototype-ui.mjs` regenerates it. No editable source or decision document is omitted. A complete archival ZIP is available separately.

## Current founder decisions — these supersede older branding proposals

- App name: FREE MIDNIGHT.
- Welcome headline: “The Only Thing We're Raising” / “Is the Bar.”
- Tagline: “Black Singles. No Children. Not Ever.”
- Visual direction: the founder's Midnight Luxe reference — black/emerald, warm ivory Discover, photographic rounded profile cards, gold accents and pill primary actions.
- Readability: bolder, clearer text. Bundled DM Sans for interface/wordmark, Lora Bold for Welcome/Match headlines; larger labels and stronger font weights.
- Current primary color: deep pigment burnt sienna #8A3324. It supersedes #C56445. The initially suggested web swatch #E97451 was not implemented because it remained orange-looking.
- Other colors remain locked: #111111 obsidian, #0F5C4D emerald, #C89A2B gold, #F6F0E8 ivory. Do not substitute hues. The supplied metallic logo is an image asset.
- Brand emblem: the supplied gold/emerald crescent-heart, prepared with transparency at prototype/web-mvp1/preview-assets/free-midnight-emblem.png. Original supplied board/logo images remain in the owner's chat; the prepared emblem and actual screenshots are included here.
- Audience: Black adults 25–70 who enthusiastically choose a childfree life, want similar lifestyles and actual dates. This cohort targeting does NOT change the existing authoritative 18+ eligibility gate.
- Product promise: “These people want the same kind of life I do.” Optional compatibility questions cover faith, spending habits, lifestyle pace and date availability. Never invent answers or advertise a scientifically proven best match.
- Ask the founder questions one at a time.

## Completed scope and approval boundaries

Only Welcome, Discover and Match have the new screen styling. Other screens get name-only branding where appropriate and otherwise retain their previous design. Founder screenshot approval is STILL PENDING before extending the new design to onboarding, profile, messaging, dates and other screens.

The founder previously required seeing the full demo before source publication. The later publishing authorization covers ONLY standalone HTML on an isolated preview branch. Do not merge/push implementation to main or publish additional source branches until the founder expressly authorizes that. Preparing this local handoff package is not approval to publish source or production.

The user is requesting a design continuation of the imported Claude web prototype, not a rebuild of Expo. Preserve all working eligibility, pledge, onboarding, ten-question draft/edit/skip/resume, discovery filters/ranking, mutual matching, messaging, safety controls and demo isolation. No live provider, database, production release or native runtime is proved by this demo. Keep real member/provider paths fail-closed and synthetic state separate.

## Files to work on

- prototype/web-mvp1/index.html: editable source, presentation tokens/components and existing app logic. It requires the original Claude runtime when opened alone.
- prototype/web-mvp1/local-demo-runtime.js: synthetic browser adapter. Inject ONLY into generated demo copies; do not put it in real provider/member code. Its persistence key and versioned formats remain unchanged.
- scripts/build-claude-demo.mjs: regenerate hosted demo.html and self-contained demo-standalone.html from source. It injects the isolated fixture adapter and clear demo notice; embeds images/fonts/licenses for offline delivery.
- prototype/web-mvp1/preview-assets/: portraits, prepared brand mark, Lora/DM Sans files and full font licenses. Photography is fictional; do not label it as real members or extract production photos/fonts from the reference.
- docs/evidence/native-midnight/: current FREE MIDNIGHT Welcome/Discover/Match PNGs, three-screens.png and screenshot-only screens.html. The historical folder name remains for compatibility; its current contents show FREE MIDNIGHT.
- docs/FREE_MIDNIGHT_REFINEMENT.md: current design decisions, boundaries, actual validation and delivery evidence.
- docs/COMPATIBILITY_QUESTIONS.md: optional ten-question implementation and evidence.
- docs/UI_IMPROVEMENT_PLAN.md: founder/product decisions; latest FREE MIDNIGHT note supersedes older Native/three-direction sections.
- docs/NATIVE_MIDNIGHT_LUXE.md: historical Native checkpoint; use FREE_MIDNIGHT_REFINEMENT for current colors/fonts/name.

Do not change SQL, providers, eligibility, fixture state formats, native modules or manifests solely for this UI refinement. Internal native-prefixed browser class/token names are compatibility names, not the current product name. --native-sienna is #8A3324 and --native-terracotta is its alias.

## Running and verifying

From the extracted repository root, install the committed dependencies with npm ci when needed. The existing environment used Node 24/npm 11 and Deno for Edge typechecking. Run:

    node scripts/build-claude-demo.mjs
    node tests/native-midnight-ui.mjs
    node tests/claude-browser-demo.mjs
    node tests/claude-prototype-ui.mjs
    EXPO_NO_TELEMETRY=1 DENO_DIR=/tmp/free-midnight-deno-cache npm run check

The reviewed environment ran the last command with DENO_DIR=/workspace/.deno-cache. Use a writable cache path in your own environment; do not change app files just to work around cache/telemetry permissions.

The full browser check covers questionnaires, edits, matching/messages, failed-storage retry, legacy profiles, reset and offline persistence. The design check covers actual colors/contrast, both loaded fonts, new brand/copy, bold headings and 320×667/390×844/768×844/1280×900 layouts. Source-prototype checks cover safety/planner/profile/Review navigation. All 36 repository tests, typing/lint, Edge typecheck and admin build passed. Independent A6 accepted the implementation and independently reran design/full-browser checks with evidence hashes unchanged.

Open prototype/web-mvp1/demo-standalone.html in a desktop browser for the complete interactive simulation. All assets are embedded. Like Malik → Say Hello → send a message; Demo controls → Simulate a reply adds a labeled fixture reply. Demo controls → Start a new demo profile opens Welcome; Join Free Midnight continues through existing onboarding. Use Review for simulated approval. Reset demo restores fixtures. Use invented details only.

## First next step

Review the supplied three-screen screenshots and existing source. Confirm the founder's approval status before extending visual changes or publishing source. Continue the existing application using the locked current decisions; do not restart/rebuild it. Deliver concrete screenshots and tests for the next approved slice, with an independent review of a fixed candidate per AGENTS.md.
