# Ten-question compatibility section

User-authorized addition to the selected browser prototype. The user subsequently instructed: **do not push until after they see the full demo**. This implementation is a local review candidate; GitHub remains at the previous checkpoint until that instruction is satisfied and a push is authorized.

## Member experience

In **Profile → Edit compatibility answers**, or during profile creation, open **The life you'd share**. The section presents one question at a time, progress, Back/Next, Skip, and a final answer review. Every answer is optional and can be cleared. Chosen answers appear on the submitted profile. Saving profile edits uses the existing resubmission/review behavior; draft saves alone do not publish changes.

1. What role does faith or spirituality play in your life?
2. What approach to beliefs would you like in a partner?
3. How important is a similar approach to faith or spirituality?
4. Which spending approach feels most like you?
5. What would feel comfortable spending on a first date?
6. How important is a similar approach to spending?
7. What social pace feels best to you?
8. What does a good weekend usually look like?
9. How important is a similar everyday lifestyle?
10. When are you usually available for a first date?

The three importance questions offer Essential to me, Nice to share, and Flexible. The UI explains that these priorities are shared for conversation and existing Discovery filters control who appears. Faith identity remains in the existing optional basics; the new faith questions address practice, partner expectations and importance. Spending answers describe preferences, not income or bank information. Availability is general, not an appointment booking or calendar connection.

## Storage and compatibility boundaries

Submitted profiles store `compatibility: {version: 1, answers: {...}}`. Only catalogued question IDs and enum values are accepted. Drafts use the existing private draft document and save immediately when a compatibility answer changes; saves are queued, have visible status, and support retry after failure. A pending ordinary profile autosave is cancelled before submission to prevent a late timer restoring a submitted draft.

The field is additive. Previously saved profiles remain usable, acquire no invented answers and need no storage reset. Unsupported versions or malformed answers supply no match evidence. New synthetic fixtures explicitly demonstrate filled answers; preexisting saved fixtures are not silently changed.

Profile cards display exact shared answers and an expandable answer list. Equal importance labels do not count as alignment. Missing, skipped or different answers create no shared-answer claim. Shared role/practice is not presented as shared religious identity, verified belief or guaranteed relationship compatibility. No percentage score is shown.

This slice adds collection, editable profile answers and factual comparison. Existing candidate ranking, filters, age/gender reciprocity, reactions, matching, chat and planner rules are unchanged. Applying new answers to ranking or hard exclusions remains a separate implementation decision. Expo, SQL, real provider code and dependencies are unchanged. The Claude source now includes the questionnaire, but the separately hosted Claude artifact has not been updated. The synthetic runtime remains confined to generated demo copies.

## Evidence

- `node scripts/build-claude-demo.mjs`: regenerate compact and self-contained copies.
- `node tests/claude-browser-demo.mjs`: passes the shipped app without an injected provider adapter. Covers all ten steps, draft reload, full submission, profile display, edit/skip/reapproval, storage failure/retry, legacy profiles without answers, existing matching/chat, reset, responsive controls and direct offline message persistence. No page errors or external provider requests observed.
- `npm run check`: passes workspace typing/lint, all 36 tests including four compatibility-domain cases, Edge checks and admin build.
- `node tests/claude-prototype-ui.mjs`: passes the original Claude-source synthetic UI regression, including safety and date-planner controls, and regenerates the static reference gallery. This is separate from the shipped-app test above.
- Inline/source scripts pass syntax checks; source/runtime/dependency boundaries and whitespace checked.
- New questionnaire and expanded profile screenshots inspected under `docs/evidence/compatibility`.

The review archive contains the entire self-contained app, not a static screenshot gallery. Extract it and open `BlackChildfree-demo.html` in a computer browser with storage enabled. Synthetic profiles, matching, chat, questionnaire, review and other existing prototype flows operate locally. No account or backend is needed. This is an interactive synthetic demo, not a hosted real-member service.

The temporary-host probe returned a network-proxy CONNECT 403; no public preview deployment was established. Independent read-only A6 review accepted local implementation commit `831fb91352c8649b1ba8c14c66714fefeaf51dd7` against public baseline `637ceb3518705cdb29c373481908e333809e2d72`, with no material findings. The reviewer independently passed the four domain tests and the complete shipped-demo workflow without editing or pushing files. This acceptance permits local demo delivery only; no GitHub push is permitted before the user tries this candidate and authorizes the push.
