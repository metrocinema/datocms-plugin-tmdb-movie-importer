---
target: Review changes page
total_score: 28
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 2
timestamp: 2026-07-23T20-23-55Z
slug: src-ui-reviewstep-tsx
---
Method: dual-agent (A: /root/review_changes_design_critique_v2 · B: /root/review_changes_evidence_critique_v2)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Step indicator, selected movie context, checked controls, and footer summary are clear; section-level completion and risk status are still weak. |
| 2 | Match System / Real World | 3 | The language fits DatoCMS editing well, but “currently creates” makes future side effects sound already executed. |
| 3 | User Control and Freedom | 3 | Editors can toggle individual choices and go back; there is no paired clear/reset action and no obvious “no hero image” path. |
| 4 | Consistency and Standards | 3 | DatoCMS Sections and Buttons anchor the page; custom image cards are close to native MediaCard behavior but still custom. |
| 5 | Error Prevention | 3 | Ambiguous people block Continue, but side-effect risk is not prominent enough before the editor moves on. |
| 6 | Recognition Rather Than Recall | 3 | Current/proposed values and selected image controls are visible; duplicate backdrop galleries require extra mental tracking. |
| 7 | Flexibility and Efficiency | 2 | Fields have a bulk action, but images and people do not; power editors must review all expanded sections manually. |
| 8 | Aesthetic and Minimalist Design | 3 | Much calmer and more native than earlier passes; still tall, list-heavy, and repetitive through Images. |
| 9 | Error Recovery | 2 | Image preview fallback exists, but the Review step does not explain recovery from draft-person or upload side effects. |
| 10 | Help and Documentation | 3 | Inline copy explains the main task, but defaults, matching reasons, and side-effect timing need sharper wording. |
| **Total** | | **28/40** | **Good functional review UI; the next gains are risk hierarchy and mobile density.** |

## Design Specificity Verdict

The Review changes page is now clearly authored for this product. It is not a generic import wizard. The strongest product-specific moves are the “unsaved DatoCMS form” framing, the selected movie summary, the Field changes / Images / People grouping, and the explicit split between Hero image and Other images. Those choices map to the real editorial task instead of mirroring TMDB’s raw data model.

The main remaining issue is not visual sloppiness. It is risk flatness. Field overwrites, new draft Person records, image uploads, and low-risk empty-field fills still have similar visual weight. A careful editor can complete the task, but they have to infer which decisions deserve the most scrutiny.

LLM assessment: mostly product-specific, calm, and appropriate for an Operate surface. It now feels DatoCMS-adjacent rather than like a separate SaaS panel. It still needs stronger risk hierarchy and less duplicated scanning in the image section.

Deterministic scan: the CLI detector returned `[]` for `src/ui/ReviewStep.tsx`, `src/ui/FieldDiffTable.tsx`, `src/ui/ImagePicker.tsx`, and `src/ui/PersonResolutionList.tsx`. No source-level detector findings.

Visual overlays: live DOM injection succeeded in a fresh Chrome profile through a CDP fallback. The overlay reported four anti-patterns: three long-line issues and one “single font without hierarchy” warning. The single-font warning is likely a false positive in this context because DatoCMS-native UI should use the DatoCMS font stack. The line-length findings are directionally useful: the page still lets explanatory copy stretch too wide in places.

## Overall Impression

This is in a good working place. The page is trustworthy, calm, and functionally clear. The biggest opportunity is to make Review feel like a guided approval checkpoint instead of a full inventory dump. Editors should immediately know what will overwrite content, what will upload assets, and what will create or reuse records.

## What’s Working

- The “unsaved DatoCMS form” copy is exactly the right safety promise. It tells editors TMDB is proposing changes, not taking over the record.
- The image model is honest: Poster, Hero image, and Other images are separate destinations even though Hero and Other images both come from backdrops.
- The custom image cards are now close to the native MediaCard pattern: preview area, footer control, selected border, selected footer color, and checkbox/radio placement all read much more DatoCMS-like.

## Priority Issues

### [P1] High-risk changes do not stand out enough

Why it matters: overwriting existing editorial content, creating draft Person records, uploading assets, and filling empty fields are different levels of risk. The current page treats them too similarly, so editors have to do risk classification themselves.

Fix: add a compact risk summary inside the Review step body or strengthen section headers with risk counts: “7 field changes, 0 overwrites,” “3 uploads,” “2 draft people.” In the field list, distinguish “fills empty field” from “replaces existing value.”

Suggested command: `$impeccable clarify`

### [P1] Image review repeats the same backdrops twice

Why it matters: duplicating backdrops for Hero image and Other images is logically clear but visually expensive. It doubles scanning and makes the Images section feel heavier than the decision actually is.

Fix: move toward one backdrop gallery where each card supports two destination controls: one Hero radio choice and one Other images checkbox. Keep Poster separate. This preserves explicit destination control without repeating previews.

Suggested command: `$impeccable layout`

### [P2] The sticky footer becomes heavy on mobile

Why it matters: at 390px wide, the footer grows to 121px tall and sits close to other controls near the bottom of the first viewport. That steals space from the review task and can make the page feel cramped.

Fix: on narrow screens, split the footer into two rows: a compact summary row and an actions row. Consider shortening the summary to “7 fields · 3 images · 2 drafts · 1 reuse” at mobile widths.

Suggested command: `$impeccable adapt`

### [P2] People decisions need more evidence

Why it matters: “Reuse existing” and “Create draft” are good status labels, but a content editor may need to know why reuse is safe. Name matching and TMDB ID matching are not equally strong signals.

Fix: for reused people, show “Matched by TMDB ID” or “Matched by exact name.” For draft creation, change the tag/copy to “Will create draft” so the timing is clear.

Suggested command: `$impeccable clarify`

### [P3] Bulk controls are one-way

Why it matters: “Select all changes” supports speed, but the lack of “Clear all” makes reversal feel manual. Control symmetry matters in a review screen.

Fix: add a paired “Clear all” action when at least one change is selected. Keep both buttons small and quiet.

Suggested command: `$impeccable polish`

## Persona Red Flags

Power editor: The selected movie summary and footer counts help, but the editor still has to scan every expanded section. They will feel the repeated backdrop galleries and lack of batch controls most.

Careful content editor: The page feels safe, but risk levels are too flat. They may hesitate because field overwrites, asset uploads, and draft person creation are not ranked by consequence.

New DatoCMS editor: They can follow the step labels, but “TMDB,” “Hero image,” “Other images,” “draft Person records,” and “unsaved form” are a lot of domain concepts at once. The repeated backdrop previews could read like duplicate uploads rather than separate destinations.

## Minor Observations

- Change “This review currently creates…” to “This import will create…” or “Continuing will prepare…”. The current wording suggests the draft creation has already happened.
- The selected movie poster has no explicit fallback if the summary image fails, while image candidates do.
- The browser evidence showed four backdrop preview fallbacks. The fallback is clear, but the harness/data should make it obvious whether those are intentional missing remote previews or fixture/network failures.
- Long explanatory lines still appear in live DOM overlay findings. Narrowing copy blocks a little further would make the page feel more editorial and less spreadsheet-like.

## Questions to Consider

- What if the Review page grouped decisions by risk instead of by data type?
- Could one backdrop gallery support both “Hero” and “Other images” without making the controls feel busy?
- What would let a cautious editor click Continue after a 20-second scan, not a two-minute inspection?
