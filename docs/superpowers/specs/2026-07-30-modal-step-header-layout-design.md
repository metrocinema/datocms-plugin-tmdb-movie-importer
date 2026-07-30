# Modal Step Header Layout

**Date:** 2026-07-30
**Status:** Approved

## Decision

Refine the modal's desktop and tablet step header into a compact, centered progress rail. Preserve the existing three-step workflow, state semantics, and compact mobile summary.

The progress indicator remains secondary to the active task. It should read as one connected sequence instead of three controls distributed across the modal width.

## Desktop and Tablet Layout

- Constrain the step list to a centered maximum width rather than stretching it across the full modal.
- Reduce the header's vertical footprint while preserving comfortable marker and label spacing.
- Align the numbered markers on one subtle connector rail so the sequence reads from left to right.
- Place each label directly beneath its marker, keeping the two elements grouped closely.
- Keep completed, current, and upcoming states visually distinct through existing DatoCMS theme tokens.
- Do not turn the progress indicator into navigation; the steps remain status-only.

## Compact Layout

At widths up to 480px, before the desktop labels would wrap:

- retain `Step X of 3 · Current label`;
- retain the three-segment progress track;
- hide desktop labels and numbered circles;
- prevent horizontal overflow;
- preserve the current screen-reader step list.

## Accessibility

- Keep the ordered list and `Import steps` accessible name.
- Keep exactly one `aria-current="step"`.
- Keep each step's descriptive accessible label.
- Treat connector lines as decoration with no additional semantic content.
- Preserve visible focus behavior elsewhere in the modal; the indicator itself remains non-interactive.

## Implementation Boundary

The production change should remain primarily in `src/ui/ImportModal.css`. Add markup only if the connector cannot be expressed safely through pseudo-elements.

Update the CSS contract tests before production CSS. Existing component semantics tests must continue to pass unchanged.

## Verification

- focused CSS tests prove the centered maximum width, compact height, and connectors;
- component tests continue to prove current, complete, and upcoming semantics;
- browser inspection covers Find movie, Review changes, and Confirm import;
- browser inspection covers wide, intermediate, and compact widths;
- browser inspection covers light and DatoCMS dark themes;
- no horizontal overflow appears at the compact breakpoint;
- lint, typecheck, full tests, build, and `git diff --check` pass.

## Non-Goals

- Changing the Search → Review → Import flow
- Making completed steps clickable
- Moving page titles or actions into the step rail
- Replacing the compact mobile summary
- Copying private DatoCMS admin markup or CSS
