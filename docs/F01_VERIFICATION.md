# F01 verification evidence

Source reviewed and clean-installed: commit 65198c8a7054d784402dfcb9f93db786a8670623. Evidence recorded 6 October 2026. Subsequent evidence-document commits do not change application code or dependency manifests.

## Passed

| Check | Result |
|---|---|
| npm install from pinned manifests | Passed after resolving React type version alignment |
| Clean checkout: git clone --local + npm ci --offline --ignore-scripts=false | Passed; 817 packages installed from root committed lockfile |
| npm run typecheck in clean checkout | Passed for both workspaces |
| CI=1 npm run lint in clean checkout | Passed for both workspaces |
| npm run build:admin in clean checkout | Passed; Vite emitted HTML, CSS and JS |
| CI=1 npx expo install --check in apps/mobile | Passed; dependencies up to date |
| CI=1 npm run export:mobile:native | Passed; iOS and Android JavaScript/Hermes bundles emitted |
| CI=1 npm run export:mobile:web | Passed; static root, sitemap and not-found routes emitted |
| Admin HTTP startup smoke | Passed; Vite launched as a child process; HTML and transformed main.tsx both returned HTTP 200 with expected shell text |

The clean checkout verifies the committed dependency state, not only an existing node_modules directory. No legacy-peer-deps or force overrides were used.

## Not verified / unavailable

- Native device/emulator launch: no Android SDK/emulator/adb or Xcode/xcrun is available in this execution environment. F01 native runtime evidence remains blocked. F03 signed/development-build and auth-redirect gates are not complete.
- Browser interaction/hydration/layout: attempted Playwright launch was unavailable because its browser executable is not installed. The HTTP smoke does not establish browser visual correctness.
- Claude Code execution: Claude CLI is not installed here. Codex created the project and its instructions; no Claude session was opened on Starr's computer.
- External auth, identity, chat, database, admin permissions, CI and environment validation: not implemented, as excluded from F01.

## Repairs completed during verification

1. Aligned @types/react-dom with @types/react; retained Expo-compatible React type versions.
2. Added Vite's client type declarations for CSS imports.
3. Corrected the admin ESLint ESM config import to its explicit .js entrypoint.
4. Updated react-native-web and @types/react to Expo's expected compatible versions.
5. Removed the generated template's nested git repository from the working project and tracked native source in the shared repository. No submodule is required.
6. Committed the root lockfile required by npm ci.

## Dependency provenance

Mobile base: official create-expo-app default SDK 57 template, reduced to the foundation routes. Its MIT notice is retained. Core versions: Expo 57.0.27, React Native 0.86.3, React 19.2.3, Expo Router 57.0.25, TypeScript 6.0.3; admin uses Vite 8.3.3. Full direct/transitive versions are in package-lock.json.

Official compatibility sources consulted: https://docs.expo.dev/versions/v57.0.0/, https://docs.expo.dev/router/installation/, https://docs.expo.dev/guides/monorepos/, https://vite.dev/guide/.

Install output includes upstream deprecation notices for the selected Expo-compatible development ESLint version and a transitive uuid package. Evaluate supported tooling upgrades in F02 with actual compatibility checks; do not bypass dependency validation. This foundation is not a security-audited production release.

## Review and gate

Independent A6 review applies to the fixed source commit above. Record its outcome in BUILD_STATUS.md. Source review can accept the scaffold while native runtime evidence remains blocked; that does not permit calling all F01/F03 gates complete.
