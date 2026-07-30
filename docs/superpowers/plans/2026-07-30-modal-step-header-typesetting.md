# Modal Step Header Typesetting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Improve the modal step header's typographic precision without changing its type family, scale, copy, or semantics.

**Architecture:** Keep the existing React markup and make a CSS-only refinement protected by the parsed-CSS contract tests. Verify computed typography and wrapping in the real harness.

**Tech Stack:** React, TypeScript, CSS custom properties, Vitest, Vite

## Global Constraints

- Preserve the approved compact centered rail.
- Preserve the DatoCMS Colfax typography and existing role sizes.
- Preserve current, completed, and upcoming semantics.
- Preserve the uncommitted image-language accessibility repair.
- Do not commit, merge, or push without a separate user request.

---

### Task 1: Precision Step Typesetting

**Files:**
- Modify: `src/ui/ImportModal.css`
- Test: `src/ui/ImportModal.css.test.ts`

**Interfaces:**
- Consumes: existing `ModalStepIndicator` class names and DatoCMS font-size tokens
- Produces: tighter desktop labels and stable compact numeric metadata

- [x] **Step 1: Add a failing CSS contract test**

Assert that:

```ts
expect(labelRule).toContain('line-height: 1.25');
expect(labelRule).toContain('text-wrap: balance');
expect(markerRule).toContain('font-variant-numeric: tabular-nums');
expect(compactPositionRule).toContain('font-variant-numeric: tabular-nums');
expect(compactSeparatorRule).toContain('font-size: var(--font-size-xs)');
expect(compactSeparatorRule).toContain('line-height: 1.5');
```

- [x] **Step 2: Run the focused test and verify RED**

Run `npm test -- src/ui/ImportModal.css.test.ts`.

Expected: FAIL because the precision typesetting rules are not present.

- [x] **Step 3: Implement the minimal CSS**

Add the approved label, marker, position, and separator declarations using the existing DatoCMS tokens. Do not change component markup.

- [x] **Step 4: Run focused tests and verify GREEN**

Run `npm test -- src/ui/ImportModal.css.test.ts src/ui/ModalStepIndicator.test.tsx`.

Expected: PASS.

- [x] **Step 5: Verify rendered typography**

Inspect the modal header at wide, 481px, and compact widths in light and DatoCMS dark themes. Confirm label grouping, wrapping, numeric stability, and hierarchy.

- [x] **Step 6: Run complete verification**

Run `npm test`, `npm run lint`, `npm run build`, `git diff --check`, and the Impeccable type detector.

- [x] **Step 7: Stop for review**

Report the implementation and leave it uncommitted.
