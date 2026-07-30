# Modal Step Header Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Turn the modal's desktop step indicator into a compact, centered, connected progress rail while preserving its mobile and accessibility behavior.

**Architecture:** Keep the existing semantic React markup and implement the visual refinement in the modal stylesheet. Protect the layout through the existing parsed-CSS contract tests, then verify the real rendered modal at representative widths and themes.

**Tech Stack:** React, TypeScript, CSS custom properties, Vitest, Testing Library, Vite

## Global Constraints

- Preserve the three-step Search → Review → Import workflow.
- Keep exactly one `aria-current="step"` and retain the existing accessible step labels.
- Keep the compact `Step X of 3 · Current label` summary and segmented track.
- Use existing DatoCMS theme and spacing tokens.
- Do not make steps interactive.
- Preserve the uncommitted image-language accessibility repair.
- Do not commit, merge, or push without a separate user request.

---

### Task 1: Compact Connected Step Rail

**Files:**
- Modify: `src/ui/ImportModal.css`
- Test: `src/ui/ImportModal.css.test.ts`

**Interfaces:**
- Consumes: existing `.movie-import-modal__steps`, `.movie-import-modal__step`, and `.movie-import-modal__step-marker` markup from `ModalStepIndicator`
- Produces: a centered desktop/tablet rail with decorative connectors and the unchanged compact breakpoint

- [x] **Step 1: Write the failing CSS contract test**

Add a test that extracts the existing rules and independently asserts:

```ts
expect(progressRule).toContain('padding: var(--spacing-xxs, 4px) var(--spacing-xl)');
expect(stepsRule).toContain('max-width: 720px');
expect(stepsRule).toContain('min-height: 52px');
expect(stepsRule).toContain('position: relative');
expect(railRule).toContain('background: var(--color--border)');
expect(railRule).toContain('height: 1px');
expect(railRule).toContain('left: calc(100% / 6)');
expect(railRule).toContain('right: calc(100% / 6)');
expect(stepRule).toContain('position: relative');
expect(stepRule).toContain('flex-direction: column');
expect(markerRule).toContain('position: relative');
expect(markerRule).toContain('z-index: 1');
expect(compactRailRule).toContain('display: none');
```

Also assert that the compact `max-width: 480px` media-query rules continue to hide labels and use a three-pixel marker track before desktop labels wrap.

- [x] **Step 2: Run the focused test and verify RED**

Run:

`npm test -- src/ui/ImportModal.css.test.ts`

Expected: FAIL because the desktop rail has no maximum width, compact height, or connector pseudo-element yet.

- [x] **Step 3: Implement the minimal layout**

In `src/ui/ImportModal.css`:

- center `.movie-import-modal__steps` with `max-width: 720px` and auto inline margins;
- reduce its normal `min-height` from `60px` to `52px` and reduce the progress wrapper's vertical padding;
- make `.movie-import-modal__steps` a positioned stacking context;
- draw one decorative one-pixel rail between the first and final marker centers with `::before`;
- stack each label directly beneath its centered marker;
- place markers above the rail using the existing surfaces and z-index;
- move the step-header-only compact breakpoint from `max-width: 420px` to `max-width: 480px`, retain the summary and segmented-track rules, and disable the desktop rail there.

- [x] **Step 4: Run focused tests and verify GREEN**

Run:

`npm test -- src/ui/ImportModal.css.test.ts src/ui/ModalStepIndicator.test.tsx`

Expected: PASS with the existing semantic component coverage unchanged.

- [x] **Step 5: Verify the rendered layout**

Inspect the harness at:

`http://127.0.0.1:5174/?impeccable=modal`

Check Find movie, Review changes, and Confirm import at:

- wide desktop;
- approximately 600px;
- 375px compact layout;
- light theme;
- DatoCMS dark theme.

Confirm the rail remains centered, connectors do not cross labels, compact mode has no horizontal overflow, and screen state remains visually clear.

- [x] **Step 6: Run complete verification**

Run:

- `npm test`
- `npm run lint`
- `npm run build`
- `git diff --check`
- `node /Users/roger.tinch/.agents/skills/impeccable/scripts/detect.mjs --json --scope layout src/ui/ModalStepIndicator.tsx src/ui/ImportModal.css`

Expected: all commands pass and the Impeccable detector returns no findings.

- [x] **Step 7: Stop for review**

Report the changed files, automated verification, and browser evidence. Leave the work uncommitted until the user separately requests a commit.
