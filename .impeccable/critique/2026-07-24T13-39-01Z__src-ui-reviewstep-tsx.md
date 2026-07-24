---
target: Review changes page
total_score: 31
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 1
timestamp: 2026-07-24T13-39-01Z
slug: src-ui-reviewstep-tsx
---
⚠️ DEGRADED: single-context (sub-agents spawned but stalled before returning usable assessments; completed with parent browser evidence and detector scan)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Step state, selected movie, checked proposed values, and sticky footer summary are visible; section completion/risk status could be sharper. |
| 2 | Match System / Real World | 4 | The language now matches DatoCMS editorial work: proposed TMDB values, unsaved form, draft people, uploads, and reuse are all grounded in the real workflow. |
| 3 | User Control and Freedom | 3 | Editors can toggle individual fields, select/clear all fields, choose images, resolve people, and go back; image and people bulk actions remain limited. |
| 4 | Consistency and Standards | 3 | DatoCMS Buttons, Sections, tokenized surfaces, semantic table structure, and MediaCard-inspired image cards are coherent; some custom controls still approximate DatoCMS rather than using a native exposed component. |
| 5 | Error Prevention | 3 | Empty fields are selected by default, overwrites are counted, unavailable TMDB values are disabled, and ambiguous people block continuation; side-effect timing could be more visible before Continue. |
| 6 | Recognition Rather Than Recall | 3 | Current/Proposed columns and explicit Hero/Other destinations reduce memory load; users still need to scan multiple image/person decisions to understand final impact. |
| 7 | Flexibility and Efficiency | 3 | Field-level bulk controls help, and the sticky footer summarizes scope; images and people still require row-by-row review. |
| 8 | Aesthetic and Minimalist Design | 4 | The table is much calmer after the muted Proposed-cell polish, row badges are gone, and the page now feels like an editorial tool rather than an import dashboard. |
| 9 | Error Recovery | 2 | Review makes safe choices possible, but recovery from partial side effects is mostly deferred to later confirmation/error states. |
| 10 | Help and Documentation | 3 | Inline help explains the major decisions; matching reasons and side-effect timing could still be more explicit at point of decision. |
| **Total** | | **31/40** | **Strong, native-feeling review UI with remaining opportunity around side-effect confidence and dense decision review.** |

## Design Specificity Verdict

The current Review changes page feels authored for this DatoCMS TMDB importer, not category-interchangeable. The strongest product-specific choices are the selected movie card, the Current/Proposed field comparison, the explicit separation between Poster, Hero image, and Other images, and the People section that distinguishes draft creation from reuse. The visual language is now quieter and closer to DatoCMS: muted selection surfaces, real checkboxes/radios, tokenized colors, DatoCMS Buttons/Sections, and a compact footer summary.

The remaining weakness is not polish in the decorative sense. It is editorial confidence. The page shows what will happen, but it does not yet make the highest-consequence decisions feel meaningfully different from routine empty-field fills. A careful editor can succeed, but they still need to inspect rather than skim.

LLM assessment: product-specific, calm, and aligned with an Operate surface. The page now mostly disappears into the task. It still needs stronger consequence hierarchy for people creation/reuse and asset uploads.

Deterministic scan: the CLI detector returned `[]` for `src/ui/ReviewStep.tsx`, `src/ui/FieldDiffTable.tsx`, `src/ui/ImagePicker.tsx`, `src/ui/PersonResolutionList.tsx`, and `src/ui/ImportModal.css`. No source-level detector findings.

Visual overlays: no reliable user-visible overlay is available in this run. Browser evidence came from screenshots, DOM extraction, computed layout data, and responsive viewport inspection in the local harness.

## Overall Impression

This is now a solid editor-facing review checkpoint. The previous loudness in the field table is gone, and the page reads as calm DatoCMS-adjacent UI. The biggest remaining opportunity is to help editors make a faster confidence call: "What is low-risk, what creates records/assets, and what should I double-check before Continue?"

## What's Working

- The field table is the right model. Current and Proposed columns make the data flow visible, and the full Proposed-cell hit area keeps the interaction fast without losing checkbox semantics.
- The visual tone is much better. Muted selected cells and placeholder-styled Empty values reduce noise and make the table feel native.
- The sticky footer summary is useful. It gives a constant "what am I about to do?" readout without reintroducing the removed top impact card.

## Priority Issues

### [P1] Side-effect confidence is still too implicit

Why it matters: creating draft Person records and uploading images are more consequential than filling empty text fields. The Review page includes counts, but the hierarchy still asks editors to infer which decisions deserve scrutiny.

Fix: add small consequence labels near the People and Images section summaries, not as noisy chips in every row. For example: "2 draft records will be prepared" and "3 assets selected for upload." Keep this quieter than an alert unless there are overwrites or ambiguous people.

Suggested command: `$impeccable clarify`

### [P2] Image decisions still require too much vertical scanning

Why it matters: Poster, Hero image, and Other images are correctly separate, but backdrop selection still takes a lot of space relative to the decision. Editors have to compare image cards and destination controls across a tall section.

Fix: keep Poster separate, then use one Backdrops gallery where each backdrop card exposes both destination controls: Hero radio and Other images checkbox. This keeps the explicit model while reducing duplicate review effort.

Suggested command: `$impeccable layout`

### [P2] Mobile review is usable but still long

Why it matters: the field rows are denser now and avoid horizontal overflow, but the first viewport still only gets through a few decisions before the sticky footer. On a phone, this will feel like a long approval checklist.

Fix: on small screens, compress the field row labels further by keeping Current and Proposed as compact two-column pairs within each stacked row, and shorten the footer summary to the already-good compact form: "7 fields · 3 images · 2 drafts · 1 reuse."

Suggested command: `$impeccable adapt`

### [P3] Matching evidence could be more visible for reused people

Why it matters: "Reuse existing" is a good outcome label, but editors may want to know why reuse is safe, especially when names differ or a person appears as both director and actor.

Fix: show the resolution source inline in subdued copy: "Matched by TMDB ID," "Matched by exact name," or "Selected manually." Avoid adding another strong badge.

Suggested command: `$impeccable clarify`

## Persona Red Flags

Power editor: The field table and sticky footer are efficient, but image/person decisions still require scanning the whole page. They will want more compressed image controls and stronger section-level status.

Careful content editor: The screen feels safe, but they may pause at Continue because side effects are split across sections and not ranked by consequence. People creation and uploads need a little more confidence copy.

New DatoCMS editor: The terms are mostly clear, but "Hero image," "Other images," "draft Person records," and "unsaved DatoCMS form" arrive in one dense step. They can complete the task, but may need one more line explaining that Continue is still not save/publish.

## Minor Observations

- The selected movie summary works well on desktop, but on mobile it pushes review content down; it might eventually become collapsible after the editor has chosen the movie.
- The field summary copy is much improved. It is now clear enough to keep.
- The table's muted selected state is the right direction. Do not bring back loud blue selection blocks for field rows.
- The harness remains a good approximation, but final visual acceptance should still happen inside a DatoCMS sandbox iframe.

## Questions to Consider

- What if the Review page made "creates/uploads/overwrites" the primary scan path and left low-risk fills visually quiet?
- Could one backdrop card support both Hero and Other-image decisions without becoming too control-heavy?
- What would let an editor approve this page in 20 seconds with confidence?
