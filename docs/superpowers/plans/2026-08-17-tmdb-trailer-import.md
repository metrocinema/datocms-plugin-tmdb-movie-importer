# TMDB Trailer Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import one deterministic official English YouTube trailer from TMDB into an optional mapped DatoCMS External Video field while preserving editor review, confirmation, and unsaved-form behavior.

**Architecture:** Extend the existing appended TMDB movie package with optional video data, normalize one provider-neutral trailer candidate, and convert it through a pure domain adapter into DatoCMS's native External Video value. Carry the selected value through the existing field-comparison, import-plan, prepared-result, and form-application path. Render trailer review separately from scalar fields, but do not add a second request, upload, dependency, or progress phase.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Vitest 4, Testing Library, DatoCMS Plugin SDK 2.2.6, `datocms-react-ui` 2.2.6, DatoCMS CMA client 5.5.5, TMDB API v3.

## Global Constraints

- Follow the approved design in [`2026-08-17-tmdb-trailer-import-design.md`](../specs/2026-08-17-tmdb-trailer-import-design.md).
- Keep the plugin frontend-only. Do not add a YouTube credential, proxy, oEmbed call, downloaded video, or Dato upload.
- Keep the TMDB fetch to the existing movie-details request by appending `videos`.
- Never clear an existing trailer because TMDB returned no qualifying candidate or malformed video data.
- Apply the trailer to the unsaved DatoCMS form only after editor confirmation. Do not save or publish the movie.
- Use DatoCMS React UI components for controls and existing Dato theme variables for custom media presentation.
- Preserve localized-field behavior through `fieldPathForMovieField` and the active target locale.
- Add no trailer-specific import progress phase. Trailer application remains part of `fields_prepare` and form application.
- Use sanitized fixture data in automated tests and the development harness.
- Before each task commit, run the focused tests listed in that task. Before completion, run `npm run verify:release` and the manual DatoCMS sandbox checklist.

## File Responsibility Map

- `src/providers/tmdbTypes.ts`, `src/providers/tmdbClient.ts`: TMDB response and request contracts only.
- `src/providers/tmdbNormalizer.ts`: eligibility, deterministic ranking, and normalized trailer creation.
- `src/domain/trailer.ts`: normalized trailer and Dato External Video value types plus pure conversion/identity helpers.
- `src/domain/movie.ts`: expose the optional normalized trailer on the movie aggregate and add the `trailer` field key.
- `src/domain/fieldComparison.ts`, `src/domain/importPlanning.ts`: comparison and reviewed selection only.
- `src/plugin/*`, `src/dato/importExecutor.ts`: mapping validation, serialization, localized paths, and form application.
- `src/ui/TrailerReview.tsx`, `src/ui/ReviewStep.tsx`, `src/ui/ConfirmStep.tsx`, `src/ui/modalPresentation.ts`, `src/ui/ImportModal.css`: editor presentation and accessibility.
- `src/devHarness.tsx`, `src/test/fixtures/tmdb/*`: sanitized visual and provider fixtures.
- `README.md`, `CHANGELOG.md`, `docs/documentation-map.md`: current behavior and implementation status.

---

### Task 1: Extend the TMDB package and normalize one trailer

**Interfaces**

- **Consumes:** TMDB `videos.results` returned inside the existing movie-details response.
- **Produces:** `NormalizedMovie.trailer: NormalizedTrailerCandidate | null`.
- **Does not change:** search behavior, image normalization, cast limits, or release-date selection.

**Files:**

- Create: `src/domain/trailer.ts`
- Modify: `src/domain/movie.ts` (`NormalizedMovie.trailer` only)
- Modify: `src/providers/tmdbTypes.ts`
- Modify: `src/providers/tmdbClient.ts`
- Modify: `src/providers/tmdbNormalizer.ts`
- Modify: `src/providers/tmdbClient.test.ts`
- Modify: `src/providers/tmdbNormalizer.test.ts`
- Modify: `src/test/fixtures/tmdb/complete-movie.json`

- [ ] **Step 1: Add a failing request-contract test**

Update `src/providers/tmdbClient.test.ts` so the expected URL includes `videos` in the existing appended response:

```ts
expect(fetchImpl).toHaveBeenCalledWith(
  'https://api.themoviedb.org/3/movie/27205?language=en-US&append_to_response=credits,release_dates,images,videos&include_image_language=en,null',
  { headers: { Authorization: 'Bearer test-read-token', Accept: 'application/json' } },
);
```

- [ ] **Step 2: Run the request test and verify it fails for the missing `videos` append**

Run: `npm test -- src/providers/tmdbClient.test.ts`

Expected: FAIL because the generated URL still ends with `credits,release_dates,images`.

- [ ] **Step 3: Add failing trailer normalization tests**

Add cases to `src/providers/tmdbNormalizer.test.ts` that cover:

```ts
const validVideo = {
  id: 'valid-video',
  iso_639_1: 'en',
  iso_3166_1: 'US',
  key: 'valid_key-123',
  name: 'Official Trailer',
  official: true,
  published_at: '2025-01-01T00:00:00.000Z',
  site: 'YouTube',
  size: 1080,
  type: 'Trailer',
};

it('selects the highest-resolution official English YouTube trailer', () => {
  const movie = normalizeTmdbMovie({
    ...completeMovie,
    videos: {
      results: [
        { id: 'older-1080', iso_639_1: 'en', iso_3166_1: 'US', key: 'older_1080', name: 'Official Trailer', official: true, published_at: '2025-01-01T00:00:00.000Z', site: 'YouTube', size: 1080, type: 'Trailer' },
        { id: 'newer-1080', iso_639_1: 'en', iso_3166_1: 'GB', key: 'newer-1080', name: 'Official Trailer 2', official: true, published_at: '2025-02-01T00:00:00.000Z', site: 'YouTube', size: 1080, type: 'Trailer' },
        { id: 'larger-2160', iso_639_1: 'en', iso_3166_1: 'CA', key: 'larger2160', name: '4K Official Trailer', official: true, published_at: '2024-01-01T00:00:00.000Z', site: 'YouTube', size: 2160, type: 'Trailer' },
      ],
    },
  }, 10);

  expect(movie.trailer).toMatchObject({
    providerKey: 'tmdb',
    providerVideoId: 'larger-2160',
    externalProvider: 'youtube',
    externalProviderId: 'larger2160',
    title: '4K Official Trailer',
    resolution: 2160,
    official: true,
  });
});

it.each([
  [{ official: false }, 'unofficial'],
  [{ iso_639_1: 'fr' }, 'non-English'],
  [{ site: 'Vimeo' }, 'non-YouTube'],
  [{ type: 'Teaser' }, 'non-trailer'],
  [{ key: 'bad/key' }, 'malformed key'],
  [{ size: 0 }, 'invalid size'],
])('ignores %s candidates', (override) => {
  const movie = normalizeTmdbMovie({
    ...completeMovie,
    videos: { results: [{ ...validVideo, ...override }] },
  }, 10);
  expect(movie.trailer).toBeNull();
});

it.each([
  {},
  { videos: undefined },
  { videos: {} },
  { videos: { results: 'invalid' } },
])('treats a missing or malformed videos response as no trailer', (override) => {
  expect(normalizeTmdbMovie({ ...completeMovie, ...override } as TmdbMoviePackage, 10).trailer).toBeNull();
});
```

Also add ranking coverage for equal resolution, newest valid date, invalid dates last, and lexical TMDB video ID as the final tie-breaker.

- [ ] **Step 4: Run the normalizer tests and verify type/test failures**

Run: `npm test -- src/providers/tmdbNormalizer.test.ts`

Expected: FAIL because `TmdbMoviePackage` has no video contract and `NormalizedMovie` has no trailer.

- [ ] **Step 5: Add the domain and TMDB video types**

Create `src/domain/trailer.ts` with the exact cross-layer contracts:

```ts
export type NormalizedTrailerCandidate = {
  providerKey: 'tmdb';
  providerVideoId: string;
  movieIdentity: { providerKey: 'tmdb'; tmdbId: number };
  externalProvider: 'youtube';
  externalProviderId: string;
  title: string;
  watchUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  language: 'en';
  country: string | null;
  resolution: number;
  publishedAt: string | null;
  official: true;
  attribution: 'TMDB';
};

export type DatoExternalVideoValue = {
  provider: 'youtube';
  provider_uid: string;
  url: string;
  width: number;
  height: number;
  thumbnail_url: string;
  title: string;
};

export function datoExternalVideoValue(trailer: NormalizedTrailerCandidate): DatoExternalVideoValue {
  return {
    provider: trailer.externalProvider,
    provider_uid: trailer.externalProviderId,
    url: trailer.watchUrl,
    width: trailer.width,
    height: trailer.height,
    thumbnail_url: trailer.thumbnailUrl,
    title: trailer.title,
  };
}

export function sameExternalVideo(left: unknown, right: unknown): boolean {
  const leftValue = externalVideoIdentity(left);
  const rightValue = externalVideoIdentity(right);
  return leftValue !== null && rightValue !== null
    && leftValue.provider === rightValue.provider
    && leftValue.providerUid === rightValue.providerUid;
}

function externalVideoIdentity(value: unknown): { provider: string; providerUid: string } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.provider === 'string'
    && typeof candidate.provider_uid === 'string'
    && candidate.provider.length > 0
    && candidate.provider_uid.length > 0
    ? { provider: candidate.provider, providerUid: candidate.provider_uid }
    : null;
}
```

Add `trailer: NormalizedTrailerCandidate | null` to `NormalizedMovie`. Do not add `'trailer'` to `MovieFieldKey` until Task 2, where the exhaustive configuration and presentation label records are updated in the same typecheck-safe increment.

Add the permissive TMDB input type in `src/providers/tmdbTypes.ts`:

```ts
export type TmdbVideo = {
  id?: unknown;
  iso_639_1?: unknown;
  iso_3166_1?: unknown;
  key?: unknown;
  name?: unknown;
  official?: unknown;
  published_at?: unknown;
  site?: unknown;
  size?: unknown;
  type?: unknown;
};

// Add this property to the existing TmdbMoviePackage declaration.
videos?: { results?: unknown };
```

Use `unknown` at the provider boundary so runtime validation, rather than optimistic TypeScript typing, protects malformed API data.

- [ ] **Step 6: Implement eligibility, ranking, and normalization**

In `src/providers/tmdbNormalizer.ts`, add small pure helpers and keep them local to the TMDB adapter:

```ts
const YOUTUBE_KEY = /^[A-Za-z0-9_-]+$/;

type EligibleTmdbTrailer = TmdbVideo & {
  id: string;
  iso_639_1: 'en';
  key: string;
  name: string;
  official: true;
  site: 'YouTube';
  size: number;
  type: 'Trailer';
};

function eligibleTrailer(value: unknown): value is EligibleTmdbTrailer {
  if (!value || typeof value !== 'object') return false;
  const video = value as TmdbVideo;
  return video.official === true
    && video.iso_639_1 === 'en'
    && video.site === 'YouTube'
    && video.type === 'Trailer'
    && typeof video.id === 'string' && video.id.trim().length > 0
    && typeof video.key === 'string' && YOUTUBE_KEY.test(video.key)
    && typeof video.name === 'string' && video.name.trim().length > 0
    && typeof video.size === 'number' && Number.isInteger(video.size) && video.size > 0;
}
```

Sort without mutating the TMDB response. Parse `published_at` only for ranking; retain it only when it is a valid date. Normalize the winner to the URLs and dimensions in the approved spec, then set `trailer` in `normalizeTmdbMovie`.

- [ ] **Step 7: Update the existing TMDB request**

Change `src/providers/tmdbClient.ts` to:

```ts
return this.getJson<TmdbMoviePackage>(
  `/movie/${tmdbId}?language=en-US&append_to_response=credits,release_dates,images,videos&include_image_language=en,null`,
);
```

- [ ] **Step 8: Run focused provider tests and typecheck**

Run: `npm test -- src/providers/tmdbClient.test.ts src/providers/tmdbNormalizer.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: FAIL only where existing `NormalizedMovie` fixtures have not yet supplied `trailer`; update those fixtures to `trailer: null` mechanically before proceeding, then rerun to PASS.

- [ ] **Step 9: Commit the provider increment**

```bash
git add src/domain/trailer.ts src/domain/movie.ts src/providers/tmdbTypes.ts src/providers/tmdbClient.ts src/providers/tmdbNormalizer.ts src/providers/tmdbClient.test.ts src/providers/tmdbNormalizer.test.ts src/test/fixtures/tmdb/complete-movie.json src
git commit -m "feat: normalize TMDB trailer candidate"
```

Review the staged diff before committing so the broad `src` add contains only mechanical `trailer: null` fixture updates needed by the new required movie property.

---

### Task 2: Configure and compare the DatoCMS trailer field

**Interfaces**

- **Consumes:** optional `movieFields.trailer` API name, mapped field metadata, current form value, and `NormalizedMovie.trailer`.
- **Produces:** a trailer `FieldComparison` whose proposed value is the exact Dato External Video object.
- **Does not change:** scalar formatting or image/person mapping validation.

**Files:**

- Modify: `src/plugin/datoFieldMapping.ts`
- Modify: `src/domain/movie.ts` (`MovieFieldKey`)
- Modify: `src/ui/ConfigScreen.tsx`
- Modify: `src/ui/modalPresentation.ts`
- Modify: `src/domain/fieldComparison.ts`
- Modify: `src/plugin/modalRuntime.ts`
- Modify: `src/plugin/datoFieldMapping.test.ts`
- Modify: `src/ui/ConfigScreen.test.tsx`
- Modify: `src/domain/fieldComparison.test.ts`
- Modify: `src/plugin/modalRuntime.test.ts`
- Modify: `src/plugin/parameters.test.ts`

- [ ] **Step 1: Add failing mapping and configuration tests**

Add assertions that:

```ts
const schemaWithTrailer: DatoSchemaSnapshot = {
  ...schema,
  models: {
    ...schema.models,
    movie: {
      ...schema.models.movie,
      fields: {
        ...schema.models.movie.fields,
        trailer: { apiKey: 'trailer', fieldType: 'video', localized: false, validators: {} },
      },
    },
  },
};
const parametersWithTrailer = {
  ...baseParams,
  movieFields: { ...baseParams.movieFields, trailer: 'trailer' },
};

expect(validateFieldMappings(parametersWithTrailer, schemaWithTrailer)).toEqual([]);
expect(validateFieldMappings(parametersWithTrailer, {
  ...schemaWithTrailer,
  models: {
    ...schemaWithTrailer.models,
    movie: {
      ...schemaWithTrailer.models.movie,
      fields: {
        ...schemaWithTrailer.models.movie.fields,
        trailer: { apiKey: 'trailer', fieldType: 'string', localized: false, validators: {} },
      },
    },
  },
})).toContainEqual(expect.objectContaining({ code: 'trailer_wrong_type', severity: 'error' }));
expect(screen.getByLabelText('Trailer field API name')).toBeInTheDocument();
expect(modalMappedFields({ movieFields: { trailer: 'trailer' } })).toContain('trailer');
```

Ensure `parsePluginParameters` preserves `movieFields.trailer` without making it required.

- [ ] **Step 2: Run focused tests and verify failures**

Run: `npm test -- src/plugin/datoFieldMapping.test.ts src/ui/ConfigScreen.test.tsx src/plugin/modalRuntime.test.ts src/plugin/parameters.test.ts`

Expected: FAIL because `trailer` is not yet a known mapping or label.

- [ ] **Step 3: Add failing video identity and selection tests**

Extend `src/domain/fieldComparison.test.ts` with:

```ts
it('preselects a trailer only when the current video field is empty', () => {
  const [trailer] = compareMovieFields({ trailer: null }, movieWithTrailer, ['trailer']);
  expect(trailer).toMatchObject({ available: true, changed: true, selected: true });
  expect(trailer.proposedValue).toEqual(datoExternalVideoValue(movieWithTrailer.trailer!));
});

it('leaves a replacement trailer unselected', () => {
  const [trailer] = compareMovieFields({ trailer: existingDifferentVideo }, movieWithTrailer, ['trailer']);
  expect(trailer).toMatchObject({ available: true, changed: true, selected: false });
});

it('matches videos by provider and provider ID only', () => {
  const [trailer] = compareMovieFields({
    trailer: { ...datoExternalVideoValue(movieWithTrailer.trailer!), title: 'Editorial title', width: 1, height: 1 },
  }, movieWithTrailer, ['trailer']);
  expect(trailer).toMatchObject({ changed: false, selected: false });
});

it('never proposes clearing an existing trailer when TMDB has no candidate', () => {
  const [trailer] = compareMovieFields({ trailer: existingDifferentVideo }, { ...movie, trailer: null }, ['trailer']);
  expect(trailer).toMatchObject({ available: false, selected: false });
});
```

- [ ] **Step 4: Run comparison tests and verify failure**

Run: `npm test -- src/domain/fieldComparison.test.ts`

Expected: FAIL because `trailer` is excluded from `SCALAR_KEYS` and has no value conversion or identity comparison.

- [ ] **Step 5: Implement mapping, labels, and comparison**

Make these exact changes:

```ts
// src/domain/movie.ts
// Add to the MovieFieldKey union:
| 'trailer'

// src/plugin/datoFieldMapping.ts
trailer: ['video'],

// src/ui/ConfigScreen.tsx and src/ui/modalPresentation.ts
trailer: 'Trailer',

// src/plugin/modalRuntime.ts
const knownMovieFieldKeys: MovieFieldKey[] = [
  'title', 'yearReleased', 'mpaaRating', 'runtime', 'tmdbId', 'tagline',
  'description', 'trailer', 'poster', 'heroImage', 'backdrops', 'directors', 'actors',
];
```

Include `trailer` in the comparison key set, return `datoExternalVideoValue(movie.trailer)` when a candidate exists, and use `sameExternalVideo` in `valuesMatch`. Keep the generic empty-value rule for `null` and `undefined`; do not treat arbitrary objects as empty.

Also extend `isPreparedFieldValue` in `src/plugin/modalRuntime.ts` in this task so a selected trailer can cross the modal boundary. Accept only the exact seven-key native Dato External Video object, require `provider: 'youtube'`, non-empty strings, and positive safe-integer dimensions, and reject extra keys. Cover valid, malformed, and widened payloads in `src/plugin/modalRuntime.test.ts`.

- [ ] **Step 6: Run focused configuration and comparison tests**

Run: `npm test -- src/plugin/datoFieldMapping.test.ts src/ui/ConfigScreen.test.tsx src/plugin/modalRuntime.test.ts src/plugin/parameters.test.ts src/domain/fieldComparison.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the mapping increment**

```bash
git add src/plugin/datoFieldMapping.ts src/ui/ConfigScreen.tsx src/ui/modalPresentation.ts src/domain/fieldComparison.ts src/plugin/modalRuntime.ts src/plugin/datoFieldMapping.test.ts src/ui/ConfigScreen.test.tsx src/domain/fieldComparison.test.ts src/plugin/modalRuntime.test.ts src/plugin/parameters.test.ts
git commit -m "feat: map Dato trailer field"
```

---

### Task 3: Preserve the reviewed trailer through planning and form application

**Interfaces**

- **Consumes:** selected trailer comparison and current mapping fingerprint.
- **Produces:** a prepared trailer field change and one localized or nonlocalized `applyFormValues` change.
- **Does not change:** people lookup/creation, image uploads, partial-side-effect reporting, or save/publish behavior.

**Files:**

- Modify: `src/domain/importPlanning.test.ts`
- Modify: `src/plugin/modalRuntime.test.ts`
- Modify: `src/plugin/fieldExtensionAdapter.test.ts`
- Modify: `src/dato/importExecutor.test.ts`
- Modify: `src/dato/importFlow.integration.test.ts`
- Modify only if tests expose a gap: `src/domain/importPlanning.ts`
- Modify only if tests expose a gap: `src/plugin/modalRuntime.ts`
- Modify only if tests expose a gap: `src/dato/importExecutor.ts`

- [ ] **Step 1: Add failing plan and serialization regression tests**

Add a selected trailer comparison to `src/domain/importPlanning.test.ts`:

```ts
const trailerValue = {
  provider: 'youtube',
  provider_uid: 'abc_123',
  url: 'https://www.youtube.com/watch?v=abc_123',
  width: 1920,
  height: 1080,
  thumbnail_url: 'https://i.ytimg.com/vi/abc_123/hqdefault.jpg',
  title: 'Official Trailer',
};

expect(buildImportPlan({
  fieldComparisons: [{ key: 'trailer', currentValue: null, proposedValue: trailerValue, selected: true, available: true, changed: true }],
  directors: [],
  actors: [],
  imageSelection: { poster: null, heroImage: null, backdrops: [] },
  personResolutions: [],
  mappedFields: ['trailer'],
}).fieldChanges).toEqual([{ key: 'trailer', value: trailerValue }]);
```

Confirm the strict modal-runtime coverage added in Task 2 accepts this exact object in `fieldChanges` and rejects malformed or widened video objects. Add only the remaining regression that an unknown field key is rejected and the Trailer destination remains part of the mapping fingerprint.

- [ ] **Step 2: Run the plan/runtime tests and inspect whether production code already passes**

Run: `npm test -- src/domain/importPlanning.test.ts src/plugin/modalRuntime.test.ts`

Expected: the plan and strict runtime-value cases should already PASS through the generic field-change path established by Tasks 1 and 2. The new mapping-fingerprint regression may fail until the trailer destination is included at that boundary. Do not add trailer-specific plan fields if the generic path passes.

- [ ] **Step 3: Add failing executor tests for the exact Dato payload**

In `src/dato/importExecutor.test.ts`, test both paths:

```ts
const trailerParams: PluginParameters = {
  ...params,
  movieFields: { ...params.movieFields, trailer: 'trailer' },
};
const preparedWithTrailer: PreparedImport = {
  fieldChanges: [{ key: 'trailer', value: trailerValue }],
  directors: [],
  actors: [],
  people: [],
  images: [],
  heroImage: null,
  otherImages: [],
  createdPeople: [],
  uploadedAssets: [],
};

it('applies a reviewed trailer as a native External Video value', async () => {
  await applyPreparedImport(preparedWithTrailer, trailerParams, gateway);
  expect(gateway.applyFormValues).toHaveBeenCalledWith(
    expect.arrayContaining([{ fieldPath: 'trailer', value: trailerValue }]),
  );
});

it('applies a reviewed trailer to the active locale path', async () => {
  await applyPreparedImport(preparedWithTrailer, trailerParams, gateway, {
    localizedMovieFields: { trailer: true },
  });
  expect(gateway.applyFormValues).toHaveBeenCalledWith(
    expect.arrayContaining([{ fieldPath: 'trailer.en', value: trailerValue }]),
  );
});
```

Add negative assertions for unselected, unavailable, unchanged, and unmapped trailer cases. Add one integration assertion in `src/dato/importFlow.integration.test.ts` proving trailer form application does not add a dependency call or asset upload.

- [ ] **Step 4: Run executor tests and verify the existing generic path**

Run: `npm test -- src/dato/importExecutor.test.ts src/dato/importFlow.integration.test.ts src/plugin/fieldExtensionAdapter.test.ts`

Expected: PASS if the selected trailer is already represented as a field change. If it fails, make only the smallest correction to generic field-change serialization or application; do not add a parallel trailer execution path.

- [ ] **Step 5: Run the complete non-UI data-flow slice**

Run: `npm test -- src/providers/tmdbClient.test.ts src/providers/tmdbNormalizer.test.ts src/domain/fieldComparison.test.ts src/domain/importPlanning.test.ts src/plugin/modalRuntime.test.ts src/plugin/fieldExtensionAdapter.test.ts src/dato/importExecutor.test.ts src/dato/importFlow.integration.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the reviewed data-flow increment**

```bash
git add src/domain/importPlanning.ts src/domain/importPlanning.test.ts src/plugin/modalRuntime.ts src/plugin/modalRuntime.test.ts src/plugin/fieldExtensionAdapter.test.ts src/dato/importExecutor.ts src/dato/importExecutor.test.ts src/dato/importFlow.integration.test.ts
git commit -m "test: cover trailer import data flow"
```

If production files remained unchanged because the generic path already worked, omit them from `git add` and keep this as a focused regression-test commit.

---

### Task 4: Add the compact Trailer review section

**Interfaces**

- **Consumes:** the normalized trailer candidate, its trailer `FieldComparison`, current External Video value, and the existing toggle callback.
- **Produces:** an accessible editor decision rendered between Field changes and Images.
- **Does not change:** scalar field table rows or image selection controls.

**Files:**

- Create: `src/ui/TrailerReview.tsx`
- Create: `src/ui/TrailerReview.test.tsx`
- Modify: `src/ui/ReviewStep.tsx`
- Modify: `src/ui/FieldDiffTable.tsx`
- Modify: `src/ui/ImportModal.css`
- Modify: `src/ui/ImportModal.test.tsx`
- Modify: `src/ui/ImportModal.css.test.ts`

- [ ] **Step 1: Add failing component tests for every approved state**

Create `src/ui/TrailerReview.test.tsx` and cover:

```ts
it('renders a selected empty-field proposal with a safe YouTube preview link', async () => {
  render(<TrailerReview trailer={trailer} comparison={emptySelectedComparison} onToggle={onToggle} />);
  expect(screen.getByRole('checkbox', { name: 'Import Official Trailer' })).toBeChecked();
  expect(screen.getByText('Official')).toBeInTheDocument();
  expect(screen.getByText('English')).toBeInTheDocument();
  expect(screen.getByText('1080p')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Preview on YouTube' })).toHaveAttribute('href', trailer.watchUrl);
  expect(screen.getByRole('link', { name: 'Preview on YouTube' })).toHaveAttribute('target', '_blank');
  expect(screen.getByRole('link', { name: 'Preview on YouTube' })).toHaveAttribute('rel', expect.stringContaining('noopener'));
});

it('shows a replacement unselected with current title and provider context', () => {
  render(<TrailerReview trailer={trailer} comparison={replacementComparison} onToggle={onToggle} />);
  expect(screen.getByRole('checkbox')).not.toBeChecked();
  expect(screen.getByText(/Current: Editorial trailer · YouTube/i)).toBeInTheDocument();
});

it('disables an already-current proposal', () => {
  render(<TrailerReview trailer={trailer} comparison={unchangedComparison} onToggle={onToggle} />);
  expect(screen.getByText('Already current trailer')).toBeInTheDocument();
  expect(screen.getByRole('checkbox')).toBeDisabled();
});

it('shows no-result copy without clearing the current value', () => {
  render(<TrailerReview trailer={null} comparison={unavailableComparison} onToggle={onToggle} />);
  expect(screen.getByText('No official English YouTube trailer found.')).toBeInTheDocument();
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});
```

Also simulate an image `error` event and assert that **Preview unavailable** replaces the thumbnail while the link and checkbox remain.

- [ ] **Step 2: Run the new component test and verify it fails**

Run: `npm test -- src/ui/TrailerReview.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the component with native controls and safe media behavior**

Use `datocms-react-ui` for the checkbox/control surface where available. The custom card may use existing modal classes and Dato variables. Keep the thumbnail lazy and nonblocking:

```tsx
<img
  alt=""
  decoding="async"
  loading="lazy"
  src={trailer.thumbnailUrl}
  onError={() => setPreviewFailed(true)}
/>

<a href={trailer.watchUrl} target="_blank" rel="noopener noreferrer">
  Preview on YouTube
</a>
```

Do not place the link inside the checkbox label. Give the selection control at least a 44-pixel interactive target through the surrounding label/card. Use the comparison's `selected`, `changed`, and `available` values as the source of truth rather than introducing duplicate trailer selection state.

- [ ] **Step 4: Integrate the section and keep trailer out of the scalar table**

In `src/ui/ReviewStep.tsx`:

```ts
const trailerComparison = comparisons.find((comparison) => comparison.key === 'trailer');
const scalarComparisons = comparisons.filter((comparison) => comparison.key !== 'trailer');
const hasTrailerDestination = mappedFieldSet.has('trailer');
```

Pass `scalarComparisons` to `FieldDiffTable`. Render this immediately after Field changes and before Images:

```tsx
{hasTrailerDestination && trailerComparison ? (
  <div id="trailer">
    <Section title="Trailer">
      <TrailerReview
        trailer={movie.trailer}
        comparison={trailerComparison}
        onToggle={() => onToggle('trailer')}
      />
    </Section>
  </div>
) : null}
```

If the mapped trailer produces a comparison even when the candidate is missing, the no-result state appears as required. Ensure `FieldDiffTable` select-all and clear-all operate only on scalar rows, while the trailer checkbox remains an explicit independent decision. If the existing callbacks operate across every comparison, introduce scalar-only callbacks at the `ImportModal` state owner rather than silently toggling Trailer from a button labeled **Select all changes**.

- [ ] **Step 5: Add integration and placement tests**

In `src/ui/ImportModal.test.tsx`, assert:

- Trailer appears after the Field changes section and before Images when mapped.
- Trailer is absent when unmapped.
- Empty current field starts checked.
- Populated different field starts unchecked.
- Same provider/provider ID is disabled as already current.
- No candidate shows the exact no-result copy.
- Toggling the checkbox changes the import plan.
- Select all/clear all scalar actions do not unexpectedly change the independent trailer choice.

Use DOM order assertions with `compareDocumentPosition`, not screenshot-only verification.

- [ ] **Step 6: Add theme-safe CSS and contract tests**

Add trailer-specific classes to `src/ui/ImportModal.css` using only Dato variables already used by the modal, including:

- `var(--color--surface-raised)` for the card;
- `var(--color--border)` and `var(--color--border-hover)` for boundaries;
- `var(--color--selected--surface)` and `var(--color--selected--border)` for selection;
- `var(--color--ink)` and `var(--color--ink-subtle)` for text;
- a 16:9 preview with `object-fit: contain`;
- one-column stacking at the modal's existing narrow breakpoint.

Extend `src/ui/ImportModal.css.test.ts` to reject hard-coded light-only colors in the new rules and verify the selected-state variables are present.

- [ ] **Step 7: Run focused UI tests**

Run: `npm test -- src/ui/TrailerReview.test.tsx src/ui/ImportModal.test.tsx src/ui/ImportModal.css.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit the review UI increment**

```bash
git add src/ui/TrailerReview.tsx src/ui/TrailerReview.test.tsx src/ui/ReviewStep.tsx src/ui/FieldDiffTable.tsx src/ui/ImportModal.css src/ui/ImportModal.test.tsx src/ui/ImportModal.css.test.ts
git commit -m "feat: add trailer review decision"
```

---

### Task 5: Separate trailer counts in confirmation and the sticky footer

**Interfaces**

- **Consumes:** `ImportPlan.fieldChanges` containing zero or one selected trailer change.
- **Produces:** scalar-field, trailer, image, create, and reuse counts without double-counting.
- **Does not change:** the prepared import payload.

**Files:**

- Modify: `src/ui/modalPresentation.ts`
- Modify: `src/ui/ReviewStep.tsx`
- Modify: `src/ui/ConfirmStep.tsx`
- Modify: `src/ui/modalPresentation.test.ts`
- Modify: `src/ui/ImportModal.test.tsx`

- [ ] **Step 1: Add failing summary-count tests**

Update `src/ui/modalPresentation.test.ts`:

```ts
expect(countConfirmSummary(planWithTrailer)).toEqual({
  fieldChanges: 2,
  trailers: 1,
  peopleToCreate: 0,
  peopleToReuse: 0,
  imagesToUpload: 0,
});
```

Here `planWithTrailer.fieldChanges` contains two scalar changes and one trailer change. Add a no-trailer case returning `trailers: 0`.

- [ ] **Step 2: Run the presentation test and verify failure**

Run: `npm test -- src/ui/modalPresentation.test.ts`

Expected: FAIL because `countConfirmSummary` currently counts every field change as a scalar field and has no trailer count.

- [ ] **Step 3: Implement separated counts and reusable footer segments**

Change `countConfirmSummary` to:

```ts
const trailerCount = plan.fieldChanges.some((change) => change.key === 'trailer') ? 1 : 0;

return {
  fieldChanges: plan.fieldChanges.filter((change) => change.key !== 'trailer').length,
  trailers: trailerCount,
  peopleToCreate: plan.peopleToCreate.length,
  peopleToReuse: plan.peopleToReuse.length,
  imagesToUpload: plan.assetsToUpload.length,
};
```

Add a small `formatImpactSegments` helper so Review and Confirm use the same segment order and omit `0 trailers`. Preserve the current labels for all other segments.

- [ ] **Step 4: Update Confirm import content**

In `src/ui/ConfirmStep.tsx`:

- exclude `trailer` from `fieldLabels`;
- add a dedicated summary row when selected, such as `1 trailer to update` with the proposed trailer title;
- update **What happens after you start** to say selected movie values and trailer are applied to the unsaved form, without suggesting video upload;
- use the shared footer segments so Review and Confirm footers remain the same height and order.

In `src/ui/ReviewStep.tsx`, calculate scalar and trailer counts separately and use the shared footer formatter. The representative selected state should read:

`7 fields · 1 trailer · 3 images · 2 new people · 1 reused person`

- [ ] **Step 5: Add confirmation and footer integration tests**

In `src/ui/ImportModal.test.tsx`, assert:

- selected trailer appears in the Confirm summary by title;
- it is not listed as a scalar field label;
- both sticky footers include `1 trailer` in the same segment order;
- both omit the trailer segment when unselected;
- no copy says the trailer is uploaded.

- [ ] **Step 6: Run focused presentation tests**

Run: `npm test -- src/ui/modalPresentation.test.ts src/ui/ImportModal.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit the confirmation increment**

```bash
git add src/ui/modalPresentation.ts src/ui/ReviewStep.tsx src/ui/ConfirmStep.tsx src/ui/modalPresentation.test.ts src/ui/ImportModal.test.tsx
git commit -m "feat: summarize trailer import separately"
```

---

### Task 6: Update the harness, documentation, and release evidence

**Interfaces**

- **Consumes:** completed trailer behavior.
- **Produces:** sanitized visual scenarios, current operator documentation, release verification, and sandbox acceptance evidence.
- **Does not authorize:** merge, push, Cloudflare deployment, Marketplace submission, or production DatoCMS installation.

**Files:**

- Modify: `src/devHarness.tsx`
- Modify: `src/devHarness.test.ts`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/documentation-map.md`
- Modify: `docs/superpowers/specs/2026-08-17-tmdb-trailer-import-design.md`
- Modify: `docs/superpowers/plans/2026-08-17-tmdb-trailer-import.md`

- [ ] **Step 1: Add failing harness tests**

Extend `src/devHarness.test.ts` to require sanitized scenarios for:

- empty current Trailer field with the proposed trailer selected;
- populated different Trailer field with replacement unselected;
- already-current trailer;
- no qualifying trailer;
- broken thumbnail fallback;
- light and captured Dato dark token modes.

Assert that the harness performs no live TMDB or DatoCMS call.

- [ ] **Step 2: Run the harness tests and verify failure**

Run: `npm test -- src/devHarness.test.ts`

Expected: FAIL because the harness movie and current-value fixtures contain no trailer states.

- [ ] **Step 3: Add sanitized harness data and scenarios**

Update `src/devHarness.tsx` with a non-sensitive YouTube-style key such as `demo_trailer_123` and no live customer data. Keep image and external links inert in tests through the existing browser-test boundaries. Add scenario query parameters only where they materially help review; do not create a second harness application.

- [ ] **Step 4: Update current documentation**

In `README.md`:

- add Trailer to the supported movie fields and schema requirements;
- identify the required Dato field type as External Video (`video`);
- explain official-English-YouTube eligibility and deterministic single-trailer selection;
- explain empty-field preselection, replacement opt-in, and no-fallback behavior;
- add Trailer checks to the manual DatoCMS sandbox checklist;
- state that preview links open YouTube and the plugin does not embed or upload video.

In `CHANGELOG.md`, add an **Added** entry under **Unreleased** for the optional native Trailer import.

In `docs/documentation-map.md`, move the design and this plan from **Planned work** to **Historical implementation records** only after sandbox acceptance. Update both document statuses to **Implemented and verified** at that same point. Until sandbox acceptance completes, use **Implemented; sandbox acceptance pending**.

- [ ] **Step 5: Run automated verification**

Run: `npm test`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

Run: `npm run verify:package`

Expected: PASS.

Run: `npm run verify:release`

Expected: PASS with no untracked generated package artifacts.

- [ ] **Step 6: Perform visual harness verification**

Run: `npm run dev`

Inspect the Review and Confirm screens in both light and Dato dark harness modes at wide and narrow modal widths. Verify:

- Trailer sits between Field changes and Images.
- The compact card does not cause horizontal overflow.
- Checkbox, preview link, focus ring, fallback, and sticky footer remain usable.
- Footer height and segment order match between Review and Confirm.
- No console error or warning appears during trailer interaction.

Record any visual defect as a failing test before correcting it.

- [ ] **Step 7: Perform manual DatoCMS sandbox acceptance**

Against the existing test environment only:

1. Map Trailer to a DatoCMS External Video field.
2. Open the field add-on on a movie with an empty Trailer field.
3. Load a TMDB movie with an eligible official English YouTube trailer.
4. Confirm the proposal starts selected, preview opens safely, and no YouTube embed loads in the modal.
5. Confirm the import and verify the native External Video editor renders the value on the unsaved movie form.
6. Save only if the sandbox test calls for persistence.
7. Repeat with a different existing trailer and verify replacement starts unselected.
8. Repeat with the same trailer and verify **Already current trailer** is disabled.
9. Repeat with no eligible trailer and verify the current value remains untouched.
10. Confirm no additional TMDB request, Dato upload, or trailer-specific progress phase appears.

If this cannot be completed, document the exact unverified items and keep the spec/plan status at **sandbox acceptance pending**.

- [ ] **Step 8: Update implementation status and commit the release evidence**

After automated verification, harness review, and sandbox acceptance:

```bash
git add src/devHarness.tsx src/devHarness.test.ts README.md CHANGELOG.md docs/documentation-map.md docs/superpowers/specs/2026-08-17-tmdb-trailer-import-design.md docs/superpowers/plans/2026-08-17-tmdb-trailer-import.md
git commit -m "docs: complete trailer import verification"
```

Do not merge or push without a fresh user request. Report the branch, commit range, verification commands, and any acceptance item that remains unverified.
