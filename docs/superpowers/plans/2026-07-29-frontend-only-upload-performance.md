# Frontend-Only Upload Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish and verify the frontend-only image-upload performance change so five selected images can upload in one bounded concurrent wave.

**Architecture:** Keep the existing TMDB browser download, DatoCMS upload-request, binary transfer, and asset-processing flow. Use the existing `mapWithConcurrency()` utility in the import executor with a limit of five, preserve result ordering, and keep the current safe performance diagnostics.

**Tech Stack:** TypeScript, Vitest, Vite, `@datocms/cma-client@5.5.5`, DatoCMS Plugin SDK, browser `fetch`

## Global Constraints

- Keep the plugin frontend-only.
- Keep the guided one-click movie import.
- Allow at most five image uploads to run concurrently.
- A sixth image must wait until an active upload completes.
- Preserve selected-image order in the resulting DatoCMS field values.
- Preserve partial-success reporting when an upload fails.
- Do not add a serverless service or replace the importer with an Asset Source.
- Do not log credentials, source URLs, filenames, movie titles, or DatoCMS asset IDs.
- Preserve unrelated working-tree changes.

---

## File Structure

- Modify `src/dato/importExecutor.ts`: set the bounded image-upload worker count to five.
- Modify `src/dato/importExecutor.test.ts`: prove that five uploads start and a sixth waits while completed results retain input order.
- Add `src/utils/concurrency.ts` to version control: retain its existing bounded scheduling and ordered-result behavior.
- Reuse `src/dato/datoGateway.ts`: retain existing per-image stage timing without changing the upload protocol.
- Reuse `src/main.tsx`: retain sanitized console timing output for sandbox measurement.

### Task 1: Lock the Five-Upload Boundary

**Files:**
- Modify: `src/dato/importExecutor.ts:123-130`
- Test: `src/dato/importExecutor.test.ts:206-270`

**Interfaces:**
- Consumes: `mapWithConcurrency<T, R>(values, concurrency, operation, onFulfilled?)`
- Produces: `executeImportPlan()` behavior that starts no more than five `gateway.uploadImage()` calls concurrently and preserves `uploadedAssets` input order.

- [ ] **Step 1: Confirm the regression test covers five active uploads and one waiting upload**

The test must use six controlled promises and contain these assertions:

```ts
it('uploads at most five independent images at a time', async () => {
  const images = Array.from({ length: 6 }, (_, index) => ({
    ...plan.assetsToUpload[1],
    providerImageId: `/backdrop-${index + 1}.jpg`,
    originalUrl: `https://image.tmdb.org/t/p/original/backdrop-${index + 1}.jpg`,
  }));
  const started: string[] = [];
  const pending = new Map<string, (value: { id: string }) => void>();
  const execution = executeImportPlan(
    {
      ...plan,
      fieldChanges: [],
      directors: [],
      actors: [],
      peopleToCreate: [],
      otherImagesToUpload: images,
      assetsToUpload: images,
    },
    params,
    {
      async findPeople() {
        return [];
      },
      async createPersonDraft() {
        return { id: 'person-1' };
      },
      uploadImage(image) {
        started.push(image.providerImageId);
        return new Promise((resolve) =>
          pending.set(image.providerImageId, resolve)
        );
      },
      async applyFormValues() {
        return undefined;
      },
    },
  );

  await vi.waitFor(() =>
    expect(started).toEqual([
      '/backdrop-1.jpg',
      '/backdrop-2.jpg',
      '/backdrop-3.jpg',
      '/backdrop-4.jpg',
      '/backdrop-5.jpg',
    ])
  );
  expect(started).not.toContain('/backdrop-6.jpg');

  pending.get('/backdrop-1.jpg')?.({ id: 'upload-1' });
  await vi.waitFor(() => expect(started).toContain('/backdrop-6.jpg'));
  pending.get('/backdrop-2.jpg')?.({ id: 'upload-2' });
  pending.get('/backdrop-3.jpg')?.({ id: 'upload-3' });
  pending.get('/backdrop-4.jpg')?.({ id: 'upload-4' });
  pending.get('/backdrop-5.jpg')?.({ id: 'upload-5' });
  pending.get('/backdrop-6.jpg')?.({ id: 'upload-6' });

  await expect(execution).resolves.toMatchObject({
    status: 'success',
    uploadedAssets: [
      'upload-1',
      'upload-2',
      'upload-3',
      'upload-4',
      'upload-5',
      'upload-6',
    ],
  });
});
```

- [ ] **Step 2: Verify the test protects the intended boundary**

Temporarily set the concurrency argument in `src/dato/importExecutor.ts` to `3`, then run:

```bash
npm test -- src/dato/importExecutor.test.ts
```

Expected: FAIL because only the first three image paths appear in `started`.

- [ ] **Step 3: Restore the five-worker implementation**

The image branch must call:

```ts
await mapWithConcurrency(
  plan.assetsToUpload,
  5,
  (image) => gateway.uploadImage(image),
  (upload, image, index) => {
    completedUploads[index] = { image, id: upload.id };
  },
);
```

- [ ] **Step 4: Run the focused test**

Run:

```bash
npm test -- src/dato/importExecutor.test.ts
```

Expected: `21 passed`, including `uploads at most five independent images at a time` and the phase-timing observer safety regression.

- [ ] **Step 5: Review the focused diff**

Run:

```bash
git diff -- src/dato/importExecutor.ts src/dato/importExecutor.test.ts
```

Expected: the concurrency behavior is five, the test caps it at five, a sixth waits, and ordered result assertions remain present. Do not discard or rewrite other uncommitted work in these files.

### Task 2: Verify the Complete Performance Change

**Files:**
- Verify: `src/dato/datoGateway.ts`
- Verify: `src/dato/datoGateway.test.ts`
- Verify: `src/dato/importExecutor.ts`
- Verify: `src/dato/importExecutor.test.ts`
- Verify: `src/utils/concurrency.ts`
- Verify: `src/main.tsx`

**Interfaces:**
- Consumes: the existing upload-stage timing callback and bounded concurrency utility.
- Produces: a buildable plugin with passing regression coverage and no whitespace errors.

- [ ] **Step 1: Run all automated tests**

Run:

```bash
npm test
```

Expected: all 23 test files and 189 tests pass.

- [ ] **Step 2: Run the production build**

Run:

```bash
npm run build
```

Expected: TypeScript checking and the Vite production build complete with exit code `0`.

- [ ] **Step 3: Check the working diff**

Run:

```bash
git diff --check
git status --short
```

Expected: `git diff --check` prints nothing. `git status --short` may show the user's existing changes; verify the performance files explicitly rather than assuming every dirty file belongs to this task.

- [ ] **Step 4: Review the performance-specific files before committing**

Run:

```bash
git diff -- \
  src/dato/datoGateway.ts \
  src/dato/datoGateway.test.ts \
  src/dato/importExecutor.ts \
  src/dato/importExecutor.test.ts \
  src/utils/concurrency.ts \
  src/main.tsx
sed -n '1,220p' src/utils/concurrency.ts
```

Expected: no raw tokens or content identifiers are logged; callbacks remain unable to interrupt uploads; upload ordering and partial-success behavior remain intact. The `sed` command covers the untracked concurrency utility, which does not appear in a normal `git diff`.

- [ ] **Step 5: Prepare a commit handoff**

Run:

```bash
git status --short
git diff --stat
```

Expected: report the exact verified performance files and the remaining unrelated dirty files. Do not stage or commit code until the user explicitly invokes the committing workflow, because the gateway and executor files contain overlapping uncommitted repairs from earlier work.

### Task 3: Confirm Sandbox Behavior

**Files:**
- No source files.

**Interfaces:**
- Consumes: browser console events named `MCS Movie Importer upload performance`.
- Produces: live sandbox evidence that five images upload successfully in one wave.

- [ ] **Step 1: Start the local plugin**

Run:

```bash
npm run dev
```

Expected: Vite serves the plugin at `http://localhost:5174/`.

- [ ] **Step 2: Prepare one controlled sandbox import**

Open the DatoCMS sandbox movie entry, launch the importer, and select exactly five images: one poster and four backdrops.

Expected: the Confirm import page reports five selected images.

- [ ] **Step 3: Clear the browser console and confirm the import**

Expected: five uploads report successful `download`, `upload_request`, `transfer`, `asset_processing`, and `total` stages. The first five download stages begin before any worker slot is released.

- [ ] **Step 4: Record the acceptance result**

Record:

- overall `images` phase duration;
- overall `total` phase duration;
- slowest per-image `total` duration;
- whether any stage failed.

Expected: all five images finish in one wave with no upload errors. Duration is diagnostic rather than a release gate because DatoCMS processing varies between runs.

- [ ] **Step 5: Confirm the form result**

Verify that the chosen poster, Hero image, and Other Images appear on the unsaved DatoCMS movie form after the modal closes.

Expected: the selected images are assigned to their configured fields and remain ready for the editor to save.
