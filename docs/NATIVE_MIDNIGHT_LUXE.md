# Native Dating · Midnight Luxe · first visual checkpoint

The founder's attached Midnight Luxe board is now the authoritative design reference. It supersedes the orange Figma direction and the three-direction exploration in the previous plan. This is a browser-prototype presentation change, not an Expo rebuild or production release.

## Scope and approval gate

Implemented locally: **Welcome, Discover and the mutual Match dialog**. All other application screens retain their existing design pending founder approval of these three screenshots. Read `AGENTS.md` before continuing. One source writer owns this slice; A6 reviews a fixed commit read-only.

Source: `prototype/web-mvp1/index.html`. Generated interactive copies: `demo.html` and `demo-standalone.html`, built by `scripts/build-claude-demo.mjs`. Existing local demo storage, fixtures, approval labels and provider isolation are preserved. Eligibility, pledge, optional ten-question onboarding/editing, filters, candidate ranking, mutual-match conditions, reaction handlers, conversations, report/block actions and persistence have not been changed for the redesign. The source retains its original Claude runtime; only generated demo copies include the local adapter.

Public main remains unchanged. Only the already-authorized isolated, artifact-only preview delivery may be published before full demo review. Source implementation must not be pushed to main without the founder's approval.

## Reusable system

| Token | Locked value | Role |
| --- | --- | --- |
| `--native-obsidian` | `#111111` | Welcome, demo notice, pass control, dark type |
| `--native-emerald` | `#0F5C4D` | Match background, factual childfree badge |
| `--native-gold` | `#C89A2B` | Logo heart, selective accents |
| `--native-ivory` | `#F6F0E8` | Discovery canvas, light type |
| `--native-terracotta` | `#C56445` | Pill CTAs and like control |

No replacement hues were introduced. Overlays, borders and shadows use transparency of the locked colors. Match uses a gradient between the exact emerald and obsidian tokens. The approved-screen palette is scoped by route/component so later screens are not redesigned prematurely.

Reusable `nativeLogo()`, `nativePrimary()` and `nativeBadge()` helpers generate the same serif wordmark with gold heart, terracotta pill with SVG arrow, and soft rounded factual badges. The existing reusable profile card keeps its photos, photo navigation, prompt likes and compatibility details; Discover displays identity below its edge-to-edge photograph. `.native-circle`, shared corner/spacing/shadow tokens and the original reaction handlers keep matching controls consistent. Demo-specific viewport inset is a token, not a business rule.

Primary pill labels use 20px bold ivory type for large-text contrast with the locked terracotta. Discover's terracotta heading uses 19px bold type for the same contrast threshold. The smaller Like label uses obsidian; emerald badges use ivory. Keyboard focus uses gold. Reduced-motion preferences and existing screen-reader labels remain supported. Short match dialogs scroll safely without clipping their heading.

## Original assets

- `preview-assets/synthetic-native-couple.png`: newly generated fictional Black adults, approximately 42 and 50; original concept photography, not a crop of the reference or real members. Existing fictional Amara/Malik portraits remain unchanged.
- `preview-assets/CormorantGaramond.ttf`: independently sourced Cormorant Garamond variable serif from `google/fonts`, under SIL OFL. Full license is in `CormorantGaramond-OFL.txt` and is embedded in the standalone HTML. No font was extracted from the reference.
- Standalone HTML embeds all photographs and the serif. No external font, image or provider request is required. Existing demo controls allow trying onboarding, simulated approval and conversations.

## Review artifacts and validation

`docs/evidence/native-midnight/three-screens.png` shows actual browser renders side by side. Individual `welcome.png`, `discover.png` and `match.png`, plus the self-contained screenshot gallery `screens.html`, are in the same directory. These are working-app captures, not generated UI mockups.

Commands run:

```sh
node scripts/build-claude-demo.mjs
node tests/native-midnight-ui.mjs
node tests/claude-browser-demo.mjs
node tests/claude-prototype-ui.mjs
EXPO_NO_TELEMETRY=1 DENO_DIR=/workspace/.deno-cache npm run check
```

The design check verifies actual computed brand colors, the bundled serif, layouts at 320×667, 390×844, 768×844 and 1280×900, visible profile identity and reachable actions, eligibility navigation and mutual-match chat navigation. Full browser regression covers ten-question draft/resume/submit/edit/skip, storage failures/retry, legacy profiles, matching, messages, offline persistence and reset. The source-prototype walkthrough also checks safety, date planning, profile and Review navigation. Generated standalone checks record zero external requests. All 36 repository tests, typing/lint, Edge typecheck and admin build pass.

Initial `npm run check` encountered Expo telemetry attempting to write outside the workspace; the documented `EXPO_NO_TELEMETRY=1` invocation passes. Actual native runtime and hosted providers are outside this browser presentation slice and are not validated by these screenshots.

Next: independent review of the fixed local candidate, then founder approval of these three screens before extending Midnight Luxe to onboarding, profile, messages, dates or other screens.
