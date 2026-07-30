# Native Media Card Density Polish

**Date:** 2026-07-30
**Status:** Approved

## Decision

Refine the TMDB image-selection cards toward DatoCMS's native Media Area rhythm without copying its exact compact dimensions.

Use a roomier native-style card because this plugin displays provider, dimensions, language, and destination labels in addition to the image. Preserve the current complete-image preview and selection behavior.

## Card Geometry

- Use a consistent card width between 190px and 200px at normal modal widths.
- Use a 144px-high preview canvas.
- Center complete poster and backdrop images inside that canvas without cropping or stretching.
- Use a generous grid gap from the existing DatoCMS spacing tokens.
- Keep the 4px card radius and token-based one-pixel unselected outline.
- Keep the existing three-pixel selected outline.

The grid should remain left-aligned and fill each row with as many complete cards as the available width supports. Cards should not stretch to fill leftover space at normal modal widths.

## Preview and Metadata

Keep the established card structure:

1. optional destination status chips;
2. preview canvas;
3. TMDB provider, dimensions, and language metadata;
4. selection caption containing the native radio button or checkbox.

The preview canvas becomes slightly shorter than the current 160px canvas, but it continues to show the entire intrinsic image using containment. Metadata remains visible rather than being replaced with a filename-style caption.

## Selection and Interaction

Preserve the native-inspired state model already implemented:

- unselected cards use neutral DatoCMS surfaces and borders;
- hover uses the DatoCMS hover-border token;
- focus retains the visible DatoCMS focus outline;
- selected cards use the DatoCMS selected-border token;
- selected captions use the DatoCMS selected surface and ink.

Keep the caption at a minimum height of 44px. DatoCMS's native MediaCard caption is more compact, but this plugin retains the larger target for accessible pointer and touch interaction.

## Responsive Behavior

At narrow modal widths:

- retain the existing responsive stacking behavior;
- keep cards usable without horizontal scrolling;
- keep the contained-image preview fixed rather than allowing content-dependent card heights;
- preserve the current single-column destination lanes where required;
- do not force the 190px minimum when it would overflow the modal.

## Behavior Preserved

This polish does not change:

- the first-ten poster and backdrop limits;
- English-language poster filtering;
- Hero Image radio behavior;
- Other Images checkbox behavior;
- the explicit “Do not import” Hero Image option;
- destination status chips;
- image URLs, upload behavior, or original dimensions;
- accessible control names or alternative text;
- preview failure handling;
- light- or dark-theme token selection.

## Implementation Boundary

The expected production change is limited to media-grid and media-card geometry in `src/ui/ImportModal.css`.

Update the CSS contract tests in `src/ui/ImportModal.css.test.ts` before changing production CSS. No component markup or data-flow change is expected unless browser evidence reveals a defect that cannot be corrected safely in CSS.

## Verification

Automated verification must cover:

- the 190px-to-200px normal card-width constraint;
- the 144px normal preview height;
- complete-image containment;
- preserved selected and unselected token states;
- preserved narrow-layout containment and stacking.

Browser verification must cover:

- Poster, Hero Image, and Other Images lanes;
- selected and unselected cards;
- complete poster and backdrop visibility;
- intermediate, wide, and narrow modal widths;
- light and DatoCMS dark themes;
- keyboard focus;
- long metadata and destination labels;
- preview fallback cards.

Run the Impeccable detector once after the UI changes are complete. A clean detector result supplements rather than replaces browser inspection.

## Non-Goals

- Recreating DatoCMS's private `MediaCard` component
- Copying DatoCMS admin CSS
- Adding DatoCMS Media Area search, filters, sorting, pagination, view modes, or density controls
- Changing image-selection or import data flow
- Hiding TMDB metadata
- Reducing selection targets below 44px
