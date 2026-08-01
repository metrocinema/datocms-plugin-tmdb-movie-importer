# Find Movie Modal UI Redesign

**Date:** 2026-07-23
**Status:** Implemented; retained as design history
**Scope:** UI polish for the TMDB movie importer modal screens

The current implementation includes later refinements to progress feedback, the field-review table, shared backdrop selection, native-style media cards, sticky modal chrome, and responsive behavior. Use the root README and current source for present behavior.

## Purpose

Improve the editor experience for the TMDB movie importer modal without changing the importer’s data flow, provider boundaries, field mappings, or DatoCMS write behavior.

The approved direction is a guided wizard. The modal should make the workflow feel deliberate and safe:

1. Find the right TMDB movie.
2. Review the proposed changes.
3. Confirm the import into the unsaved DatoCMS form.

## Goals

- Make the modal easier to scan at each step.
- Help editors understand where they are in the workflow.
- Make search results visually distinguishable.
- Make the review step feel like a structured approval task, not a raw field dump.
- Keep the final confirmation short, explicit, and safety-focused.
- Preserve the existing “nothing writes before final confirmation” rule.

## Non-Goals

- No change to TMDB API behavior.
- No change to DatoCMS field mapping rules.
- No change to person matching logic.
- No change to image provider contracts.
- No new backend service.
- No automatic DatoCMS save or publish behavior.
- No redesign of the plugin settings screen.

## Approved Screen Direction

The modal keeps the existing three-step structure:

1. **Find movie**
2. **Review changes**
3. **Confirm import**

Each step should share a consistent modal frame:

- A concise title.
- A short helper sentence.
- A visible step indicator.
- A clear primary action.
- A secondary cancel or back action.
- Error messages near the action or content they affect.

## Step 1: Find Movie

The find step should separate two editor intents:

- Search by title and optional release year.
- Fetch directly by TMDB ID.

Search results should render as cards instead of plain action rows. Each result card should include, when available:

- Poster thumbnail.
- Movie title.
- Release year.
- Overview snippet.
- TMDB ID as secondary metadata.
- A clear selection action.

The selected result should be visually obvious before the editor continues. If there is no selection yet, the primary continue action should either be disabled or show a clear explanation.

## Step 2: Review Changes

The review step should begin with a selected movie summary:

- Poster thumbnail.
- Title and release year.
- MPAA rating.
- Runtime.
- TMDB ID.

The review content should be grouped into three sections:

### Field Changes

Field rows should use editor-facing labels, not internal identifiers. Each row should show:

- Destination label.
- Current DatoCMS value.
- Proposed TMDB value.
- Checkbox state.
- Disabled or unavailable state when TMDB has no value.

Rows for unchanged values may remain visible, but they should not feel like required work.

### Images

The image section should use the same labels as the plugin settings and movie model:

- Poster.
- Hero image.
- Other images.

The copy should explain that hero image and other images both come from TMDB backdrops in the current TMDB-only image source. This preserves the future image-source boundary while keeping editor language simple.

Image candidates should stay selectable and previewable. The UI should make it clear that selected images will be uploaded into DatoCMS Media only after final confirmation.

### People

The people section should group directors and actors. It should make these states clear:

- Existing person reused.
- New draft person will be created.
- Ambiguous match requires editor choice.

Ambiguous person resolution should continue blocking the next step, but the blocking reason should be written in plain language near the unresolved person.

## Step 3: Confirm Import

The final confirmation step should be compact. It should summarize:

- Number of selected field changes.
- Number of people to create.
- Number of people to reuse.
- Number of images to upload.
- Any unresolved blockers, if present.

The final action remains:

**Apply to unsaved movie**

The safety note should stay explicit:

- The plugin applies values to the current unsaved DatoCMS movie form.
- It does not save the movie.
- It does not publish the movie.
- Created people and uploaded images are DatoCMS side effects and may remain if a later form update fails.

## Implementation Boundaries

The implementation should reuse the current modal step components:

- `SearchStep`
- `ReviewStep`
- `ConfirmStep`

The redesign may add shared presentational components for:

- Step indicator.
- Movie result card.
- Selected movie summary.
- Section cards.
- Field diff row.
- Summary count row.

The data flow should remain unchanged:

1. Search or fetch TMDB movie.
2. Normalize TMDB data.
3. Build review state.
4. Resolve people and image selections.
5. Build final import plan.
6. Execute the plan only after final confirmation.

## Testing Plan

Add or update component tests for:

- Step indicator labels.
- Search result card content.
- Direct TMDB ID lookup area.
- Selected movie summary on the review step.
- Field change section labels.
- Image section labels for Poster, Hero image, and Other images.
- People section states for reuse, create, and ambiguous match.
- Confirm step count summary.
- Final safety note text.

Run the existing verification set after implementation:

- `npm test`
- `npm run typecheck`
- `npm run build`

## Acceptance Criteria

The UI pass is complete when:

1. Editors can still launch the modal from the TMDB ID field.
2. Editors can search by title/year or fetch by TMDB ID.
3. Search results are card-based and easier to distinguish.
4. The review step shows a selected movie summary.
5. Field changes, images, and people are visually grouped.
6. Ambiguous people still block progress with clearer guidance.
7. The confirm step gives a compact summary before writing.
8. The final action still applies only to the unsaved movie form.
9. All existing importer behavior and provider boundaries are preserved.
10. Tests, typecheck, and build pass.
