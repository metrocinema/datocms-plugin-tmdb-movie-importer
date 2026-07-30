# Native Media Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display complete poster and backdrop thumbnails in fixed, DatoCMS-native preview canvases without cropping or changing selection behavior.

**Architecture:** Add one presentational canvas wrapper around each candidate image or fallback in `ImagePicker.tsx`. Let that wrapper own the stable preview dimensions while `ImportModal.css` centers and contains the intrinsic image; preserve the existing card, metadata, caption, and form-control structure.

**Tech Stack:** React, TypeScript, CSS with DatoCMS design tokens, Vitest, Testing Library, Vite

## Global Constraints

- Show the entire candidate image without cropping or stretching.
- Keep a fixed-height preview canvas so image cards remain aligned.
- Use existing DatoCMS tokens and current selected, hover, focus, and caption states.
- Preserve image limits, filtering, selection logic, accessible names, preview fallbacks, and import behavior.
- Do not depend on DatoCMS private `MediaCard` classes or copy the admin stylesheet.

---

### Task 1: Contained Native-Style Image Previews

**Files:**
- Modify: `src/ui/ImagePicker.tsx:132-155`
- Modify: `src/ui/ImagePicker.tsx:166-174`
- Modify: `src/ui/ImagePicker.tsx:208-231`
- Modify: `src/ui/ImportModal.css:731-800`
- Modify: `src/ui/ImportModal.css:1191-1194`
- Test: `src/ui/ImportModal.css.test.ts`
- Test: `src/ui/ImportModal.test.tsx`

**Interfaces:**
- Consumes: existing `NormalizedImageCandidate`, preview URL selection, `previewFailed` state, and image-selection handlers.
- Produces: `.movie-import-modal__image-canvas`, a presentational wrapper shared by poster, backdrop, and fallback previews.

- [x] **Step 1: Add failing CSS contract coverage**

Extend `src/ui/ImportModal.css.test.ts` with:

```ts
it('contains complete media previews inside a fixed native-style canvas', () => {
  const canvasRule = ruleFor('.movie-import-modal__image-canvas');
  const imageRule = ruleFor('.movie-import-modal__image-thumb');
  const posterRule = ruleFor('.movie-import-modal__image-thumb--poster');
  const backdropRule = ruleFor('.movie-import-modal__image-thumb--backdrop');

  expect(canvasRule).toContain('align-items: center');
  expect(canvasRule).toContain('height: 160px');
  expect(canvasRule).toContain('justify-content: center');
  expect(canvasRule).toContain('background: var(--color--surface)');
  expect(imageRule).toContain('height: auto');
  expect(imageRule).toContain('max-height: 100%');
  expect(imageRule).toContain('max-width: 100%');
  expect(imageRule).toContain('object-fit: contain');
  expect(imageRule).toContain('width: auto');
  expect(posterRule).not.toContain('aspect-ratio');
  expect(backdropRule).not.toContain('aspect-ratio');
});
```

- [x] **Step 2: Run the CSS test to verify it fails**

Run:

```bash
npm test -- src/ui/ImportModal.css.test.ts
```

Expected: FAIL because `.movie-import-modal__image-canvas` does not exist and the thumbnail still uses `object-fit: cover` with forced aspect ratios.

- [x] **Step 3: Add failing DOM-structure coverage**

In the existing Review-step image-picker test in `src/ui/ImportModal.test.tsx`, assert that every rendered candidate image has a dedicated canvas parent:

```ts
const candidateImages = screen.getAllByRole('img', { name: /option \d+/i });

expect(candidateImages.length).toBeGreaterThan(0);
candidateImages.forEach((image) => {
  expect(image.parentElement).toHaveClass('movie-import-modal__image-canvas');
});
```

- [x] **Step 4: Run the focused component test to verify it fails**

Run:

```bash
npm test -- src/ui/ImportModal.test.tsx
```

Expected: FAIL because candidate images are direct children of `.movie-import-modal__image-preview`.

- [x] **Step 5: Add the shared preview-canvas markup**

In `ImageOption`, wrap the current image/fallback branch without moving its metadata:

```tsx
<span className="movie-import-modal__image-preview">
  <span className="movie-import-modal__image-canvas">
    {!previewFailed ? (
      <img
        className={`movie-import-modal__image-thumb movie-import-modal__image-thumb--${image.type}`}
        src={image.previewUrl ?? image.originalUrl}
        alt={`${capitalize(imageKind)} option ${optionNumber}`}
        loading="lazy"
        width={120}
        height={image.type === 'poster' ? 180 : 68}
        onError={() => setPreviewFailed(true)}
      />
    ) : (
      <span className="movie-import-modal__image-fallback" role="img" aria-label={`${imageKind} preview unavailable`}>
        Preview unavailable
      </span>
    )}
  </span>
  <span className="movie-import-modal__image-meta">{provider} · {dimensions} · {language}</span>
</span>
```

Apply the same canvas wrapper around the image/fallback branch in `BackdropDestinationOption`. Wrap the `No image` fallback in `NoHeroImageOption` so empty and loaded options keep the same preview geometry.

- [x] **Step 6: Implement contained image fitting**

Replace the current thumbnail sizing rules in `src/ui/ImportModal.css` with:

```css
.movie-import-modal__image-canvas {
  align-items: center;
  background: var(--color--surface);
  border-radius: 4px;
  display: flex;
  height: 160px;
  justify-content: center;
  overflow: hidden;
  width: 100%;
}

.movie-import-modal__image-thumb {
  border-radius: 4px;
  display: block;
  height: auto;
  max-height: 100%;
  max-width: 100%;
  object-fit: contain;
  width: auto;
}

```

Remove the existing poster and backdrop rules that force aspect ratios and maximum widths. Keep the fallback visually neutral and size it within the canvas. In the existing narrow media query, preserve the compact preview padding and add:

```css
.movie-import-modal__image-canvas {
  height: 140px;
}
```

- [x] **Step 7: Run focused tests**

Run:

```bash
npm test -- src/ui/ImportModal.css.test.ts src/ui/ImportModal.test.tsx
```

Expected: PASS.

- [x] **Step 8: Run complete verification**

Run:

```bash
npm test
npm run lint
npm run build
node /Users/roger.tinch/.agents/skills/impeccable/scripts/detect.mjs --json src/ui/ImagePicker.tsx src/ui/ImportModal.css
```

Expected: all tests, type checks, lint, and production build pass; the Impeccable detector reports no unresolved mechanical UI findings for the changed targets.

- [x] **Step 9: Verify rendered behavior**

Run the visual harness and inspect the Review Changes image section in both light and DatoCMS dark themes:

```bash
npm run dev
```

Verify:

- poster, Hero Image, and Other Images previews show their complete images;
- wide and tall candidates are centered with neutral surrounding space;
- card rows remain aligned;
- metadata and caption controls do not move into the preview canvas;
- fallback cards have the same preview height;
- selected and unselected card surfaces match the native DatoCMS pattern;
- keyboard focus remains visible.

- [ ] **Step 10: Commit after explicit user approval**

Stage only the approved files and use the repository's committing workflow. Do not commit, merge, or push without separate explicit user requests.
