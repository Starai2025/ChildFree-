# FREE MIDNIGHT · typography, identity and burnt sienna

The founder refined the first Midnight Luxe checkpoint: make the fonts easier to read and bolder, replace the orange-looking accent with true burnt sienna, and rename the app **FREE MIDNIGHT** using the supplied gold/emerald crescent-heart emblem. These instructions supersede the previous Native name, Cormorant typography and `#C56445` primary accent. Other locked colors and the staged approval gate remain in force.

## Implemented review slice

Welcome, Discover and Match use bundled **DM Sans** for clear interface text, with **Lora Bold** for the welcome and match headlines. The new wordmark uses bold uppercase DM Sans beside a transparent version prepared from the supplied emblem. Welcome uses the exact requested copy:

> The Only Thing We're Raising
>
> Is the Bar.
>
> Black Singles. No Children. Not Ever.

The main CTA is “Join Free Midnight” and still opens the existing eligibility flow. Page titles, the fallback header name on other routes, and the existing invitation text use FREE MIDNIGHT. The invitation action itself is unchanged; no external invitation was sent.

Font improvements include body weight 500, wordmark weight 800, headlines and primary actions weight 700, larger profile metadata, 12px medium/bold badges and supporting labels, and heavier navigation/control labels. Prompts and compatibility headings use the readable sans-serif. Responsive spacing and photograph height accommodate larger text; short Discover layouts omit the redundant Atlanta introduction under the heading while keeping the profile's location and all actual filters/actions. Short Match dialogs remain scrollable.

**Burnt sienna:** this draft uses the deep pigment tone `#8A3324`. The first commentary mentioned the web swatch `#E97451`; that still has a bright orange cast, so the darker pigment interpretation was stated before implementation. The new `--native-sienna` token is canonical; `--native-terracotta` remains an internal compatibility alias. Obsidian `#111111`, emerald `#0F5C4D`, gold `#C89A2B` and ivory `#F6F0E8` are unchanged. All primary and Like labels use ivory on the darker sienna, with normal-text contrast verified at ≥4.5:1.

The uploaded emblem's metallic image tones are preserved as an image asset; surrounding interface colors use the exact tokens. `preview-assets/free-midnight-emblem.png` is an image-generation edit that removes the supplied black background and prepares transparency. The original supplied image remains in the conversation. The original fictional couple/Amara/Malik photographs are unchanged. No reference photograph or font was extracted.

## Implementation and boundaries

- Source: `prototype/web-mvp1/index.html`; existing presentation classes/helper names retain the `native` prefix internally for compatibility.
- Builder: `scripts/build-claude-demo.mjs`; offline HTML embeds both fonts, their complete SIL OFL licenses, the emblem and photographs. Only Amara/Malik assets enter the fixture adapter; the hero/emblem globals are captured and deleted by the source presentation code.
- Assets: `Lora.ttf`, `DMSans.ttf`, their `*-OFL.txt` licenses and `free-midnight-emblem.png` in `preview-assets`. Fonts come from the upstream `google/fonts` Lora and DM Sans directories, under SIL OFL.
- Current actual screenshots: `docs/evidence/native-midnight/{welcome,discover,match,three-screens}.png` and the self-contained screenshot gallery `screens.html`.

Eligibility, pledge, questionnaires, saved draft formats, fixture keys, candidate/filter rules, matching, conversations, safety actions, simulated approval and provider isolation remain unchanged. No Expo, SQL, provider, manifest or lockfile changes. Beyond the name-only branding changes, the other application screens await the founder's visual approval.

## Validation

```sh
node scripts/build-claude-demo.mjs
node tests/native-midnight-ui.mjs
node tests/claude-browser-demo.mjs
node tests/claude-prototype-ui.mjs
EXPO_NO_TELEMETRY=1 DENO_DIR=/workspace/.deno-cache npm run check
```

The design check passes at 320×667, 390×844, 768×844 and 1280×900; it checks computed colors/contrast, loaded bundled fonts, bold heading weight, the new brand/copy, visible profile identity, reachable CTAs, eligibility and mutual-match chat navigation. It records zero external requests. Full browser regression passes onboarding with all ten optional questions, editing, persistence, failed-storage retry, legacy profiles, matching, messages and reset. The source walkthrough also covers filters, safety, date planning, profile and Review. All 36 repository tests, typecheck/lint, Edge typecheck and admin build pass.

Independent review and isolated artifact-only preview delivery follow the same contract as the previous checkpoint. Main source must not be pushed until the founder reviews the full demo, and remaining screens must not be redesigned before screenshot approval. The earlier Native preview URL remains an immutable historical version.
