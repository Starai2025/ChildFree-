# Claude prototype visual redesign

User-selected target: the imported Claude web prototype, October 7, 2026. Preserve the Expo MVP1 implementation. Reference: the supplied LOML Figma screenshot and community URL. Figma tools were absent from the session and the community URL returned a proxy 403; no editable nodes, Figma assets or plugin output were used.

## What changed

- A white/orange mobile interface, modern sans typography, rounded inputs and compact chips.
- Orange headers with accessible icon labels, photo-overlay name/age/location and fixed Like/Pass actions above the navigation.
- Icon navigation, avatar lists, consistent conversation bubbles and a compact attachment/message/send composer.
- Matching styles for onboarding, filters, profile, safety, review, mutual-match celebration and the existing date planner.
- A browser-openable static design preview with eleven screens, visibly labeled synthetic. Portraits were generated for invented adult fixtures; they are confined to preview assets and test data. The working prototype continues to use members' uploaded photos.

The source remains a single-file Claude-runtime app. The identity checks, approval, matching, chat/storage APIs and data action handlers retain their existing behavior. Imported kickoff instructions were not executed. Expo, dependencies, lockfile, SQL and real provider code are unchanged.

## How to view or apply

Open `prototype/web-mvp1/design-preview.html` in a browser. This file embeds its portraits and screen snapshots, works offline and requires no account. Its top buttons switch snapshots; it is not a local clone of Claude's live services.

For the actual runtime app, replace the existing Claude artifact's HTML with `prototype/web-mvp1/index.html` in Claude. The hosted artifact URL is separate from GitHub and has not been updated by this task.

## Evidence

`node tests/claude-prototype-ui.mjs` passes using an in-memory adapter injected into the test page only. It verifies welcome/eligibility errors, discovery, mutual match, text send/reply, safety and planner controls, matches/profile/review, 320/390/768px layouts, visible profile identity above reaction controls, and standalone-preview switching without Claude APIs. It generates the preview and screenshots under `docs/evidence/claude-redesign`.

The actual HTML and generated preview inline scripts pass `node --check`. `npm run check` passes typecheck/lint, all 32 tests, Edge typecheck and the admin build. Preview fixtures are absent from the working `index.html`. Screenshot inspection repaired profile identity being hidden by the fixed reaction controls; both layouts and the standalone preview were checked after that repair. White-on-orange primary text uses `#CB4708` (approximately 4.73:1 against white); this is not a complete accessibility audit.

The local browser cannot validate actual Claude authentication, shared database access, realtime rooms or hosted artifact behavior. Independent read-only A6 review accepted implementation commit `4bb0f7f9fb9bc1c4f5a13dffe4376abe7005d616` after separately rerunning the synthetic browser workflow and inspecting Discover/chat screenshots. No material findings were reported. Exact comparisons also confirm the original action-handler, Claude-startup and derived eligibility/filter/matching blocks are unchanged.
