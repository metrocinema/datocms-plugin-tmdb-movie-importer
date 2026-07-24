# Field Review Table Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Review changes field-list layout with a denser table-style comparison where Current and Proposed are true column headers and each proposed value remains the editor’s selection target.

**Architecture:** Keep the existing field comparison data and `onToggle(key)` callback. Refactor only the presentation in `FieldDiffTable` so desktop renders a semantic comparison table and narrow screens collapse into stacked review cards. Preserve the real checkbox input for accessibility while making the Proposed cell the large click target.

**Tech Stack:** React, TypeScript, DatoCMS React UI, CSS with DatoCMS tokens, Vitest, Testing Library.

**Execution Status:** Implemented on 2026-07-24. The final implementation used a full-width Proposed-cell `<label>` with one native checkbox per row instead of the originally drafted checkbox-inside-button helper, after accessibility review flagged nested interactive controls as invalid.

## Global Constraints

- Do not change import execution, person resolution, image selection, TMDB normalization, or DatoCMS write behavior.
- Preserve the existing toolbar actions: `Select all changes` and `Clear all`.
- Preserve editor-facing field labels from `movieFieldLabels`.
- Preserve the disabled behavior for unavailable or unchanged rows.
- Preserve safety behavior: missing TMDB values never clear existing editorial content.
- The Proposed cell is the large selectable target, but each row still contains a real checkbox with the accessible name `Select ${field label}`.
- On small screens, do not force a cramped spreadsheet; collapse each row into stacked Current and Proposed sections.

---

## File Structure

- Modify `src/ui/FieldDiffTable.tsx`
  - Replace article/dl rows with a semantic field review table.
  - Keep the same props and callback contract.
  - Keep badges beside field labels.
  - Render one checkbox inside each Proposed cell.
- Modify `src/ui/ImportModal.css`
  - Add table, selected Proposed-cell, disabled row, focus, and mobile stacked styles.
  - Remove or retire field-row/diff styles only when no other component uses them.
- Modify `src/ui/ImportModal.test.tsx`
  - Add behavior and accessibility coverage for table headers and Proposed-cell selection.
  - Preserve existing modal data-flow tests.
- Modify `docs/superpowers/plans/2026-07-23-find-movie-modal-ui-redesign.md`
  - Add a short follow-up status note after implementation.

---

### Task 1: Lock the field-review table behavior with tests

**Files:**
- Modify: `src/ui/ImportModal.test.tsx`

**Interfaces:**
- Consumes: existing `ImportModal`, `reachReview()`, `movie`, and Testing Library helpers.
- Produces: tests that require `Field`, `Current`, and `Proposed` column headers and verify Proposed-cell selection toggles the existing field checkbox.

- [ ] **Step 1: Add table-header assertions to the review framing test**

In the `frames the selected movie review with field, image, and people sections` test, after the existing `Field changes` heading assertion, add:

```ts
const fieldChangesSection = screen.getByRole('heading', { name: 'Field changes' }).closest('section')!;
expect(within(fieldChangesSection).getByRole('columnheader', { name: 'Field' })).toBeInTheDocument();
expect(within(fieldChangesSection).getByRole('columnheader', { name: 'Current' })).toBeInTheDocument();
expect(within(fieldChangesSection).getByRole('columnheader', { name: 'Proposed' })).toBeInTheDocument();
expect(within(fieldChangesSection).getByRole('table', { name: 'Field changes' })).toBeInTheDocument();
```

- [ ] **Step 2: Add a Proposed-cell selection test**

In `describe('ImportModal data flow', ...)`, add this test:

```tsx
it('lets editors select a field change from the proposed value cell', async () => {
  render(
    <ImportModal
      initialTitle="Example"
      initialYear={2024}
      currentValues={{ title: 'Existing title', runtime: null }}
      mappedFields={['title', 'runtime']}
      searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]}
      loadMovie={async () => movie}
      resolvePeople={async () => []}
      execute={vi.fn()}
    />,
  );

  await reachReview();

  const titleCheckbox = screen.getByRole('checkbox', { name: 'Select Title' });
  expect(titleCheckbox).not.toBeChecked();

  await userEvent.click(screen.getByRole('button', { name: 'Apply proposed Title value' }));

  expect(titleCheckbox).toBeChecked();
});
```

- [ ] **Step 3: Add a disabled Proposed-cell assertion**

In the same test file, add:

```tsx
it('does not expose a clickable proposed cell for unavailable TMDB values', async () => {
  render(
    <ImportModal
      initialTitle="Example"
      initialYear={2024}
      currentValues={{ tagline: 'Existing tagline' }}
      mappedFields={['tagline']}
      searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]}
      loadMovie={async () => ({ ...movie, tagline: null })}
      resolvePeople={async () => []}
      execute={vi.fn()}
    />,
  );

  await reachReview();

  expect(screen.getByText('No TMDB value available')).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: 'Select Tagline' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Apply proposed Tagline value' })).not.toBeInTheDocument();
});
```

- [ ] **Step 4: Run the targeted test and verify it fails**

Run:

```bash
npm test -- src/ui/ImportModal.test.tsx
```

Expected: FAIL because `FieldDiffTable` does not yet render table headers or Proposed-cell buttons.

---

### Task 2: Refactor FieldDiffTable into a semantic comparison table

**Files:**
- Modify: `src/ui/FieldDiffTable.tsx`

**Interfaces:**
- Consumes: `comparisons: FieldComparison[]`, `onToggle(key)`, `onSelectAll()`, `onClearAll()`, `overwriteCount`, `emptyFillCount`.
- Produces: the same UI behavior plus a semantic `<table aria-label="Field changes">`.

- [ ] **Step 1: Replace row articles with a table**

Keep the toolbar unchanged. Replace the comparison mapping block with:

```tsx
<table className="movie-import-modal__field-table" aria-label="Field changes">
  <thead>
    <tr>
      <th scope="col">Field</th>
      <th scope="col">Current</th>
      <th scope="col">Proposed</th>
    </tr>
  </thead>
  <tbody>
    {comparisons.map((comparison) => {
      const fieldLabel = movieFieldLabels[comparison.key];
      const canSelect = comparison.available && comparison.changed;
      const isOverwrite = canSelect && !isEmptyValue(comparison.currentValue);
      const isEmptyFill = canSelect && isEmptyValue(comparison.currentValue);

      return (
        <tr key={comparison.key} className={comparison.selected && canSelect ? 'movie-import-modal__field-table-row movie-import-modal__field-table-row--selected' : 'movie-import-modal__field-table-row'}>
          <th scope="row" className="movie-import-modal__field-table-field">
            <span className="movie-import-modal__field-title">{fieldLabel}</span>
            <span className="movie-import-modal__field-badges">
              {isOverwrite ? <span className="movie-import-modal__badge movie-import-modal__badge--warning">Overwrites value</span> : null}
              {isEmptyFill ? <span className="movie-import-modal__badge movie-import-modal__badge--success">Fills empty field</span> : null}
              {!comparison.available ? <span className="movie-import-modal__badge movie-import-modal__badge--neutral">No TMDB value</span> : null}
              {comparison.available && !comparison.changed ? <span className="movie-import-modal__badge movie-import-modal__badge--neutral">Already matches</span> : null}
            </span>
          </th>
          <td className="movie-import-modal__field-table-value" data-label="Current">
            {formatReviewValue(comparison.key, comparison.currentValue)}
          </td>
          <td className="movie-import-modal__field-table-value movie-import-modal__field-table-proposed" data-label="Proposed">
            <ProposedFieldCell comparison={comparison} fieldLabel={fieldLabel} canSelect={canSelect} onToggle={onToggle} />
          </td>
        </tr>
      );
    })}
  </tbody>
</table>
```

- [ ] **Step 2: Add the ProposedFieldCell helper**

Below `FieldDiffTable`, add:

```tsx
function ProposedFieldCell({
  comparison,
  fieldLabel,
  canSelect,
  onToggle,
}: {
  comparison: FieldComparison;
  fieldLabel: string;
  canSelect: boolean;
  onToggle: (key: FieldComparison['key']) => void;
}) {
  const value = comparison.available ? formatReviewValue(comparison.key, comparison.proposedValue) : 'No TMDB value available';

  if (!canSelect) {
    return (
      <label className="movie-import-modal__field-table-choice movie-import-modal__field-table-choice--disabled" style={touchTargetStyle}>
        <input aria-label={`Select ${fieldLabel}`} type="checkbox" checked={false} disabled />
        <span>{value}</span>
      </label>
    );
  }

  return (
    <button className="movie-import-modal__field-table-choice" type="button" onClick={() => onToggle(comparison.key)} aria-label={`Apply proposed ${fieldLabel} value`} aria-pressed={comparison.selected} style={touchTargetStyle}>
      <input aria-label={`Select ${fieldLabel}`} type="checkbox" checked={comparison.selected} readOnly tabIndex={-1} />
      <span>{value}</span>
    </button>
  );
}
```

- [ ] **Step 3: Remove the unused `detailed` branch**

Delete the `const detailed = isDetailedField(comparison);` line and remove the `isDetailedField()` function. Long text is now handled by table-cell wrapping and mobile stacked styles.

- [ ] **Step 4: Run the targeted test and verify it passes functionally**

Run:

```bash
npm test -- src/ui/ImportModal.test.tsx
```

Expected: PASS or fail only on styling-independent accessible-role issues. Fix accessible names before moving to CSS.

---

### Task 3: Add DatoCMS-native table styling and responsive collapse

**Files:**
- Modify: `src/ui/ImportModal.css`

**Interfaces:**
- Consumes: classes from `FieldDiffTable`: `movie-import-modal__field-table`, `movie-import-modal__field-table-row`, `movie-import-modal__field-table-row--selected`, `movie-import-modal__field-table-field`, `movie-import-modal__field-badges`, `movie-import-modal__field-table-value`, `movie-import-modal__field-table-proposed`, `movie-import-modal__field-table-choice`, `movie-import-modal__field-table-choice--disabled`.
- Produces: desktop table layout and mobile stacked row layout.

- [ ] **Step 1: Replace field-row/diff styles with table styles**

In `src/ui/ImportModal.css`, remove the old `.movie-import-modal__field-row`, `.movie-import-modal__diff`, and `.movie-import-modal__check` rules if no remaining component uses those classes. Add:

```css
.movie-import-modal__field-table {
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  width: 100%;
}

.movie-import-modal__field-table th,
.movie-import-modal__field-table td {
  border-top: 1px solid var(--color--border);
  padding: var(--spacing-s) var(--spacing-m);
  text-align: left;
  vertical-align: top;
}

.movie-import-modal__field-table thead th {
  color: var(--color--ink-muted);
  font-size: var(--font-size-s);
  font-weight: 600;
}

.movie-import-modal__field-table thead th:first-child {
  width: 28%;
}

.movie-import-modal__field-table thead th:nth-child(2) {
  width: 30%;
}

.movie-import-modal__field-table thead th:nth-child(3) {
  width: 42%;
}

.movie-import-modal__field-table tbody tr:first-child th,
.movie-import-modal__field-table tbody tr:first-child td {
  border-top-color: var(--color--border);
}

.movie-import-modal__field-table-field {
  color: var(--color--ink);
  font-weight: 600;
}

.movie-import-modal__field-title {
  display: block;
  margin: 0 0 var(--spacing-xs);
}

.movie-import-modal__field-badges {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.movie-import-modal__field-table-value {
  color: var(--color--ink);
  overflow-wrap: anywhere;
}

.movie-import-modal__field-table-proposed {
  padding: var(--spacing-xs);
}

.movie-import-modal__field-table-choice {
  align-items: flex-start;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: inherit;
  cursor: pointer;
  display: flex;
  gap: var(--spacing-s);
  min-height: 44px;
  padding: var(--spacing-s);
  text-align: left;
  width: 100%;
}

.movie-import-modal__field-table-choice:hover {
  background: var(--color--primary-soft--surface);
}

.movie-import-modal__field-table-choice:focus-visible {
  box-shadow: 0 0 0 4px var(--color--focus--outline);
  outline: 0;
}

.movie-import-modal__field-table-choice input {
  flex: 0 0 auto;
  margin-top: 0.2em;
}

.movie-import-modal__field-table-row--selected .movie-import-modal__field-table-choice {
  background: var(--color--selected--surface, var(--color--primary-soft--surface));
  border-color: var(--color--selected--border, var(--color--primary-soft--border));
  color: var(--color--selected--ink, var(--color--ink));
}

.movie-import-modal__field-table-choice--disabled {
  color: var(--color--ink-muted);
  cursor: not-allowed;
}

.movie-import-modal__field-table-choice--disabled:hover {
  background: transparent;
}
```

- [ ] **Step 2: Add mobile stacked table styles**

Inside the existing `@media (max-width: 540px)` block, replace `.movie-import-modal__field-row` references with:

```css
.movie-import-modal__field-table,
.movie-import-modal__field-table thead,
.movie-import-modal__field-table tbody,
.movie-import-modal__field-table tr,
.movie-import-modal__field-table th,
.movie-import-modal__field-table td {
  display: block;
}

.movie-import-modal__field-table thead {
  border: 0;
  clip: rect(0 0 0 0);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  padding: 0;
  position: absolute;
  white-space: nowrap;
  width: 1px;
}

.movie-import-modal__field-table-row {
  border-top: 1px solid var(--color--border);
  display: grid;
  gap: var(--spacing-xs);
  padding: var(--spacing-m) 0;
}

.movie-import-modal__field-table th,
.movie-import-modal__field-table td {
  border-top: 0;
  padding: 0;
}

.movie-import-modal__field-table-value::before {
  color: var(--color--ink-muted);
  content: attr(data-label);
  display: block;
  font-size: var(--font-size-s);
  font-weight: 600;
  margin-bottom: var(--spacing-xxs, 4px);
}

.movie-import-modal__field-table-proposed {
  padding: 0;
}
```

- [ ] **Step 3: Run detector after CSS edits**

Run:

```bash
node /Users/roger.tinch/.agents/skills/impeccable/scripts/detect.mjs --json src/ui/FieldDiffTable.tsx src/ui/ImportModal.css
```

Expected: `[]`. Fix any real findings before continuing.

---

### Task 4: Verify the full Review changes flow

**Files:**
- Verify: `src/ui/FieldDiffTable.tsx`
- Verify: `src/ui/ImportModal.css`
- Verify: `src/ui/ImportModal.test.tsx`
- Modify: `docs/superpowers/plans/2026-07-23-find-movie-modal-ui-redesign.md`

**Interfaces:**
- Consumes: the completed table layout.
- Produces: verified UI behavior and updated implementation status.

- [ ] **Step 1: Run targeted UI tests**

Run:

```bash
npm test -- src/ui/ImportModal.test.tsx src/ui/modalPresentation.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full automated verification**

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

Expected:

- `npm test` passes all test files.
- `npm run typecheck` exits 0.
- `npm run lint` exits 0.
- `npm run build` exits 0.
- `git diff --check` exits 0.

- [ ] **Step 3: Browser smoke test the harness**

Open:

```text
http://localhost:5174/?impeccable=modal
```

Expected:

- Field changes appears as a table at desktop width.
- `Current` and `Proposed` appear once as column headers.
- Clicking a Proposed cell toggles that field.
- `Select all changes` and `Clear all` still work.
- The sticky footer summary updates when rows are selected or cleared.
- At narrow width, rows collapse into stacked Current and Proposed sections.

- [ ] **Step 4: Update the existing implementation plan status**

Append this note to `docs/superpowers/plans/2026-07-23-find-movie-modal-ui-redesign.md`:

```md
Field review table follow-up:

- Field changes now renders as a semantic Current/Proposed comparison table.
- The Proposed cell is the large selection target while preserving a real checkbox for accessibility.
- Mobile layouts collapse rows into stacked Current and Proposed blocks to avoid cramped spreadsheet behavior.
- Import execution, image selection, person resolution, and DatoCMS write behavior were not changed.
```

- [ ] **Step 5: Review working tree**

Run:

```bash
git status --short
git diff --stat
```

Expected: only the field table files, related tests, and documentation plan status changed, plus any pre-existing untracked Impeccable critique artifact intentionally left uncommitted.

---

## Self-Review

- Spec coverage: The plan covers Current/Proposed column headers, Proposed-cell selection, accessible checkbox preservation, disabled unavailable rows, responsive collapse, and full verification.
- Placeholder scan: No placeholder tasks are included. Each test and implementation step gives exact code or exact commands.
- Type consistency: `FieldComparison['key']`, `movieFieldLabels`, `formatReviewValue`, `touchTargetStyle`, and `onToggle(key)` match the existing component contract.
