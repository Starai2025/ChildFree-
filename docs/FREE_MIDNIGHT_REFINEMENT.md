# FREE MIDNIGHT · typography, identity and burnt sienna

## v2 polish (October 8, 2026) — approved by the founder the same day

Founder feedback: logo placement was off, type was hard to read, the app looked basic. Scope stays Welcome, Discover and Match; other screens are untouched until sign-off. Same five hues.

- **Emblem:** `free-midnight-emblem.png` is now a cleaned 288px version (solid body, halo removed, trimmed to the mark; 89 KB instead of 1.4 MB). The supplied file is kept as `free-midnight-emblem-source.png`.
- **Lockup:** one-line `FREE MIDNIGHT` wordmark (DM Sans 800, 0.18em tracking). "Row" arrangement (emblem beside the name) top-left on Welcome and in the Discover header; "stack" arrangement (emblem above) on Match. The emblem never sits over a face.
- **Type scale:** 12 / 14 / 16 / 18 / 22 / 28 / 32+ px. 12px is used only for short uppercase labels; body copy is 14px or larger. Lora Bold for the Welcome and Match headlines, DM Sans for everything else.
- **Colour use:** secondary text is obsidian at 72% (≈7:1 on ivory); dark-screen secondary text is ivory at 80%. Sienna is reserved for primary actions, gold for accents and labels, and emerald for "childfree by choice", shared items and the active tab.
- **Discover:** name, age, location and badges sit on the photo over a dark fade. "Today's top pick" is a gold chip at the photo's top-left, and its reasons appear in a "Why {name}" note. The repeated city/gender line is gone. Shared-life answers are a checked list, and Pass/Like float over an ivory fade so they never cover readable text.
- **Match:** emblem, photos, headline, then a "What you share" section with a single Say Hello action.
- **Demo bar:** text raised from 8px/10px to 10px/12px.

Checks: the design, full-browser and prototype tests all passed against local Chrome on Windows, at 320×667, 390×844, 768×844 and 1280×900 layouts.

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

## Reviewed delivery

A6 independently accepted source commit `a5cf8314bdc301c94cbd36854829530c40d68c4f` against `fbc5842`, with no material findings. Its design and full-browser checks passed with evidence/generated hashes unchanged.

Only `prototype/web-mvp1/free-midnight-preview.html` was added on `preview/free-midnight-a5cf831`, commit `b7b0367fe6f52eb9755d0616fe1e5f25af6c660a`. The parent is public main `637ceb3518705cdb29c373481908e333809e2d72`; the branch diff is exactly that one HTML file. Main was verified unchanged after the push. No unpublished source commits were pushed to main.

[Interactive review demo](https://raw.githack.com/Starai2025/ChildFree-/b7b0367fe6f52eb9755d0616fe1e5f25af6c660a/prototype/web-mvp1/free-midnight-preview.html). Public GitHub raw returns the exact reviewed bytes; this environment blocks CDN access, so CDN browser rendering is unverified here. The actual app was tested locally, including the standalone/offline copy.

`/workspace/exports/Free-Midnight-demo.html` and `Free-Midnight-demo.zip` contain the reviewed HTML; the ZIP includes a walkthrough and both font licenses. Size12,115,580 bytes; SHA-256 `e38c2602d84f537afd95227bf990e4cbbde354f7c60aa7346197210343d611df`. The `free-midnight-review.json` manifest records source/preview commits, public-byte verification and pending visual approval.

## v2 rollout: Matches, Dates and Profile tabs (October 8, 2026) — awaiting founder sign-off

The tab screens now use the approved v2 system: ivory page, the same header lockup, DM Sans headings, emerald section labels, and the emerald active-tab marker. Routes drawn with v2 are listed in the `MIDNIGHT` constant and flagged on `<body data-midnight>`; every other screen keeps the legacy look until it is approved.

- **Matches:** gold-ringed avatars (sienna for "Likes you"), roomier conversation rows, and a branded empty state.
- **Dates:** date rows become ivory cards. Status pills replace off-palette inline colours: "Your turn" is sienna, "Proposing" is neutral and "Locked" is emerald. Events are cards too, and both empty states are branded.
- **Profile:** a "Live" status pill sits beside the title, and the photo card matches Discover. The single primary action is "Edit profile", other edits are chevron rows, "Invite a friend" is a gold outline, and "Delete my account" is a sienna outline.
- The "Likes you" profile view uses the Discover card.

Evidence: `docs/evidence/midnight-tabs/`. The design, full-browser and prototype tests pass.

### Founder feedback and rework: Matches and Profile (October 8, 2026)

The founder judged the first tab pass well below the quality of Welcome, Discover and Match: flat ivory pages, small circular photos and plain headings. We agreed to redesign two screens at a time.

Matches and Profile now borrow the approved screens' visual language:
- **Hero:** a dark emerald-to-obsidian hero under a dark header, with a gold eyebrow, a Lora headline and gold-outlined stat pills.
- **Sheet:** an ivory sheet with rounded top corners rises over the hero.
- **Matches:** large portrait photo tiles ("Liked you" in sienna, "New" in gold), conversation rows in a raised card with gold-ringed avatars, and a dark feature card with a Keep exploring action for empty or quiet states.
- **Profile:** the photo card overlaps the hero. Detail and setting rows sit in raised cards with gold-tinted icons, and "Invite a friend" is a dark feature card.

Dates still has the interim flat styling and is the next screen to redesign.

### Founder feedback: "too many logos, too much going on" (October 8, 2026)

New rule: **one logo per screen.** The emblem appears only in the header lockup (or the stacked lockup on Match), never inside cards or empty states.

What changed:
- Matches: the hero is now just the title and one line. The eyebrow label and stat pills are gone.
- The dark "Room for more" and "No matches yet" feature cards are removed. A quiet note or a plain empty state replaces them.
- "Invite a friend" is now a row in Profile details.
- Row icons are plain emerald line icons without tinted boxes.

## v2 everywhere (October 8, 2026)

At the founder's request ("finish the rest"), every screen now uses Midnight Luxe v2. `body[data-midnight]` is always set, and the legacy orange/white/Inter look no longer renders.

Shared components restyled once and used everywhere:
- **Controls:** pill buttons (sienna primary, outlined secondary, sienna-outline danger, emerald text links). Form fields are 52px with 16px text and an emerald focus ring. Yes/No toggles and interest pills turn emerald when selected.
- **Overlays and notices:** ivory pop-up sheets, an obsidian toast, emerald announcements, and a gold-topped review notice with a Lora headline.
- **Chat:** an obsidian header with a gold-ringed avatar, sienna bubbles for you and soft neutral bubbles for them, and a rounded composer.
- **Date planner:** a full-screen dark emerald/obsidian moment like Match, with emerald-and-gold selected chips.
- **Dates and Events:** the same dark hero and ivory sheet as Matches and Profile.

One logo per screen still holds: the header lockup only. Screenshots of every screen are in `docs/evidence/midnight-tour/`, `claude-redesign/` and `compatibility/`. The design, full-browser and prototype tests all pass.

## Pristine pass, step 1: foundations (October 8, 2026), awaiting founder sign-off

Following the UI/UX audit, with founder decisions on the demo controls, the shared dark header and step-by-step onboarding:

- **Demo controls:** a small gold-dot "Demo" pill (top right) replaces the black demo bar. Its menu holds Simulate a reply, Review queue (team view), Start a new demo profile and Reset. Reset and new profile ask for confirmation inside the menu, not with a browser pop-up.
- **Content wording:** "synthetic member", "fictional venue" and "Simulated reply:" are gone from screens. The only disclaimer is on Welcome and in the menu.
- **Tabs:** members see four tabs (Discover, Matches, Dates, Profile). The team reaches Review from Profile → Settings → Review queue.
- **Headers and titles:** all four tabs share the dark header and emerald hero. Discover uses a compact hero, and every page title is Lora.
- **Discover end of day:** "That's everyone for today" is now a designed moment with one primary action (See your matches) and an Edit filters link.
- **Leftover styles:** off-palette inline colours in date-plan and admin templates are replaced by palette tokens.

Still to come, two screens at a time: Discover + Matches, Chat + Dates, Profile + Review, onboarding steps, settings screens, and the desktop frame. The remaining AI portraits wait for the free Hugging Face allowance.

## Pristine pass, step 2: Discover + Matches (October 8, 2026), awaiting founder sign-off

- **Discover:** Pass and Like sit on a short fade into a solid ivory band, so the card's text never ghosts underneath them.
- **No duplicates:** someone already waiting in today's Discover (e.g. Marcus, who likes you) appears there with their "likes you" note. They are no longer repeated under Matches → Likes you.
- **Matches tiles:** "Likes you" and "New matches" use the same horizontal photo strip and tile size. The tag is sienna for "Liked you" and gold for "New". Tile shadows are no longer clipped into a box.

## Pristine pass, step 3: Chat + Dates (October 8, 2026), awaiting founder sign-off

- **Chat:**
  - A locked date shows once, in the emerald pinned bar; its Details button opens or closes the full card.
  - A small "TODAY · 12:12 PM" header starts the conversation and follows any pause of an hour or more, instead of a time under every bubble.
- **Dates:**
  - Every date and time uses one format, "Sat, Oct 10 · 11:00 AM", with venue and time on separate lines.
  - The event "I'm going" action is a quiet emerald outline, so it no longer competes with the date rows.

## Pristine pass, step 4: Profile + in review (October 8, 2026), awaiting founder sign-off

- **Profile card:** a compact card (photo, then name, location and badges on ivory) overlaps the hero. Below it are a full-width "Edit profile" button and a "Preview my profile" link.
- **Preview sheet:** the link opens the full public card ("How members see you") in a sheet, so settings are reached without scrolling past every prompt and answer.
- **In review:** Discover's "Your profile is in review" is now a calm, centred moment (gold rule, Lora headline, one line) with "Preview my profile".
