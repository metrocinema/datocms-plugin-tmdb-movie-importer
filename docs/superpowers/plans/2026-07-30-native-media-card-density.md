# Native Media Card Density Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the TMDB media picker a consistent 190px-to-200px card rhythm and a 144px contained preview while preserving its metadata, accessible controls, selection behavior, and responsive layout.

**Architecture:** Keep `ImagePicker.tsx` and all image-selection data flow unchanged. Update only the media-grid and preview geometry in `ImportModal.css`, with CSS contract tests proving the normal and narrow layouts. Verify the finished result in the standalone harness and the DatoCMS sandbox because static CSS tests cannot prove optical alignment or host-theme behavior.

**Tech Stack:** React, TypeScript, CSS, Vitest, Vite, DatoCMS React UI tokens, Chrome browser automation

## Global Constraints

- Normal card width must stay between 190px and 200px.
- Normal preview canvas height must be 144px.
- Images must remain centered, fully contained, uncropped, and unstretched.
- Grid spacing must use existing DatoCMS spacing tokens.
- Card radius, unselected outline, selected outline, selected caption, focus outline, and 44px minimum caption target must remain unchanged.
- TMDB provider, dimensions, language, destination labels, status chips, and preview fallbacks must remain visible.
- Existing narrow-layout stacking must remain free of horizontal scrolling.
- Do not copy DatoCMS private classes or admin CSS.
- Do not change component markup, selection logic, image limits, upload behavior, or import data flow.
- Run the Impeccable detector once, after UI editing is complete.
- Report local harness evidence and DatoCMS sandbox evidence separately.
- Do not save or publish a DatoCMS entry during visual verification.
- Do not commit, merge, or push unless the user requests each action separately.

---

## File Map

- `src/ui/ImportModal.css.test.ts`: Owns contract tests for the image-grid width, gap, normal preview height, containment, selected states, and narrow layout.
- `src/ui/ImportModal.css`: Owns the media-grid geometry and preview-canvas height. No new component or token abstraction is needed.
- `src/ui/ImagePicker.tsx`: Read-only verification target. Its markup, labels, selection handlers, status chips, and accessible names must not change.
- `docs/superpowers/specs/2026-07-30-native-media-card-density-design.md`: Approved product and visual requirements.

### Task 1: Tighten the normal media-card geometry

**Files:**
- Modify: `src/ui/ImportModal.css.test.ts:127-153`
- Modify: `src/ui/ImportModal.css:644-750`
- Verify unchanged: `src/ui/ImagePicker.tsx`

**Interfaces:**
- Consumes: existing selectors `.movie-import-modal__image-grid`, `.movie-import-modal__image-canvas`, `.movie-import-modal__image-thumb`, and the existing `ruleFor()` / `ruleInMedia()` CSS-test helpers.
- Produces: a normal grid using `repeat(auto-fill, minmax(190px, 200px))`, `var(--spacing-l)` spacing, and a `144px` contained preview canvas.

- [ ] **Step 1: Change the normal-geometry test before production CSS**

Replace the current normal preview assertion block with a test that covers the grid and canvas together:

```ts
it('uses roomier native-style media card geometry without cropping previews', () => {
  const gridRule = ruleFor('.movie-import-modal__image-grid');
  const canvasRule = ruleFor('.movie-import-modal__image-canvas');
  const imageRule = ruleFor('.movie-import-modal__image-thumb');
  const posterRule = ruleFor('.movie-import-modal__image-thumb--poster');
  const backdropRule = ruleFor('.movie-import-modal__image-thumb--backdrop');

  expect(gridRule).toContain('gap: var(--spacing-l)');
  expect(gridRule).toContain('grid-template-columns: repeat(auto-fill, minmax(190px, 200px))');
  expect(gridRule).toContain('justify-content: start');
  expect(canvasRule).toContain('align-items: center');
  expect(canvasRule).toContain('height: 144px');
  expect(canvasRule).toContain('justify-content: center');
  expect(canvasRule).toContain('background: var(--color--surface');
  expect(imageRule).toContain('height: auto');
  expect(imageRule).toContain('max-height: 100%');
  expect(imageRule).toContain('max-width: 100%');
  expect(imageRule).toContain('object-fit: contain');
  expect(imageRule).toContain('width: auto');
  expect(posterRule).not.toContain('aspect-ratio');
  expect(backdropRule).not.toContain('aspect-ratio');
});
```

Keep the existing narrow-layout test unchanged:

```ts
it('keeps a contained fixed preview canvas at narrow widths', () => {
  const condition = '(max-width: 540px)';
  const previewRule = ruleInMedia(condition, '.movie-import-modal__image-preview');
  const canvasRule = ruleInMedia(condition, '.movie-import-modal__image-canvas');

  expect(previewRule).toContain('padding: var(--spacing-m)');
  expect(canvasRule).toContain('height: 140px');
});
```

- [ ] **Step 2: Run the focused CSS test and verify the expected failure**

Run:

```bash
npm test -- src/ui/ImportModal.css.test.ts
```

Expected: FAIL because the current grid still uses `gap: var(--spacing-m)`, `minmax(160px, 220px)`, and a `160px` normal canvas.

- [ ] **Step 3: Apply the minimal CSS change**

Change only the normal grid and canvas declarations:

```css
.movie-import-modal__image-grid {
  display: grid;
  gap: var(--spacing-l);
  grid-template-columns: repeat(auto-fill, minmax(190px, 200px));
  justify-content: start;
  min-width: 0;
}

.movie-import-modal__image-canvas {
  align-items: center;
  background: var(--color--surface);
  border-radius: 4px;
  display: flex;
  height: 144px;
  justify-content: center;
  overflow: hidden;
  width: 100%;
}
```

Do not change `.movie-import-modal__image-option`, `.movie-import-modal__image-footer`, `.movie-import-modal__image-thumb`, or the existing `(max-width: 540px)` overrides.

- [ ] **Step 4: Run the focused CSS test and verify it passes**

Run:

```bash
npm test -- src/ui/ImportModal.css.test.ts
```

Expected: PASS with no failures.

- [ ] **Step 5: Run component-level image-picker regression tests**

Run:

```bash
npm test -- src/ui/ImportModal.test.tsx
```

Expected: PASS, proving image labels, selection controls, and fallback behavior remain intact.

- [ ] **Step 6: Inspect the focused source diff**

Run:

```bash
git diff --check
git diff -- src/ui/ImportModal.css src/ui/ImportModal.css.test.ts src/ui/ImagePicker.tsx
```

Expected:

- no whitespace errors;
- only the test contract and the two normal CSS geometry declarations change;
- `src/ui/ImagePicker.tsx` has no diff.

- [ ] **Step 7: Hold the commit boundary**

Stop with the task changes uncommitted. If the user later requests a commit, stage only:

```bash
git add src/ui/ImportModal.css src/ui/ImportModal.css.test.ts docs/superpowers/specs/2026-07-30-native-media-card-density-design.md docs/superpowers/plans/2026-07-30-native-media-card-density.md
git commit -m "💄 polish(ui): tighten media card density"
```

### Task 2: Verify the rendered media-picker path

**Files:**
- Inspect: `src/ui/ImportModal.css`
- Inspect: `src/ui/ImagePicker.tsx`
- No production file changes expected

**Interfaces:**
- Consumes: the local harness at `http://127.0.0.1:5174/?impeccable=modal`, its `theme=dato-dark` and `scenario=odyssey-existing` parameters, and the configured DatoCMS sandbox plugin.
- Produces: browser evidence that the denser cards remain usable, complete, accessible, and host-theme compatible.

- [ ] **Step 1: Start the local harness**

Run:

```bash
npm run dev
```

Expected: Vite serves the plugin at `http://127.0.0.1:5174/` on port 5174 without selecting a fallback port.

- [ ] **Step 2: Review the light harness at wide and intermediate widths**

Open:

```text
http://127.0.0.1:5174/?impeccable=modal
```

Navigate to **Review changes** and inspect Poster, Hero Image, and Other Images.

At approximately 1200px and 768px viewport widths, verify:

- cards remain between 190px and 200px wide;
- cards do not stretch across leftover row space;
- the grid stays left-aligned;
- poster and backdrop images are fully visible;
- provider, dimensions, language, and destination labels remain readable;
- selected and unselected cards retain their existing token-driven states;
- Hero Image and Other Images status chips do not collide with image content;
- no horizontal page or modal overflow appears.

- [ ] **Step 3: Review the Dato-dark harness**

Open:

```text
http://127.0.0.1:5174/?impeccable=modal&theme=dato-dark&scenario=odyssey-existing
```

Verify the same lanes and interaction states. Confirm:

- neutral preview surfaces do not become green or decorative;
- selected borders and selected captions match the Dato token set;
- muted metadata, borders, and fallback text remain readable;
- keyboard focus remains visibly distinct from selection.

- [ ] **Step 4: Review the narrow layout**

At approximately 540px, 390px, and 320px viewport widths, verify:

- no horizontal scrolling;
- destination lanes retain their intended single-column layout;
- preview canvases remain 140px high;
- complete images remain visible;
- captions retain a minimum 44px target;
- long labels and metadata do not overlap controls.

- [ ] **Step 5: Inspect interaction and failure states**

Using keyboard and pointer input:

- tab through poster, Hero Image, “Do not import,” and Other Images options;
- select and clear available checkbox choices;
- change the Hero Image radio choice;
- confirm focus and checked states remain distinguishable without relying on color alone;
- inspect at least one harness fallback card or block an image request so “Preview unavailable” appears;
- confirm fallback geometry matches loaded cards;
- inspect the browser console for new warnings or errors.

- [ ] **Step 6: Run the single required Impeccable detector pass**

Run:

```bash
node /Users/roger.tinch/.agents/skills/impeccable/scripts/detect.mjs --json src/ui/ImportModal.css src/ui/ImportModal.css.test.ts
```

Expected: no new actionable findings. If the detector reports a real defect in the changed geometry, fix that defect, rerun the focused tests, and do not run the detector a second time.

- [ ] **Step 7: Verify in the DatoCMS sandbox without persisting content**

Use the configured sandbox plugin entry point and open the TMDB importer from a movie record. Navigate through Find movie to Review changes, but do not confirm an import, save, or publish.

Verify:

- the host modal renders the same card density as the harness;
- Poster, Hero Image, and Other Images cards use complete contained previews;
- Dato dark-mode tokens render correctly;
- selected and unselected states remain consistent with the native Media Area vocabulary;
- no new plugin console errors occur.

Report sandbox acceptance separately from harness acceptance.

- [ ] **Step 8: Run the full verification suite**

Run:

```bash
npm test
npm run lint
npm run build
git diff --check
git status --short --branch
```

Expected:

- every Vitest test passes;
- TypeScript lint/type checks exit successfully;
- the Vite production build exits successfully;
- no whitespace errors;
- only the approved CSS, test, spec, and plan files are changed;
- all changes remain uncommitted unless the user separately requested a commit.

- [ ] **Step 9: Report the four delivery states separately**

Report:

1. source diff and automated verification;
2. local harness evidence;
3. DatoCMS sandbox evidence;
4. git state.

State explicitly that no DatoCMS entry was imported, saved, or published, and that no commit, merge, push, deployment, or production change occurred.
