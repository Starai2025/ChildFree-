# UI improvement plan

Prepared October 7, 2026. Target: the imported Claude web prototype and its interactive browser-demo copies, which the user selected for redesign. The supplied Figma screenshot remains a visual reference; no editable Figma file has been accessed. This is a plan, not an implemented redesign.

## Direction and goals

Make the app feel warm, polished and easy to use: generous photography, warm white surfaces, charcoal text and orange for the main action. Each screen should make its next action clear. Keep synthetic-data labeling visible in the demo, and use the existing matching, messaging and planning behavior as the foundation.

Observed issues in the checked-in screenshots and current source:

- The demo strip, brand header, review button and discovery introduction compete for vertical space.
- Navigation and helper labels are unusually small; some narrow-screen labels are 8–10px.
- Discovery emphasizes the photo while meaningful profile details begin underneath the fixed reaction controls.
- Review appears as a normal member tab and header action, which makes the member experience feel like an admin prototype.
- Profile creation is a long form without a clear progress indicator.
- A new conversation needs context and a helpful opening action. Sparse chat whitespace alone is not a defect.

## Implementation order

| Priority | Area | Planned improvement | Acceptance |
| --- | --- | --- | --- |
| 1 | Shared styles and navigation | Define spacing, type, colors, radii, buttons and icons. Use Discover, Matches, Dates and Profile as member tabs. Put simulated review in Demo controls and provide a direct action on the pending-profile screen. | Consistent components; readable labels; review remains reachable; clearly labeled demo controls. |
| 2 | Discover and full profile | Use one compact header, a photo with visible name/age/location, a concise shared-values summary and a prompt preview. Keep Like/Pass easy to reach and explain photo-specific reactions. | Name and primary controls remain visible; all details can be read; no fixed controls cover content on small screens. |
| 3 | Onboarding | Divide profile entry into short steps with progress, Back/Continue, saved drafts and errors beside the relevant fields. Show a final profile preview before submission. | All required fields and eligibility/pledge checks remain; going back preserves answers; clear recovery from validation errors. |
| 4 | Matches and chat | Improve the match celebration and conversation list. Give a new conversation a shared-interest summary and optional starter text that the member chooses before sending. Make the existing date-planning action easy to find when available. | No automatic messages or invented compatibility claims; composer remains usable with a phone keyboard; safety actions remain reachable. |
| 5 | Dates, profile and settings | Use simple date-summary cards, a clear personal-profile preview and grouped settings. Align loading, empty, pending-review, saved and failed-action states with the shared styles. | Consistent hierarchy; date actions and status understandable; honest empty/error states. |

Onboarding step changes and conversation starters are behavior work in addition to styling. Preserve the existing validation, submission/review gates and planner availability rules, and test those paths when implemented.

## Focused two-hour first pass

These are work timeboxes, not a promise to complete every screen or release a live app in two hours.

- **0–20 minutes:** define shared visual styles and redesign the Discover screen as the reference.
- **20–65 minutes:** implement shared components, compact navigation and Discover/profile improvements.
- **65–95 minutes:** polish match/chat hierarchy and onboarding readability using the existing flows.
- **95–120 minutes:** inspect responsive screens, verify core actions and saved progress, regenerate both browser-demo copies, and publish a preview after independent review.

Full onboarding step conversion, new starter interactions and comprehensive secondary-screen polish are the next pass if they do not fit the first timebox. Finish each selected flow completely rather than leaving partial interactions.

## Review and verification

Review Discover first at phone size to establish the visual direction. Then inspect onboarding, mutual match, conversation and date planning as a connected journey.

When implementation begins:

- Check 320, 390 and 768px layouts plus a short phone viewport, keyboard behavior and safe-area spacing.
- Target 16px body text, at least 12px supporting/navigation labels where practical, 44px minimum primary tap targets and WCAG AA text contrast.
- Verify keyboard navigation, visible focus, control labels and reduced-motion behavior for any added animation.
- Exercise eligibility, pledge, draft resume, submission, simulated review, matching, chat, safety, reset and existing planner rules affected by the changes.
- Run applicable repository checks, regenerate the compact and standalone demos, and independently review a fixed implementation commit as required by AGENTS.md.
- Provide a clickable preview and screenshots. Confirm remote availability when access permits; distinguish local test results from remote hosting checks.

Judge the result by whether someone can understand a profile, finish onboarding and start a conversation without explanation. For a later real cohort, measure onboarding completion, first-message replies and accepted date invitations rather than assuming visual changes create retention.
