# Import Progress States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the DatoCMS movie-import modal open during slow work and show native, phase-based progress for TMDB search, movie loading, Person preparation, and image uploads.

**Architecture:** Split the current import executor into a modal-safe preparation operation and a field-context application operation. The modal prepares Person and asset dependencies while emitting real progress events, then resolves with a URL-free prepared result; the field extension applies those prepared values to the unsaved movie form.

**Tech Stack:** React, TypeScript, DatoCMS Plugin SDK 2.2.6, `datocms-react-ui` 2.2.6, Vitest, Testing Library, Vite

## Global Constraints

- Use the indeterminate `Spinner` from `datocms-react-ui`.
- Report real phase labels and completed-item counts; do not show percentages or time estimates.
- Keep Person preparation and image uploads concurrent.
- Keep the image-upload concurrency limit at exactly five.
- Only the field-extension context may call `setFieldValue`.
- Do not serialize access tokens, TMDB credentials, image source URLs, or other secrets in the prepared result.
- Do not permit cancellation, navigation, or automatic retry after DatoCMS writes begin.
- Progress callback failures must never interrupt an import.
- Preserve the existing sticky-footer height and left-side import summary.

---

## File Structure

- `src/dato/importExecutor.ts`: Own the preparation result, progress-event contract, dependency preparation, form-value application, and backward-compatible combined executor.
- `src/dato/importExecutor.test.ts`: Prove progress events, sanitized prepared results, concurrency, partial failure, and callback safety.
- `src/dato/importFlow.integration.test.ts`: Prove that preparation performs no form write and application uses prepared IDs.
- `src/ui/SearchStep.tsx`: Render native search and movie-loading feedback.
- `src/ui/ImportProgressStep.tsx`: Render import preparation phases, spinner, failure state, and stable sticky footer.
- `src/ui/ImportModal.tsx`: Own search activity, import progress state, preparation lifecycle, and modal resolution.
- `src/ui/ImportModal.css`: Style the loading and progress views using DatoCMS theme variables.
- `src/ui/ImportModal.test.tsx`: Prove search, movie-loading, progress, failure, focus, and modal-resolution behavior.
- `src/ui/FieldAddon.tsx`: Distinguish opening, preparation handoff, and form-application feedback.
- `src/ui/FieldAddon.test.tsx`: Prove the field-level `Applying imported values…` state.
- `src/App.tsx`: Carry the new modal and field-addon callback contracts.
- `src/main.tsx`: Prepare dependencies in the modal context and apply prepared values in the field-extension context.
- `src/devHarness.tsx`: Provide stable visual scenarios for search and import progress.
- `src/devHarness.test.ts`: Prove harness scenario routing.

---

### Task 1: Split Preparation from Form Application

**Files:**
- Modify: `src/dato/importExecutor.ts`
- Modify: `src/dato/importExecutor.test.ts`
- Modify: `src/dato/importFlow.integration.test.ts`

**Interfaces:**
- Consumes: `ImportPlan`, `PluginParameters`, `DatoGateway`, `NormalizedImageCandidate`
- Produces:

```ts
export type ImportProgressPhase =
  | 'people_lookup'
  | 'people_create'
  | 'images'
  | 'fields_prepare';

export type ImportProgressEvent = {
  phase: ImportProgressPhase;
  state: 'waiting' | 'active' | 'complete' | 'failed';
  completed: number;
  total: number;
  message?: string;
};

export type PreparedImageReference = {
  providerKey: string;
  providerImageId: string;
  type: NormalizedImageCandidate['type'];
  uploadId: string;
};

export type PreparedPersonReference = {
  candidateTmdbId: number;
  candidateRole: 'director' | 'actor';
  recordId: string;
};

export type PreparedImport = {
  fieldChanges: ImportPlan['fieldChanges'];
  directors: ImportPlan['directors'];
  actors: ImportPlan['actors'];
  people: PreparedPersonReference[];
  images: PreparedImageReference[];
  heroImage: Pick<NormalizedImageCandidate, 'providerKey' | 'providerImageId'> | null;
  otherImages: Array<Pick<NormalizedImageCandidate, 'providerKey' | 'providerImageId'>>;
  createdPeople: string[];
  uploadedAssets: string[];
};

export type PrepareImportResult =
  | { status: 'success'; prepared: PreparedImport }
  | {
      status: 'dependency_failed';
      message: string;
      createdPeople: string[];
      uploadedAssets: string[];
    };

export async function prepareImport(
  plan: ImportPlan,
  params: PluginParameters,
  gateway: DatoGateway,
  options?: ImportExecutorOptions,
): Promise<PrepareImportResult>;

export async function applyPreparedImport(
  prepared: PreparedImport,
  params: PluginParameters,
  gateway: DatoGateway,
  options?: ImportExecutorOptions,
): Promise<ImportResult>;
```

- [ ] **Step 1: Write failing preparation-boundary tests**

Add tests that build a plan with one Person and one poster, then assert:

```ts
const progress: ImportProgressEvent[] = [];
const applyFormValues = vi.fn();

const result = await prepareImport(plan, params, gateway, {
  onProgress: (event) => progress.push(event),
});

expect(result.status).toBe('success');
expect(applyFormValues).not.toHaveBeenCalled();
expect(result.status === 'success' && result.prepared.images).toEqual([
  {
    providerKey: 'tmdb',
    providerImageId: '/poster.jpg',
    type: 'poster',
    uploadId: 'upload-1',
  },
]);
expect(JSON.stringify(result)).not.toContain('image.tmdb.org');
expect(progress).toContainEqual({
  phase: 'images',
  state: 'complete',
  completed: 1,
  total: 1,
});
```

Add a second test that makes `onProgress` throw and expects preparation to succeed.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
npm test -- src/dato/importExecutor.test.ts src/dato/importFlow.integration.test.ts
```

Expected: FAIL because `prepareImport`, `applyPreparedImport`, `PreparedImport`, and `onProgress` do not exist.

- [ ] **Step 3: Add the progress and prepared-result types**

Extend `ImportExecutorOptions` with:

```ts
onProgress?: (event: ImportProgressEvent) => void;
```

Add a callback wrapper that cannot break an import:

```ts
function reportProgress(
  options: ImportExecutorOptions,
  event: ImportProgressEvent,
) {
  try {
    options.onProgress?.(event);
  } catch {
    // Presentation feedback must never interrupt an import.
  }
}
```

Use stable image identities instead of copying `NormalizedImageCandidate` into `PreparedImport`.

- [ ] **Step 4: Extract dependency preparation**

Move Person lookup, Person creation, and image upload work from `executeImportPlan` into `prepareImport`.

Emit actual boundaries:

```ts
reportProgress(options, {
  phase: 'images',
  state: 'active',
  completed: 0,
  total: plan.assetsToUpload.length,
});
```

Advance the completed count inside `mapWithConcurrency`'s completion callback:

```ts
let completedImageCount = 0;

await mapWithConcurrency(
  plan.assetsToUpload,
  5,
  (image) => gateway.uploadImage(image),
  (upload, image, index) => {
    completedUploads[index] = { image, id: upload.id };
    completedImageCount += 1;
    reportProgress(options, {
      phase: 'images',
      state: 'active',
      completed: completedImageCount,
      total: plan.assetsToUpload.length,
    });
  },
);
```

After dependencies finish, emit an active and complete `fields_prepare` phase while constructing the sanitized `PreparedImport`.

- [ ] **Step 5: Extract form-value application**

Move field-path mapping and `gateway.applyFormValues(changes)` into `applyPreparedImport`.

Resolve Person and image destinations from `PreparedImport.people` and `PreparedImport.images`. Preserve structured-text conversion, localized field paths, poster selection, Hero image selection, and Other Images order.

Keep `executeImportPlan` as a compatibility wrapper:

```ts
export async function executeImportPlan(
  plan: ImportPlan,
  params: PluginParameters,
  gateway: DatoGateway,
  options: ImportExecutorOptions = {},
): Promise<ImportResult> {
  const preparation = await prepareImport(plan, params, gateway, options);

  if (preparation.status === 'dependency_failed') {
    return preparation;
  }

  return applyPreparedImport(preparation.prepared, params, gateway, options);
}
```

- [ ] **Step 6: Add integration coverage for the two-stage flow**

Replace the combined-only integration assertion with:

```ts
const preparation = await prepareImport(plan, params, gateway);
expect(preparation.status).toBe('success');
expect(applied).toEqual([]);

if (preparation.status !== 'success') {
  throw new Error('Expected preparation to succeed');
}

const result = await applyPreparedImport(
  preparation.prepared,
  params,
  gateway,
);

expect(result.status).toBe('success');
expect(applied).toEqual([
  { fieldPath: 'title', value: 'Example Movie' },
  { fieldPath: 'directors', value: ['person-1'] },
]);
```

- [ ] **Step 7: Run executor and integration tests**

Run:

```bash
npm test -- src/dato/importExecutor.test.ts src/dato/importFlow.integration.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit the executor split**

```bash
git add src/dato/importExecutor.ts src/dato/importExecutor.test.ts src/dato/importFlow.integration.test.ts
git commit -m "refactor(import): split preparation from form updates"
```

---

### Task 2: Add Find Movie Loading Feedback

**Files:**
- Modify: `src/ui/SearchStep.tsx`
- Modify: `src/ui/ImportModal.tsx`
- Modify: `src/ui/ImportModal.css`
- Modify: `src/ui/ImportModal.test.tsx`

**Interfaces:**
- Consumes: `Spinner` from `datocms-react-ui`
- Produces:

```ts
type SearchActivity =
  | 'searching'
  | 'loading_movie'
  | 'matching_people'
  | null;
```

- [ ] **Step 1: Write failing search-progress tests**

Add deferred-promise tests that assert:

```ts
await userEvent.click(screen.getByRole('button', { name: 'Search' }));

expect(screen.getByRole('status')).toHaveTextContent(
  'Searching TMDB for “Example”…',
);
expect(screen.queryByText('Previous result')).not.toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Searching TMDB' })).toBeDisabled();
```

For result selection, defer `loadMovie` and `resolvePeople`, then assert the status changes from `Loading movie details…` to `Matching directors and actors…` at the corresponding promise boundary.

- [ ] **Step 2: Run the modal tests and verify they fail**

Run:

```bash
npm test -- src/ui/ImportModal.test.tsx
```

Expected: FAIL because no results-area progress status exists and stale results remain rendered.

- [ ] **Step 3: Replace separate busy booleans with activity state**

In `ImportModal.tsx`, use:

```ts
const [searchActivity, setSearchActivity] =
  useState<SearchActivity>(null);
```

At valid title-search start:

```ts
setError(null);
setResults([]);
setHasSearched(false);
setSearchActivity('searching');
```

In `loadSelectedMovie`, set `loading_movie` before `props.loadMovie`, then set `matching_people` immediately before `props.resolvePeople`. Reset the activity in `finally`.

- [ ] **Step 4: Render the native DatoCMS loading state**

Import `Spinner` in `SearchStep.tsx`. Pass `searchActivity` instead of `isSearching` and `isLoadingMovie`.

Render this in the results region while activity is non-null:

```tsx
<div
  className="movie-import-modal__loading-state"
  role="status"
  aria-live="polite"
>
  <Spinner size={40} />
  <p>{searchActivityMessage(searchActivity, title)}</p>
</div>
```

Return:

- `Searching TMDB for “{trimmed title}”…`
- `Loading movie details…`
- `Matching directors and actors…`

Do not render result cards while the loading state is active.

- [ ] **Step 5: Style the loading state**

Add a centered, minimum-height results state using existing Dato variables:

```css
.movie-import-modal__loading-state {
  align-items: center;
  color: var(--movie-import-readable-muted);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-m);
  justify-content: center;
  min-height: 180px;
  text-align: center;
}

.movie-import-modal__loading-state p {
  margin: 0;
}
```

- [ ] **Step 6: Run modal and CSS tests**

Run:

```bash
npm test -- src/ui/ImportModal.test.tsx src/ui/ImportModal.css.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Find Movie feedback**

```bash
git add src/ui/SearchStep.tsx src/ui/ImportModal.tsx src/ui/ImportModal.css src/ui/ImportModal.test.tsx
git commit -m "feat(search): show native TMDB loading states"
```

---

### Task 3: Add the Modal Import Progress Screen

**Files:**
- Create: `src/ui/ImportProgressStep.tsx`
- Modify: `src/ui/ImportModal.tsx`
- Modify: `src/ui/ImportModal.css`
- Modify: `src/ui/ImportModal.test.tsx`

**Interfaces:**
- Consumes: `ImportProgressEvent`, `PrepareImportResult`, `PreparedImport`, `Spinner`, `countConfirmSummary`
- Produces:

```ts
type ImportModalProps = {
  // Existing search, movie, mapping, and Person props remain.
  prepare: (
    plan: ImportPlan,
    onProgress: (event: ImportProgressEvent) => void,
  ) => Promise<PrepareImportResult>;
  resolve: (prepared: PreparedImport | null) => Promise<void>;
};
```

- [ ] **Step 1: Write failing progress-screen tests**

Use a deferred `prepare` promise and capture its callback:

```ts
let reportProgress:
  | ((event: ImportProgressEvent) => void)
  | undefined;

const prepare = vi.fn(
  (_plan, onProgress) =>
    new Promise<PrepareImportResult>(() => {
      reportProgress = onProgress;
    }),
);
```

After reaching Confirm Import and choosing Start Import, assert:

```ts
expect(screen.getByRole('heading', { name: 'Importing movie' }))
  .toHaveFocus();
expect(screen.getByRole('status')).toHaveTextContent(
  'Preparing your TMDB import',
);
expect(screen.queryByRole('button', { name: 'Back to review' }))
  .not.toBeInTheDocument();
```

Emit an image event and assert `3 of 5 images uploaded`. Confirm the footer summary text remains present.

- [ ] **Step 2: Add a failing preparation-failure test**

Resolve `prepare` with:

```ts
{
  status: 'dependency_failed',
  message:
    'The import could not finish while creating people or uploading images.',
  createdPeople: ['person-1'],
  uploadedAssets: ['upload-1'],
}
```

Assert the modal remains open, the failed phase is visible, the partial-write warning is present, no Retry button exists, and a Close button calls `resolve(null)`.

- [ ] **Step 3: Run the modal tests and verify they fail**

Run:

```bash
npm test -- src/ui/ImportModal.test.tsx
```

Expected: FAIL because the progress step and new modal contract do not exist.

- [ ] **Step 4: Create `ImportProgressStep`**

Render:

- the existing `ModalStepIndicator` with Confirm Import active;
- heading `Importing movie`;
- `Spinner size={48}`;
- polite live text `Preparing your TMDB import`;
- one row per preparation phase;
- real completed/total image counts;
- a stable sticky footer with the existing import summary;
- no navigation controls while preparation is active;
- a Close button only after failure.

Represent the phase rows from current events:

```ts
const phaseLabels: Record<ImportProgressPhase, string> = {
  people_lookup: 'Matching existing people',
  people_create: 'Creating draft people',
  images: 'Uploading images',
  fields_prepare: 'Preparing movie field values',
};
```

- [ ] **Step 5: Add modal lifecycle state**

Extend `Step` with `'progress'`. Replace `isSubmittingPlan` with:

```ts
const [progressEvents, setProgressEvents] =
  useState<Record<ImportProgressPhase, ImportProgressEvent>>(
    initialImportProgress(),
  );
const [preparationFailure, setPreparationFailure] =
  useState<string | null>(null);
```

On Start Import:

```ts
setPreparationFailure(null);
setProgressEvents(initialImportProgress());
setStep('progress');

const result = await props.prepare(plan, (event) => {
  setProgressEvents((current) => ({
    ...current,
    [event.phase]: event,
  }));
});

if (result.status === 'success') {
  await props.resolve(result.prepared);
  return;
}

setPreparationFailure(result.message);
```

Guard the submit function so a second invocation cannot start another preparation.

- [ ] **Step 6: Style progress without changing footer height**

Add progress layout classes using Dato tokens. Keep `.movie-import-modal__actions--sticky` at `min-height: 60px`. Phase states use existing ink, border, success, and danger tokens; do not add hard-coded light-only colors.

- [ ] **Step 7: Run modal and CSS tests**

Run:

```bash
npm test -- src/ui/ImportModal.test.tsx src/ui/ImportModal.css.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit modal progress**

```bash
git add src/ui/ImportProgressStep.tsx src/ui/ImportModal.tsx src/ui/ImportModal.css src/ui/ImportModal.test.tsx
git commit -m "feat(modal): show real import preparation progress"
```

---

### Task 4: Wire Preparation to DatoCMS Contexts

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`
- Modify: `src/ui/FieldAddon.tsx`
- Modify: `src/ui/FieldAddon.test.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `prepareImport`, `applyPreparedImport`, `PreparedImport`, `PrepareImportResult`
- Produces:

```ts
export type FieldAddonStatusReporter = (
  status: 'opening' | 'applying',
) => void;

type FieldAddonProps = {
  tmdbId: number | string | null;
  onOpen: (
    mode: 'find' | 'refresh',
    reportStatus: FieldAddonStatusReporter,
  ) => void | Promise<void>;
  configurationIssues?: string[];
};
```

- [ ] **Step 1: Write failing field-addon status tests**

Provide an `onOpen` mock that calls `reportStatus('applying')` before awaiting a deferred promise.

Assert:

```ts
expect(screen.getByRole('status')).toHaveTextContent(
  'Applying imported values…',
);
expect(screen.getByRole('button')).toBeDisabled();
```

Resolve the promise and assert the status disappears.

- [ ] **Step 2: Write failing app contract tests**

Update the modal fixture in `App.test.tsx` to require `prepare` and `resolve`. Update the field-addon fixture so its `onOpen` receives a status reporter.

Run:

```bash
npm test -- src/App.test.tsx src/ui/FieldAddon.test.tsx
```

Expected: FAIL because the new callback contracts are not wired.

- [ ] **Step 3: Update `FieldAddon`**

Track:

```ts
const [workingStatus, setWorkingStatus] =
  useState<'opening' | 'applying' | null>(null);
```

Start with `opening`, pass `setWorkingStatus` to `onOpen`, and render:

```tsx
{workingStatus === 'applying' ? (
  <p role="status" className="movie-import-field-addon__alert">
    Applying imported values… Keep this entry open until DatoCMS confirms
    the update.
  </p>
) : null}
```

The modal itself supplies progress during preparation, so the field add-on does not need a second hidden preparation message.

- [ ] **Step 4: Prepare inside `renderModal`**

Replace the modal's `execute` prop with `prepare` and `resolve`.

The `prepare` callback:

1. reloads and validates the current schema;
2. determines the active locale;
3. creates a modal-safe gateway without `setFieldValue`;
4. calls `prepareImport(plan, params, gateway, { onProgress })`;
5. retains existing token-safe timing logs.

Pass `resolve: (prepared) => ctx.resolve(prepared)`.

- [ ] **Step 5: Apply inside `renderFieldExtension`**

Replace the `isImportPlan` guard with:

```ts
if (!isPreparedImport(prepared)) {
  return;
}
```

After revalidating configuration, call:

```ts
reportStatus('applying');

const result = await applyPreparedImport(
  prepared,
  { ...latestParams, targetLocale: executionLocale },
  gatewayFor(ctx, executionLocale),
  executorOptionsForMappedFields(latestFieldMetadata),
);
```

Keep the existing success notice and form-failure alert. The modal has already handled preparation failures and therefore returns only a prepared result or `null`.

- [ ] **Step 6: Add a runtime prepared-result guard**

Validate arrays and sanitized image references:

```ts
function isPreparedImport(value: unknown): value is PreparedImport {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;

  return (
    Array.isArray(candidate.fieldChanges) &&
    Array.isArray(candidate.directors) &&
    Array.isArray(candidate.actors) &&
    Array.isArray(candidate.people) &&
    Array.isArray(candidate.images)
  );
}
```

Remove the obsolete `isImportPlan` modal-result guard.

- [ ] **Step 7: Run integration-facing tests**

Run:

```bash
npm test -- src/App.test.tsx src/ui/FieldAddon.test.tsx src/dato/importFlow.integration.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Dato context wiring**

```bash
git add src/App.tsx src/main.tsx src/ui/FieldAddon.tsx src/ui/FieldAddon.test.tsx src/App.test.tsx
git commit -m "feat(plugin): apply prepared imports from field context"
```

---

### Task 5: Add Stable Visual Harness Scenarios

**Files:**
- Modify: `src/devHarness.tsx`
- Modify: `src/devHarness.test.ts`
- Modify: `src/ui/ImportModal.css`
- Modify: `src/ui/ImportModal.css.test.ts`

**Interfaces:**
- Consumes: the modal `prepare` and `resolve` props from Task 3
- Produces: URL scenarios `progress=search`, `progress=import`, and `progress=failure`

- [ ] **Step 1: Write failing harness routing tests**

Assert:

```ts
expect(
  harnessProgress(
    'http://127.0.0.1:5174/?impeccable=modal&progress=import',
  ),
).toBe('import');
```

Repeat for `search`, `failure`, and the default `null` value.

- [ ] **Step 2: Run harness tests and verify they fail**

Run:

```bash
npm test -- src/devHarness.test.ts
```

Expected: FAIL because `harnessProgress` does not exist.

- [ ] **Step 3: Add deterministic progress scenarios**

Export:

```ts
export type HarnessProgress =
  | 'search'
  | 'import'
  | 'failure'
  | null;

export function harnessProgress(
  url = window.location.href,
): HarnessProgress {
  const value = new URL(url).searchParams.get('progress');
  return value === 'search' || value === 'import' || value === 'failure'
    ? value
    : null;
}
```

Use deferred harness promises so:

- `progress=search` holds the search request pending;
- `progress=import` reports active Person work and `2 of 5` images uploaded, then remains pending;
- `progress=failure` returns a dependency failure with one created Person and one uploaded asset.

Keep default harness search, review, and confirmation behavior unchanged.

- [ ] **Step 4: Add CSS contract assertions**

Extend `ImportModal.css.test.ts` to assert:

- progress styles use Dato variables;
- the sticky footer retains `min-height: 60px`;
- no hex, RGB, or hard-coded light background is introduced for progress states;
- the progress layout has a narrow-screen rule.

- [ ] **Step 5: Run harness and CSS tests**

Run:

```bash
npm test -- src/devHarness.test.ts src/ui/ImportModal.css.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit harness scenarios**

```bash
git add src/devHarness.tsx src/devHarness.test.ts src/ui/ImportModal.css src/ui/ImportModal.css.test.ts
git commit -m "test(harness): add import progress review states"
```

---

### Task 6: Verify the Complete Workflow

**Files:**
- Verify: all changed source and test files
- Verify: `docs/superpowers/specs/2026-07-29-import-progress-states-design.md`

**Interfaces:**
- Consumes: all interfaces produced by Tasks 1–5
- Produces: verified local implementation ready for code review

- [ ] **Step 1: Run the complete automated suite**

Run:

```bash
npm test
```

Expected: all test files and tests PASS.

- [ ] **Step 2: Run type checking and the production build**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both commands exit successfully.

- [ ] **Step 3: Check patch hygiene**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors and only intended implementation files are modified.

- [ ] **Step 4: Review light-theme progress states**

Start the harness:

```bash
npm run dev
```

Open and inspect:

- `http://127.0.0.1:5174/?impeccable=modal&progress=search`
- `http://127.0.0.1:5174/?impeccable=modal&progress=import`
- `http://127.0.0.1:5174/?impeccable=modal&progress=failure`

Confirm the native spinner, phase text, stable footer, disabled actions, and failure Close action are visible without clipping at desktop and narrow widths.

- [ ] **Step 5: Review Dato dark-theme progress states**

Open the same URLs with `&theme=dato-dark`.

Confirm text, phase-state icons, borders, spinner, error surface, and footer meet the same visual hierarchy without hard-coded light colors.

- [ ] **Step 6: Run a DatoCMS sandbox acceptance import**

In the sandbox:

1. search by title and confirm the search loading state;
2. select a movie and confirm movie-loading and Person-matching states;
3. select one poster and at least two backdrops;
4. start the import and confirm real phase labels and image counts;
5. wait for the modal to close;
6. confirm `Applying imported values…` appears briefly;
7. confirm selected values and images appear on the unsaved movie form.

Do not save or publish the movie unless separately authorized.

- [ ] **Step 7: Record verification without pushing**

Run:

```bash
git log --oneline -6
git status --short
```

Report test, build, harness, and sandbox results separately. State explicitly that no push, deployment, save, or publication occurred.
