# Black Childfree: product and UI improvement plan

Revised after the founder's design consultation. Target: the imported Claude web prototype and its separate browser-demo copies. This replaces the earlier screen-cleanup plan. The three visual directions remain proposed. The ten-question compatibility collection and profile comparison now exist as a local review candidate; see [implementation and evidence](COMPATIBILITY_QUESTIONS.md). The user requires trying the full demo before any push.

## Confirmed brief

- **Memorable promise:** “These people want the same kind of life I do.”
- **First cohort:** Black adults aged 25–70 who enthusiastically do not want children, seek compatible lifestyles, and want matches to become actual dates.
- **Visual direction:** explore three distinct directions before choosing. Orange is an option, not a fixed requirement.
- **Existing launch context:** Atlanta and committed relationships remain the working assumptions from the earlier brief.
- **Product continuity:** the cohort focus does not change the existing 18+ membership contract. Eligibility, inclusive partner preferences, free mutual-match messaging and safety remain foundational.
- **Consultation preference:** ask the founder one question at a time; make recommendations for routine decisions.

## Lifestyle dimensions

The founder requested faith and spending habits and delegated the remaining choice. Start with **faith/worldview, spending priorities, and everyday lifestyle pace**. These are hypotheses to evaluate with members, not proven predictors of relationship success.

| Dimension | What to learn | Member benefit |
| --- | --- | --- |
| Faith and worldview | The role faith or spirituality plays in everyday life, and whether sharing a tradition matters. Include religious, spiritual and nonreligious answers. | Recognize important alignment without assuming matching labels mean matching practices. |
| Spending priorities | How someone balances saving, experiences and everyday treats; their preferred first-date cost range. Collect preferences, not financial account details. | Discuss expectations and suggest comfortable dates. |
| Everyday lifestyle pace | Quiet versus social time, home time versus outings, and a typical weekend. Travel and fitness can be supporting interests. | Picture an ordinary week together and find an enjoyable first activity. |

Members choose the importance of each dimension: **essential, nice to share, or flexible**. Answers can be optional, editable and explicitly shared on the profile. Unanswered fields do not count as agreement or disagreement. Keep faith identity separate from its importance. Spending preferences do not establish income or financial worth.

Begin with short self-described answers and transparent profile summaries. Ranking or exclusions based on new fields require separately defined behavior and tests; a styling pass must not silently alter matching.

## Useful design-consultation principles

Reference: [gstack design-consultation/SKILL.md](https://github.com/Starai2025/gstack/blob/main/design-consultation/SKILL.md). Reviewed as a reference document; its setup, telemetry and repository-modification instructions were not invoked.

1. Use the memorable promise to guide copy, imagery, profile hierarchy and interactions.
2. Research familiar dating-app patterns and opportunities for this audience. Document observations rather than inventing competitor findings.
3. Keep navigation, readable controls and safety familiar; differentiate through typography, portraits and shared-life content.
4. Compare realistic screens before implementation, using identical content for useful visual feedback.
5. Record the chosen system and decisions in DESIGN.md so browser and Expo work follows consistent guidance.
6. Explain choices through member outcomes. Treat font bans and time-compression estimates as opinions rather than universal rules or delivery evidence.

## Phase 1: three visual directions

Produce three Discover mockups with identical synthetic profile content and clearly labeled fictional adults. Vary composition, typography and color enough to provide meaningful choices. Show a usable member screen at phone size, including profile content and actions.

| Proposed direction | Visual character | Typography candidates | Reason to explore |
| --- | --- | --- | --- |
| Warm editorial | Warm white, terracotta, expressive headings, natural portraits and prominent profile quotes. | Fraunces headings; DM Sans body/UI. | An intentional relationship experience that feels personal and welcoming. |
| Bold contemporary | Deep ink surfaces, vivid lime accent, strong type and crisp composition. | Cabinet Grotesk headings; Source Sans 3 body/UI. | A recognizable identity with familiar controls. |
| Quiet refined | Soft ivory, deep blue, restrained accents and spacious, clear profiles. | Instrument Serif for selected headings; Instrument Sans body/UI. | A calm, confident experience across the broad age range. |

These are proposals, not chosen fonts or palettes. Evaluate licensing/loading, readability and contrast before implementation. Portrait subjects and treatment should represent varied Black adults across the cohort's ages and life stages; synthetic portraits remain labeled in demos.

Present the mockups directly in chat for reliable viewing, plus a comparison page when remotely accessible. Record the chosen direction and feedback, then apply it to onboarding, full profile and chat mockups. Finish DESIGN.md with exact styles and screen references after selection.

## Phase 2: the connected member journey

| Area | Planned experience | Acceptance |
| --- | --- | --- |
| Welcome | Positive vision of a shared childfree life, plain eligibility explanation and one clear next action. | Purpose and next step understandable without coaching. |
| Onboarding | Short steps, progress, saved answers, inline errors, lifestyle questions with importance choices and final profile preview. | Back/resume preserves answers; optional questions skippable; eligibility and pledge requirements intact. |
| Discover | Compact header, visible name/age/location, substantial photo, concise shared-life summary and prompt preview. Clear Like/Pass and full-profile access. | Summary reflects actual answers; content reachable; fixed controls do not obscure it. |
| Matches/chat | Clear mutual-match moment, readable list, helpful context and optional starters based on shared answers. | Members choose what to send; starter editable; report/block/unmatch reachable. |
| Dates | Existing planner easy to find when available; clear activity, cost expectations, time and accept/counter actions. | Invitations fit stated preferences; existing availability rules remain until a separately agreed behavior change. |
| Profile/settings | Readable preview, editable priorities, grouped settings and honest pending/empty/error states. | Changes understandable; simulated review accessible through demo controls and pending-profile screen. |

Member navigation: Discover, Matches, Dates and Profile. Keep synthetic-data labeling visible. Design for 25–70 with readable type, understandable language and comfortable controls, without assuming age determines taste or interests.

## Phase 3: implementation slices

1. Build selected shared styles and Discover/full-profile flow using current data; regenerate and verify both browser-demo copies.
2. Implement stepped onboarding and draft handling. Add lifestyle fields with validation and migration for existing demo state.
3. Implement summaries and optional starters using explicitly shared answers. Define proposed ranking/filter changes separately.
4. Connect date-planning presentation to existing behavior and finish supporting states/settings.
5. Carry the selected system into Expo in a later scoped slice after the browser direction is agreed.

Preserve the original runtime boundary and synthetic-demo isolation. Independently review each fixed implementation commit as required by AGENTS.md. Claude HTML changes require regenerating both browser-demo copies.

Timebox a two-hour session around visual exploration or one implementation slice. Completion of all phases depends on selected designs, behavior changes and verification; it is not promised within that timebox.

## Evidence and outcomes

- Inspect 320/390/768px layouts, a short phone viewport, keyboard behavior, enlarged text and safe areas.
- Target 16–18px body text, readable supporting/navigation labels, 44px primary tap targets, WCAG AA text contrast, visible focus and reduced-motion support.
- Exercise changed eligibility, pledge, draft/resume, submission/review, matching, chat, safety and planner paths. Verify reload persistence and migration from current demo state.
- Run applicable repository checks and independent review before publishing implementation. Confirm preview access where possible; distinguish local checks from remote-hosting evidence.
- In prototype feedback, observe whether people can explain the promise, compare lifestyles, finish a profile and find how to suggest a date without coaching.
- With a future real cohort, measure onboarding completion, mutual matches receiving replies, continued conversations, accepted invitations and voluntarily reported dates that happened. Review age-group usability gaps. Synthetic activity does not establish retention or dating success.

**Next deliverable:** three comparable Discover mockups and a recommendation showing how each serves the confirmed promise. Select the visual direction before screen-wide implementation.
