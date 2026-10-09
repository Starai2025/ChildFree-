# Demo cast (browser demo)

All people are fictional. The founder asked for equal men and women, common names, ages from 27 to 59, and women as well as men in Discover. The cast lives in `prototype/web-mvp1/local-demo-runtime.js` (`people`). Internal ids `amara` and `malik` are kept for saved-state and test stability; they display as **Jessica** and **Marcus**.

| Id | Name | Age | Area | Seeks | Role in the demo |
|---|---|---|---|---|---|
| amara | Jessica | 32 | Atlanta | Men, women · 25–60 | The demo user |
| malik | Marcus | 32 | Atlanta | Women | Today's top pick; likes Jessica |
| michael | Michael | 52 | Decatur | Women | Discover |
| brandon | Brandon | 29 | West End | Women | Discover (later days) |
| anthony | Anthony | 59 | Buckhead | Women | Discover |
| chris | Chris | 41 | Midtown | Women | Likes Jessica, with a comment on her Sunday prompt |
| jason | Jason | 45 | Grant Park | Women | Match: conversation and a locked Saturday 11:00 date |
| kevin | Kevin | 36 | Old Fourth Ward | Women | New match: proposed a coffee date (Jessica's turn) |
| brittany | Brittany | 27 | Midtown | Men, women | Discover |
| danielle | Danielle | 51 | East Point | Women | Discover |
| rachel | Rachel | 59 | Sandy Springs | Men, women | Discover (later days) |
| ashley | Ashley | 39 | Inman Park | Women, men | Match: conversation |
| lauren | Lauren | 35 | Kirkwood | Men | Review queue |
| nicole | Nicole | 46 | East Atlanta | Men | Review queue |

The cast also includes:
- A fictional "Founding cohort mixer" next Friday, with four members going.
- A reply written in each person's voice, used by **Demo controls → Simulate a reply**.

Discover shows up to 5 new people a day, so Brandon, Rachel and Chris come after today's five.

**Saved state:** saved demo state records `cast: 2`. A browser holding an older cast loads the new one automatically.

## Adding portraits

Put each portrait in `prototype/web-mvp1/preview-assets/` as `synthetic-<id>.jpg`, and an optional second photo as `synthetic-<id>-2.jpg`. Then run:

    node scripts/build-claude-demo.mjs

The builder picks portraits up automatically. People without one show a default portrait until theirs is added.

Use 4:5 portraits about 1080 px wide; JPEG keeps the offline demo small. All portraits must be fictional (AI-generated). Never use real people's photos.
