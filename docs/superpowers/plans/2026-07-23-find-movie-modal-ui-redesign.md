# Find Movie Modal UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the TMDB movie importer modal into a clearer guided wizard while preserving its existing data flow and write behavior.

**Architecture:** Keep the current `ImportModal` state machine and domain modules intact. Add small presentational UI components around the existing `SearchStep`, `ReviewStep`, and `ConfirmStep` so editor-facing structure improves without changing TMDB normalization, person matching, image selection, or DatoCMS import execution.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, DatoCMS Plugin SDK.

## Global Constraints

- The modal remains a three-step flow: Find movie, Review changes, Confirm import.
- No DatoCMS creates, uploads, form changes, saves, or publishes occur before final confirmation.
- The final action text remains `Apply to unsaved movie`.
- The UI uses editor-facing labels: Title, Year released, MPAA rating, Runtime, TMDB ID, Tagline, Description, Poster, Hero image, Other images, Directors, Actors.
- Hero image and Other images currently come from TMDB backdrops.
- Preserve future image-source flexibility by keeping provider-specific logic outside modal presentation.
- Do not redesign the plugin settings screen.
- Do not introduce a backend service.

---

## File Structure

- Modify `src/ui/ImportModal.tsx`
  - Pass selected movie context into the review step.
  - Keep the existing step state, import plan construction, and execute call unchanged.
- Modify `src/ui/SearchStep.tsx`
  - Add guided wizard framing for the find step.
  - Split title/year search from direct TMDB ID lookup.
  - Render search results as cards.
- Modify `src/ui/ReviewStep.tsx`
  - Add selected movie summary.
  - Group Field changes, Images, and People.
  - Show plain-language blocking guidance for ambiguous people.
- Modify `src/ui/ConfirmStep.tsx`
  - Add compact summary counts and safety copy.
- Modify `src/ui/FieldDiffTable.tsx`
  - Replace raw field keys with editor labels.
  - Render current/proposed values with clearer row structure.
- Modify `src/ui/ImagePicker.tsx`
  - Group poster and backdrop candidates with editor labels.
  - Explain Hero image / Other images relationship to TMDB backdrops.
- Modify `src/ui/PersonResolutionList.tsx`
  - Group directors and actors.
  - Improve state labels for reuse, create, and ambiguous choices.
- Create `src/ui/modalPresentation.ts`
  - Export reusable label and formatting helpers.
- Create `src/ui/modalPresentation.test.ts`
  - Unit tests for labels, movie summary formatting, image grouping labels, and confirm counts.
- Modify `src/ui/ImportModal.test.tsx`
  - Add component coverage for the new modal structure while preserving existing data-flow assertions.

---

### Task 1: Add modal presentation helpers

**Files:**
- Create: `src/ui/modalPresentation.ts`
- Create: `src/ui/modalPresentation.test.ts`

**Interfaces:**
- Produces: `movieFieldLabels: Record<MovieFieldKey, string>`
- Produces: `formatRuntime(minutes: number | null): string`
- Produces: `formatYear(year: number | null): string`
- Produces: `formatEmptyValue(value: unknown): string`
- Produces: `countConfirmSummary(plan: ImportPlan): { fieldChanges: number; peopleToCreate: number; peopleToReuse: number; imagesToUpload: number }`

- [ ] **Step 1: Write the failing helper tests**

Add `src/ui/modalPresentation.test.ts` with assertions for:

```ts
expect(movieFieldLabels.yearReleased).toBe('Year released');
expect(movieFieldLabels.mpaaRating).toBe('MPAA rating');
expect(movieFieldLabels.tmdbId).toBe('TMDB ID');
expect(movieFieldLabels.heroImage).toBe('Hero image');
expect(movieFieldLabels.backdrops).toBe('Other images');
expect(formatRuntime(125)).toBe('125 min');
expect(formatRuntime(null)).toBe('Not available');
expect(formatYear(2024)).toBe('2024');
expect(formatYear(null)).toBe('Unknown year');
expect(formatEmptyValue(null)).toBe('Empty');
expect(formatEmptyValue('')).toBe('Empty');
expect(formatEmptyValue('A useful tagline')).toBe('A useful tagline');
```

Also create a minimal `ImportPlan` object and assert:

```ts
expect(countConfirmSummary(plan)).toEqual({
  fieldChanges: 2,
  peopleToCreate: 1,
  peopleToReuse: 1,
  imagesToUpload: 2,
});
```

- [ ] **Step 2: Run the helper test and verify it fails**

Run: `npm test -- src/ui/modalPresentation.test.ts`

Expected: FAIL because `src/ui/modalPresentation.ts` does not exist.

- [ ] **Step 3: Implement the helpers**

Create `src/ui/modalPresentation.ts` with pure functions only. Import `MovieFieldKey` and `ImportPlan` as types. Keep formatting intentionally plain.

- [ ] **Step 4: Run the helper test and verify it passes**

Run: `npm test -- src/ui/modalPresentation.test.ts`

Expected: PASS.

---

### Task 2: Redesign the Find movie step

**Files:**
- Modify: `src/ui/SearchStep.tsx`
- Modify: `src/ui/ImportModal.test.tsx`

**Interfaces:**
- Consumes: `TmdbSearchResult`
- Produces: Existing `onSearch`, `onSelect`, and `onLoadTmdbId` behavior remains unchanged.

- [ ] **Step 1: Write failing component assertions**

In `src/ui/ImportModal.test.tsx`, add coverage that renders the search step and expects:

```ts
expect(screen.getByText('Find movie')).toBeInTheDocument();
expect(screen.getByText('Find the TMDB record that matches this DatoCMS movie.')).toBeInTheDocument();
expect(screen.getByText('Find movie')).toBeInTheDocument();
expect(screen.getByText('Review changes')).toBeInTheDocument();
expect(screen.getByText('Confirm import')).toBeInTheDocument();
expect(screen.getByRole('group', { name: 'Search by title and year' })).toBeInTheDocument();
expect(screen.getByRole('group', { name: 'Lookup by TMDB ID' })).toBeInTheDocument();
```

After clicking Search, assert a result card includes:

```ts
expect(screen.getByText('Example Movie')).toBeInTheDocument();
expect(screen.getByText('2024')).toBeInTheDocument();
expect(screen.getByText('Overview text')).toBeInTheDocument();
expect(screen.getByText('TMDB ID 123')).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Use Example Movie' })).toBeInTheDocument();
```

- [ ] **Step 2: Run the targeted test and verify it fails**

Run: `npm test -- src/ui/ImportModal.test.tsx`

Expected: FAIL because the search step still renders the older simple layout.

- [ ] **Step 3: Implement the search step UI**

Update `SearchStep` to:

- Render a shared-looking step indicator as an ordered list.
- Wrap title/year controls in `<fieldset aria-label="Search by title and year">`.
- Wrap TMDB ID lookup in `<fieldset aria-label="Lookup by TMDB ID">`.
- Render result cards with title, year, overview snippet, TMDB ID, optional poster image, and `Use ${result.title}` button.
- Keep the same callback props and avoid new async behavior.

- [ ] **Step 4: Run the targeted test and verify it passes**

Run: `npm test -- src/ui/ImportModal.test.tsx`

Expected: PASS.

---

### Task 3: Redesign the Review changes step

**Files:**
- Modify: `src/ui/ImportModal.tsx`
- Modify: `src/ui/ReviewStep.tsx`
- Modify: `src/ui/FieldDiffTable.tsx`
- Modify: `src/ui/ImagePicker.tsx`
- Modify: `src/ui/PersonResolutionList.tsx`
- Modify: `src/ui/ImportModal.test.tsx`

**Interfaces:**
- Consumes: `movie: NormalizedMovie`
- Produces: `ReviewStep` prop `movie: NormalizedMovie`
- Keeps existing props for comparisons, people, images, selected image IDs, and callbacks.

- [ ] **Step 1: Write failing review assertions**

Add or update a test that reaches the review step and expects:

```ts
expect(screen.getByText('Selected movie')).toBeInTheDocument();
expect(screen.getByText('Example Movie')).toBeInTheDocument();
expect(screen.getByText('PG-13')).toBeInTheDocument();
expect(screen.getByText('125 min')).toBeInTheDocument();
expect(screen.getByRole('region', { name: 'Field changes' })).toBeInTheDocument();
expect(screen.getByRole('region', { name: 'Images' })).toBeInTheDocument();
expect(screen.getByRole('region', { name: 'People' })).toBeInTheDocument();
expect(screen.getByText('Title')).toBeInTheDocument();
expect(screen.getByText('Poster')).toBeInTheDocument();
expect(screen.getByText('Hero image')).toBeInTheDocument();
expect(screen.getByText('Other images')).toBeInTheDocument();
expect(screen.getByText('Directors')).toBeInTheDocument();
expect(screen.getByText('Actors')).toBeInTheDocument();
```

Update the ambiguous-person test to expect:

```ts
expect(screen.getByText('Resolve this person before continuing.')).toBeInTheDocument();
```

- [ ] **Step 2: Run the targeted test and verify it fails**

Run: `npm test -- src/ui/ImportModal.test.tsx`

Expected: FAIL because the review step does not yet include these regions and labels.

- [ ] **Step 3: Pass selected movie into `ReviewStep`**

In `ImportModal`, pass `movie={movie}` to `ReviewStep`. In the review branch, `movie` is already non-null after successful load. Guard with the existing fallback only if TypeScript requires it.

- [ ] **Step 4: Implement the review frame**

Update `ReviewStep` to render:

- Step indicator.
- Selected movie summary with title, year, rating, runtime, and TMDB ID.
- `<section aria-label="Field changes">`
- `<section aria-label="Images">`
- `<section aria-label="People">`
- Ambiguous-person notice above Continue when needed.

- [ ] **Step 5: Improve field diff rows**

Update `FieldDiffTable` to import `movieFieldLabels` and `formatEmptyValue`. Render each comparison as a row with:

- Checkbox with label `Select ${movieFieldLabels[comparison.key]}`.
- Destination label.
- Current value.
- Proposed value.
- `No TMDB value available` for unavailable rows.

- [ ] **Step 6: Improve image picker grouping**

Update `ImagePicker` to split `images` into posters and backdrops. Render labels and helper copy:

- `Poster`
- `Hero image`
- `Other images`
- `Hero image and Other images use selected TMDB backdrops in this version.`

Keep checkbox behavior using `providerImageId`.

- [ ] **Step 7: Improve people grouping**

Update `PersonResolutionList` to split people by `candidate.role`. Render:

- `Directors`
- `Actors`
- `Will reuse existing person`
- `Will create new draft person`
- `Resolve this person before continuing.`

Keep the existing `<select>` resolution behavior and labels compatible with current tests.

- [ ] **Step 8: Run the targeted test and verify it passes**

Run: `npm test -- src/ui/ImportModal.test.tsx`

Expected: PASS.

---

### Task 4: Redesign the Confirm import step

**Files:**
- Modify: `src/ui/ConfirmStep.tsx`
- Modify: `src/ui/ImportModal.test.tsx`

**Interfaces:**
- Consumes: `countConfirmSummary(plan: ImportPlan)`
- Produces: Existing `onConfirm` behavior remains unchanged.

- [ ] **Step 1: Write failing confirm assertions**

Update the test that reaches confirmation and expects:

```ts
expect(screen.getByText('Import summary')).toBeInTheDocument();
expect(screen.getByText('Field changes')).toBeInTheDocument();
expect(screen.getByText('People to create')).toBeInTheDocument();
expect(screen.getByText('People to reuse')).toBeInTheDocument();
expect(screen.getByText('Images to upload')).toBeInTheDocument();
expect(screen.getByText('The plugin applies values to the current unsaved DatoCMS movie form.')).toBeInTheDocument();
expect(screen.getByText('It does not save or publish the movie.')).toBeInTheDocument();
expect(screen.getByText('Created people and uploaded images may remain in DatoCMS if a later form update fails.')).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Apply to unsaved movie' })).toBeInTheDocument();
```

- [ ] **Step 2: Run the targeted test and verify it fails**

Run: `npm test -- src/ui/ImportModal.test.tsx`

Expected: FAIL because the confirm step still shows only simple count paragraphs.

- [ ] **Step 3: Implement the confirm summary**

Update `ConfirmStep` to:

- Render the step indicator.
- Render `Import summary`.
- Show four count rows from `countConfirmSummary`.
- Render the safety note exactly as asserted.
- Keep the final button and `onConfirm` callback unchanged.

- [ ] **Step 4: Run the targeted test and verify it passes**

Run: `npm test -- src/ui/ImportModal.test.tsx`

Expected: PASS.

---

### Task 5: Full verification and documentation status

**Files:**
- Verify: all changed files
- Modify docs only if implementation materially diverges from the spec.

- [ ] **Step 1: Run all unit and component tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Review working tree**

Run: `git status --short`

Expected: Only the modal UI redesign files, the spec, and this plan should appear as new or modified for this pass, plus any pre-existing uncommitted plugin work that remains intentionally unstaged.

- [ ] **Step 5: Manual browser smoke test**

Run: `npm run dev`

Expected: Vite starts on port 5174. In the DatoCMS sandbox plugin configuration, the modal opens from the TMDB ID field and shows the redesigned Find, Review, and Confirm screens.

---

## Follow-up DatoCMS UI-kit audit amendment

The Impeccable audit expanded the UI polish pass beyond the original modal-only boundary to address DatoCMS-native component usage in the plugin field add-on and settings screen. This follow-up keeps the same importer data flow: the modal prepares and resolves an import plan, then the field-extension host executes the real DatoCMS creates, uploads, and unsaved form updates after the modal closes.

Additional completed scope:

- Use Dato `Button` for the TMDB ID field add-on action.
- Use Dato `Form`, `Section`, `FieldHint`, and `FieldError` in plugin settings while preserving the existing configuration fields.
- Add busy states for TMDB search, direct TMDB ID loading, and modal plan submission.
- Keep final confirmation copy accurate: the modal shows `Preparing import` while submitting the plan, not while performing downstream DatoCMS writes.
- Replace ambiguous-person resolution with Dato `SelectField`.
- Remove duplicate review-section landmarks and let Dato `Section` own visual section structure.
- Add lazy image loading, explicit image dimensions, and 44px minimum touch targets for custom review controls.
- Make failure copy safe for partial side effects: DatoCMS drafts or uploads may already exist if execution fails after dependency writes begin.

Verification after review fixes:

- `npm test` passed with 19 files and 110 tests.
- `npm run build` passed typecheck and production build.
- `git diff --check` passed.
- Impeccable detector returned no findings for the touched UI files.
- Superpowers code review rereview found no remaining Critical or Important issues.
