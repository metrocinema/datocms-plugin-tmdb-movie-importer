# Native Media Preview Design

**Date:** 2026-07-30
**Status:** Approved

## Decision

Show each poster and backdrop in full inside a fixed-height preview canvas. Center the image without cropping or stretching, and preserve the existing card grid, destination controls, metadata, and selection behavior.

The result should follow the visual structure of DatoCMS's native MediaCard: a quiet preview surface, a contained image, and a separate caption row containing the selection control.

## Context

The current image thumbnails use `object-fit: cover` with forced poster or backdrop aspect ratios. That keeps every preview box filled, but it can remove content from the image edges.

Editors use these thumbnails to choose source artwork. Showing an incomplete crop can hide details that affect that decision, so selection accuracy matters more than filling every pixel of the preview.

## Preview Structure

Each image option keeps its existing selectable card and gains a dedicated preview canvas inside the preview area.

The card structure remains:

1. optional destination status chips;
2. preview area;
3. fixed preview canvas containing the image or fallback;
4. source, dimensions, and language metadata;
5. caption row with the radio button or checkbox.

The dedicated canvas separates image fitting from card layout. This prevents metadata, fallback content, and differently proportioned images from changing the grid rhythm.

## Image Fitting

- Use a consistent preview-canvas height across poster and backdrop cards.
- Center the image horizontally and vertically.
- Constrain the image to the canvas with `max-width: 100%` and `max-height: 100%`.
- Preserve the image's intrinsic aspect ratio with automatic width and height.
- Use `object-fit: contain` as a defensive constraint.
- Never crop or stretch the candidate image.
- Allow the neutral preview surface to remain visible around images whose aspect ratio does not fill the canvas.

The narrow layout may use a slightly shorter fixed canvas, but it must retain the same containment behavior.

## Native DatoCMS Treatment

Use DatoCMS color, border, spacing, and selected-state tokens already available to the plugin. Do not copy DatoCMS admin CSS wholesale or depend on private `MediaCard` class names.

The existing interaction states remain:

- unselected cards use a neutral DatoCMS surface and border;
- hover and focus retain their current visible feedback;
- selected cards use the DatoCMS selected border;
- selected caption rows use the DatoCMS selected surface and ink;
- the preview canvas itself does not become a custom green or decorative surface.

## Behavior Preserved

This change does not alter:

- the first-ten poster and backdrop limits;
- English-language poster filtering;
- Hero Image radio behavior;
- Other Images checkbox behavior;
- reuse of one backdrop in both destinations;
- image source URLs, uploads, or original asset dimensions;
- accessible control names;
- preview failure handling.

## Accessibility

- The image remains represented by its existing useful alternative text.
- Preview failures keep their existing accessible fallback.
- Radio buttons and checkboxes remain in the caption row and keep their current labels.
- Focus, hover, and selected states do not rely on color alone.
- Light and dark themes must retain readable contrast.

## Testing

Automated CSS coverage must prove:

- the preview canvas has a fixed height and centers its content;
- images use containment rather than cropping;
- images preserve intrinsic proportions through automatic dimensions and maximum bounds;
- forced poster and backdrop aspect ratios no longer control rendered thumbnails;
- the narrow layout keeps a fixed, contained preview.

Final verification must include:

- focused unit and CSS contract tests;
- type checking and production build;
- browser review of posters, Hero Image candidates, and Other Images candidates;
- selected and unselected cards;
- light and DatoCMS dark themes;
- unusually wide or tall candidate images when available.

## Non-Goals

- Recreating DatoCMS's private MediaCard component
- Changing image-selection data flow
- Changing upload dimensions or file processing
- Adding zoom, cropping, or image-detail controls
- Making card heights adapt to individual image proportions
