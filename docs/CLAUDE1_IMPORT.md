# Additional Claude prototype package

Imported October 7, 2026 from the user-supplied `BlackChildfreeAppclaude1.zip`, with authorization to add its prototype/documents to GitHub while keeping the existing MVP1 demo.

ZIP SHA-256: `3bef01d3a8e1515f52ff2e13b66a4c87c157fe04ba07a704ea2a683eecb0147d`.

## Imported files

These four additions were byte-for-byte copies of the uploaded files at import commit `23e5672`. The prototype HTML and its README have since been redesigned at the user's request; their original bytes remain in Git history:

- [Claude Code kickoff](../START_HERE_CLAUDE_CODE.md)
- [Supplied decision document](DECISIONS_2026-10-07.md)
- [Prototype README](../prototype/web-mvp1/README.md)
- [Claude web prototype](../prototype/web-mvp1/index.html)

The upload also changes two documents relative to the original onboarding foundation. Their supplied versions are preserved exactly at [imported build status](imports/claude1/BUILD_STATUS.md) and [imported Claude instructions](imports/claude1/CLAUDE.md). The current root build status and agent entrypoints continue to describe the tested Expo demo; they were not replaced with the older onboarding checkpoint.

## Scope and runtime

The remaining 59 uploaded project files match the original foundation. They were not copied over the newer implementation. No archive `.git` metadata was imported. Expo source, manifests, lockfile, live API/SQL, existing tests, assets and screenshots remain intact.

The prototype is a separate reference artifact, not an Expo route or a deployed website. Its JavaScript explicitly requires Claude's `window.claude.use` database/user/room APIs. Outside that runtime, it displays an instruction to open it in Claude. Its sign-in, shared storage and chat behavior have not been verified here.

The supplied documents describe changes to the future live beta, including Supabase Realtime chat and manual review, and list features beyond the existing demo's scope. This import preserves those documents as supplied; it does not execute their kickoff instructions, change the running demo, replace providers, deploy Supabase, enable a beta, or mark the prototype's claimed capabilities as tested.

## Verification

All six copied files were checked against the ZIP bytes. The standalone inline JavaScript passes `node --check`. `npm run check` passes workspace typecheck/lint, all 32 tests, Edge typecheck and the admin build. Independent read-only A6 review accepted import commit `23e5672e99c287e4d69dc1093ec6b4af931cefe9`, separately confirming file fidelity, scope and preservation of the existing app. Syntax validation does not prove Claude-runtime functionality.
