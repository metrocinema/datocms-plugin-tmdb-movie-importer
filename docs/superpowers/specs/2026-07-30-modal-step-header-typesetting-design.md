# Modal Step Header Typesetting

**Date:** 2026-07-30
**Status:** Approved

## Decision

Apply a precision typography pass to the modal step header without changing its established Colfax type family, role scale, wording, or state hierarchy.

## Desktop and Tablet

- Keep step labels at the existing small UI-label size.
- Tighten label line height to 1.25 so each label remains closely grouped with its marker.
- Balance labels when localization or constrained space causes wrapping.
- Use tabular numerals for numbered step markers.

## Compact Layout

- Keep the current `Step X of 3 · Current label` hierarchy.
- Use tabular numerals for the step position so progress changes do not create avoidable width shifts.
- Size the separator as metadata rather than inheriting the larger body role.
- Keep the current label at its established small semibold role.

## Constraints

- Preserve DatoCMS React UI typography and theme tokens.
- Do not introduce another font family or load additional font assets.
- Preserve browser zoom, responsive behavior, and screen-reader semantics.
- Keep current, completed, and upcoming state emphasis unchanged.

## Verification

- CSS contract tests cover label leading, balanced wrapping, tabular numerals, and separator sizing.
- Browser inspection covers wide and compact layouts in light and DatoCMS dark themes.
- Long or wrapped labels retain readable leading.
- Full tests, lint, build, `git diff --check`, and the Impeccable type detector pass.
