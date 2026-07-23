---
target: Review changes page
total_score: 27
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 4
timestamp: 2026-07-23T19-55-59Z
slug: src-ui-reviewstep-tsx
---
⚠️ DEGRADED: single-context (fresh critique subagents were spawned but did not return usable final reports; parent completed detector and isolated browser evidence)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | The active step and selected controls are visible, but there is no compact "what will happen" summary before Continue. |
| 2 | Match System / Real World | 3 | DatoCMS language is mostly clear; side-effect language waits until later, so "Create draft" can feel lighter than what will happen. |
| 3 | User Control and Freedom | 3 | Editors can toggle fields/images and go Back, but the long page makes reversing choices tedious. |
| 4 | Consistency and Standards | 3 | Sections and buttons feel closer to DatoCMS, but raw custom checkbox/media-card patterns still diverge from native vocabulary. |
| 5 | Error Prevention | 3 | Ambiguous people are blocked well; image upload and draft-creation consequences are not summarized soon enough. |
| 6 | Recognition Rather Than Recall | 3 | Current/Proposed rows are understandable, but repeated generic "Select" labels and stacked cards require scanning memory. |
| 7 | Flexibility and Efficiency | 2 | The page is over 3,000px tall for the fixture case; there is no sticky footer, compact mode, or grouped editing path. |
| 8 | Aesthetic and Minimalist Design | 2 | The page is calm but too repetitive; field cards, media cards, and people rows compete through sheer vertical volume. |
| 9 | Error Recovery | 2 | Broken/missing image states are not designed; blank media cards do not explain whether TMDB, network, or harness loading failed. |
| 10 | Help and Documentation | 3 | Help copy is useful, but the most important reassurance about drafts/uploads/form saves appears more strongly on Confirm. |
| **Total** | | **27/40** | **Solid but heavy** |

## Design Specificity Verdict

The Review changes page feels authored for a DatoCMS plugin, not like a random SaaS modal, but it is still more "carefully assembled form" than "confident editorial review tool." The Dato-native direction is working: restrained palette, real Section usage, clear primary action, and explicit Hero image / Other images separation. The weak spot is not taste. The weak spot is operational confidence at scale.

An editor is being asked to approve field writes, image uploads, person reuse, and draft creation in one long scroll. The interface shows all of those pieces, but it does not yet compose them into a crisp decision moment. It asks the editor to inspect every part, then scroll to the bottom and remember the whole import plan.

Deterministic scan: `detect.mjs` returned `[]` for `src/ui/ReviewStep.tsx`, `src/ui/FieldDiffTable.tsx`, `src/ui/ImagePicker.tsx`, and `src/ui/PersonResolutionList.tsx`. No mechanical Impeccable findings were reported.

Visual overlays: no reliable overlay was produced. The shared Playwright MCP profile was locked, and the parent used an isolated system-Chrome screenshot instead. That screenshot reached the Review changes state through the real harness flow and showed a 3,109px-tall page at an 809x998 viewport.

## Overall Impression

This is a strong functional skeleton that now needs an editorial control pass. The page explains each area, but it does not yet help the editor answer the core question quickly: "What exactly will change if I continue?"

## What's Working

1. The flow hierarchy is understandable. Find movie, Review changes, Confirm import gives editors a simple mental model, and the active Review changes state is visually obvious.

2. Field-level comparison is honest. Current and Proposed rows make the source of truth visible, which is exactly the right posture for importing external TMDB data.

3. Hero image and Other images are separated clearly. This avoids the subtle data-flow trap where the first selected backdrop silently becomes the hero.

## Priority Issues

### [P1] The page lacks a compact import-impact summary

Why it matters: The editor must approve several types of side effects: field updates, image uploads, draft people, reused people. Those are scattered across the page. Before Continue, there should be a single statement of consequence.

Fix: Add a compact summary near the top, probably between the selected movie card and Field changes: "This import will update 7 fields, upload 4 images, create 2 draft people, and reuse 1 existing person." Make each count jump to its section if possible. Repeat or pin the same summary near the footer on long screens.

Suggested command: `$impeccable polish Review changes page`

### [P1] Field changes are too vertically repetitive

Why it matters: Seven fields produce a long scroll even in the small fixture. Real movie models may add more mapped fields later. The repeated article + mini diff-table structure makes every field feel equally heavy.

Fix: Convert Field changes into a denser Dato-style review table/list: field name, current value, proposed value, and checkbox in one row for simple scalar fields. Use expansion only for long text fields like description. Keep the current card detail only where the content needs it.

Suggested command: `$impeccable distill Review changes page`

### [P1] Image cards need a designed loading/broken state

Why it matters: The captured harness screenshot showed large blank image cards. Even if that is caused by external image loading in the harness, a production editor can hit slow, blocked, or failed image loads. Blank selected cards undermine confidence.

Fix: Add a thumbnail loading/error presentation inside the MediaCard-inspired tile: provider label, image type, dimensions if available, and a "Preview unavailable" fallback when the image fails. Keep the footer selection control, but make the card informative without the image.

Suggested command: `$impeccable harden Review changes page`

### [P1] Repeated controls have weak accessible names

Why it matters: The field checkboxes all read as "Select" in the DOM evidence. A sighted editor gets row context visually, but screen reader and voice-control users need unique control names like "Select Title" and "Select Runtime."

Fix: Give field toggles specific accessible labels. Do the same for image options: "Use poster image 1 as poster," "Use backdrop 1 as Hero image," "Add backdrop 2 to Other images." Visible copy can stay short.

Suggested command: `$impeccable audit Review changes page`

### [P2] Continue is buried at the bottom of a long decision page

Why it matters: After reviewing the first sections, the editor loses access to the primary action until the end of the scroll. This makes the modal feel longer and less controlled than it is.

Fix: Use a Dato-native sticky footer inside the modal, or add a compact top action strip once the editor has a valid plan. Keep Back and Continue visible while scrolling, with the ambiguous-people warning in the same footer when needed.

Suggested command: `$impeccable layout Review changes page`

## Persona Red Flags

**Marta, a careful content editor:** She wants to know whether the importer will overwrite editorial fields. Current/Proposed helps her, but she has to read seven separate blocks and then remember image and people choices. The missing top summary slows her down and makes the final Continue feel under-confirmed.

**James, a power editor importing several catalog titles:** The page is too tall for repeated use. He gets no compact mode, no sticky Continue, and no fast way to review only changed or risky fields. The repeated diff cards make bulk work feel slower than it needs to be.

**Nina, an accessibility-first editor using keyboard or screen reader:** Repeated "Select" controls are ambiguous outside visual row context. The page likely works mechanically, but the accessible naming does not yet match the visual clarity.

## Minor Observations

- The selected movie card loses emotional usefulness when the poster does not render; it becomes mostly metadata.
- "Create draft" and "Reuse existing" pills are good, but the People section would benefit from counts in its heading or helper copy.
- Runtime appears as `99` in Field changes but `99 min` in the selected movie summary. The proposed field value may be technically raw, but the review UI should be consistent unless the raw value is intentional.
- "Select all changes" has no paired "Deselect all" or "Reset defaults." That is fine for v1, but it will matter if editors often cherry-pick fields.

## Questions to Consider

- What if the first thing after the selected movie were not details, but a concise import plan?
- Which field changes deserve full Current/Proposed treatment, and which could be one-line rows?
- Should image selection feel like choosing assets, or like accepting upload jobs?
- Would an editor trust "Create draft" more if it said when the draft gets created?
