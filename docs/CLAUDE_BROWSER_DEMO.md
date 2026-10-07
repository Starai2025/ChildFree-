# Interactive browser delivery

The user could not see the redesigned app through a repository/file link. The Claude source still required Claude's runtime, and the earlier design preview only switched static screenshots. This change makes the same redesigned interface usable as an isolated browser demo, with clearly labeled synthetic data and no sign-in.

## Open the app

- [Browser demo](https://raw.githack.com/Starai2025/ChildFree-/main/prototype/web-mvp1/demo.html): hosted HTML with relative portrait assets from the public GitHub repository.
- [Downloadable offline app](https://github.com/Starai2025/ChildFree-/raw/refs/heads/main/prototype/web-mvp1/demo-standalone.html): download, then open in a desktop browser. All images and code are embedded. Browser storage is needed to save actions; progress belongs to that browser/file origin.

Like Malik, open the mutual-match conversation, and send a message. **Demo controls → Simulate a reply** adds an explicitly simulated reply. **Start a new demo profile** resets the fixtures for eligibility, pledge and profile entry; two fictional portrait presets are supplied. Submit, skip optional passions, and use **Review** to approve the synthetic profile. **Reset demo** restores the original fixtures after confirmation.

## Implementation boundary

`scripts/build-claude-demo.mjs` derives both demo files from the unchanged Claude `index.html`. It adds demo notices, removes external fonts, supplies generated fictional adult portraits, and injects `local-demo-runtime.js` only into the demo copies. The local adapter supports the original document/subscription API shape, saves synthetic documents under `blackchildfree.claude-browser-demo.v1`, and simulates the current viewer, owner controls and room presence. These are compatibility fixtures, not real authentication, shared rooms, authorization or provider substitutes for live members. Approval and replies are visibly simulated. No actual verification occurs.

Preset images are deduplicated in persisted state as portrait references; the standalone file embeds each original image once. Local storage is written before in-memory mutations are accepted. Corrupt/unsupported saved data loads fresh fixtures with a visible notice; failed writes report an error. Real user information must not be entered. Reset clears this demo's fixture state only.

Original Claude source, hosted Claude artifact, Expo app, SQL, dependencies and real provider code are unchanged. The imported prototype's optional planner/admin features remain local simulations rather than newly authorized live services.

## Verification and access limits

- `node scripts/build-claude-demo.mjs` generates both deliverables.
- `node tests/claude-browser-demo.mjs` tests the shipped copies without injected mocks: 320/390/768px discovery layouts and visible identity, mutual matching, sending, simulated reply, saved messages after reload, deduplicated photos, full eligibility/pledge/profile submission, simulated approval, saved profile, reset, embedded portraits and direct `file://` opening with offline message persistence. No page errors or external provider requests were observed.
- Discover/chat screenshots were inspected under `docs/evidence/claude-browser-demo`.
- `npm run check` passes typecheck/lint, all 32 tests, Edge typecheck and admin build. No mobile code changed; native exports were not rerun for this browser-only delivery.
- Inline scripts and source scripts pass `node --check`; `git diff --check` passes.

The GitHub repository is public. The CDN serves a public GitHub copy and is not a managed production deployment. This workspace's proxy returns CONNECT 403 for the CDN domain, so remote rendering/availability cannot be asserted from local test results. The direct GitHub download is the fallback. No real-member hosting, production launch, provider connection or paid plan was enabled.

Independent A6 review is recorded after review of a fixed implementation commit.
