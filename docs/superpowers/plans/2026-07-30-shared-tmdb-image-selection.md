# Shared TMDB Image Selection Implementation Plan

**Status:** Historical implementation plan; completed with later revisions

The shared grid and progressive reveal shipped. Browser fingerprinting and automatic artwork preselection were later removed. Current behavior keeps English posters in TMDB rank order, prioritizes exact 3840x2160 backdrops before TMDB rank, starts every artwork destination unselected, and selects the Poster and Hero **Do not import** options by default when those destinations are configured. See the [current README](../../../README.md) and the companion design's current-implementation note.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deduplicate visually identical TMDB artwork, progressively reveal every unique candidate, and assign each backdrop from one shared grid to Hero Image, Other Images, or neither.

**Architecture:** Add a provider-facing browser fingerprint adapter and a pure deduplication engine, then feed the processed candidates into the existing modal state. Keep selection rules in `imageProvider.ts`, orchestration in `ImportModal.tsx`, and presentation in `ImagePicker.tsx`; the existing import-plan and upload contracts remain unchanged.

**Tech Stack:** React, TypeScript, browser Fetch/Canvas APIs, Vitest, Testing Library, DatoCMS React UI, Vite

## Global Constraints

- A backdrop cannot be assigned to both Hero Image and Other Images.
- Hero Image allows at most one backdrop; Other Images allows multiple backdrops.
- Duplicate grouping requires the same image type, an aspect-ratio difference of no more than one percent, and a 64-bit difference-hash Hamming distance of two or less.
- Keep the highest-resolution duplicate; use TMDB rank and stable identity as tie-breakers.
- Order each duplicate group by the best rank among all its members.
- Analyze at most four images concurrently.
- A failed candidate analysis keeps that candidate; a whole-processor failure falls back to the ranked raw candidates.
- Initially show ten unique posters and ten unique backdrops; each `Show 10 more` action reveals ten more in its own section.
- Continue filtering posters to English-language candidates.
- Continue preselecting the first unique poster, the first unique backdrop as Hero Image, and the next five unique backdrops as Other Images.
- Keep assigned candidates visible outside the current reveal batch.
- Do not add dependencies, backend services, persistence, DatoCMS schema changes, or import-payload changes.

---

### Task 1: Pure Artwork Fingerprinting and Deduplication

**Files:**
- Create: `src/providers/imageFingerprint.ts`
- Create: `src/providers/imageFingerprint.test.ts`
- Create: `src/providers/imageDeduplication.ts`
- Create: `src/providers/imageDeduplication.test.ts`

**Interfaces:**
- Produces:
  - `ImageFingerprint = { hash: bigint; aspectRatio: number | null }`
  - `ImageFingerprintLoader = (candidate: NormalizedImageCandidate) => Promise<ImageFingerprint>`
  - `differenceHashFromRgba(data, width, height): bigint`
  - `hammingDistance(left, right): number`
  - `deduplicateImageCandidates(candidates, loadFingerprint, concurrency?): Promise<NormalizedImageCandidate[]>`
- Consumes: `NormalizedImageCandidate` from `src/domain/movie.ts`

- [ ] **Step 1: Write failing tests for the hash primitives**

Create `src/providers/imageFingerprint.test.ts` with fixed 9-by-8 RGBA samples:

```ts
import { differenceHashFromRgba, hammingDistance } from './imageFingerprint';

function rgbaFromLuminance(values: number[]) {
  return new Uint8ClampedArray(values.flatMap((value) => [value, value, value, 255]));
}

it('computes one comparison bit for each horizontal pixel pair', () => {
  const row = [0, 20, 10, 30, 20, 40, 30, 50, 40];
  const rgba = rgbaFromLuminance(Array.from({ length: 8 }, () => row).flat());

  expect(differenceHashFromRgba(rgba, 9, 8)).toBe(0xaaaaaaaaaaaaaaaan);
});

it('counts differing hash bits', () => {
  expect(hammingDistance(0b1010n, 0b0011n)).toBe(2);
});

it('rejects a sample that is not 9 by 8 pixels', () => {
  expect(() => differenceHashFromRgba(new Uint8ClampedArray(4), 1, 1))
    .toThrow('Difference hash requires a 9 × 8 RGBA sample.');
});
```

- [ ] **Step 2: Run the hash tests and verify they fail**

Run:

```bash
npx vitest run src/providers/imageFingerprint.test.ts
```

Expected: FAIL because `imageFingerprint.ts` does not exist.

- [ ] **Step 3: Implement the pure hash functions**

Create `src/providers/imageFingerprint.ts`:

```ts
import type { NormalizedImageCandidate } from '../domain/movie';

export type ImageFingerprint = {
  hash: bigint;
  aspectRatio: number | null;
};

export type ImageFingerprintLoader = (
  candidate: NormalizedImageCandidate,
) => Promise<ImageFingerprint>;

export function differenceHashFromRgba(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): bigint {
  if (width !== 9 || height !== 8 || data.length !== width * height * 4) {
    throw new Error('Difference hash requires a 9 × 8 RGBA sample.');
  }

  let hash = 0n;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const left = luminanceAt(data, y * width + x);
      const right = luminanceAt(data, y * width + x + 1);
      hash = (hash << 1n) | (left < right ? 1n : 0n);
    }
  }

  return hash;
}

export function hammingDistance(left: bigint, right: bigint): number {
  let value = left ^ right;
  let count = 0;

  while (value !== 0n) {
    count += 1;
    value &= value - 1n;
  }

  return count;
}

function luminanceAt(data: Uint8ClampedArray, pixelIndex: number) {
  const offset = pixelIndex * 4;
  return data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
}
```

- [ ] **Step 4: Write failing deduplication tests**

Create `src/providers/imageDeduplication.test.ts` with candidate fixtures and injected fingerprints. Cover:

```ts
it('keeps the highest-resolution duplicate at the best group rank', async () => {
  const rankedSmall = candidate('/small.jpg', 'backdrop', 1, 1280, 720);
  const lowerRankedLarge = candidate('/large.jpg', 'backdrop', 9, 3840, 2160);
  const distinct = candidate('/distinct.jpg', 'backdrop', 2, 1920, 1080);

  const result = await deduplicateImageCandidates(
    [rankedSmall, distinct, lowerRankedLarge],
    fingerprintLoader({
      '/small.jpg': { hash: 0b1010n, aspectRatio: 16 / 9 },
      '/large.jpg': { hash: 0b1010n, aspectRatio: 16 / 9 },
      '/distinct.jpg': { hash: 0b11110000n, aspectRatio: 16 / 9 },
    }),
  );

  expect(result.map((image) => image.providerImageId))
    .toEqual(['/large.jpg', '/distinct.jpg']);
});
```

Also test:

- posters never group with backdrops;
- a ratio difference greater than one percent prevents grouping;
- a Hamming distance of two groups and three does not;
- equal areas prefer lower rank, then `providerKey:providerImageId`;
- a rejected fingerprint keeps that candidate;
- no more than four loader promises are active;
- output is deterministic when input order changes but ranks and identities do not.

- [ ] **Step 5: Run the deduplication tests and verify they fail**

Run:

```bash
npx vitest run src/providers/imageDeduplication.test.ts
```

Expected: FAIL because `imageDeduplication.ts` does not exist.

- [ ] **Step 6: Implement bounded, conservative grouping**

Create `src/providers/imageDeduplication.ts`. Use a four-worker queue to load fingerprints, represent failures as `null`, and greedily group ranked candidates only against a group’s anchor fingerprint.

Implement the exported path and helpers with these exact thresholds and ordering rules:

```ts
const DEFAULT_CONCURRENCY = 4;
const MAX_ASPECT_RATIO_DIFFERENCE = 0.01;
const MAX_HASH_DISTANCE = 2;

type FingerprintedCandidate = {
  candidate: NormalizedImageCandidate;
  fingerprint: ImageFingerprint | null;
};

type DuplicateGroup = {
  anchor: ImageFingerprint | null;
  members: FingerprintedCandidate[];
  bestRank: number;
  stableKey: string;
};

export async function deduplicateImageCandidates(
  candidates: NormalizedImageCandidate[],
  loadFingerprint: ImageFingerprintLoader,
  concurrency = DEFAULT_CONCURRENCY,
): Promise<NormalizedImageCandidate[]> {
  const ranked = [...candidates].sort(compareRankThenIdentity);
  const fingerprinted = await mapWithConcurrency(
    ranked,
    concurrency,
    async (candidate): Promise<FingerprintedCandidate> => ({
      candidate,
      fingerprint: await loadFingerprint(candidate).catch(() => null),
    }),
  );
  const groups: DuplicateGroup[] = [];

  for (const item of fingerprinted) {
    const matchingGroup = item.fingerprint
      ? groups.find((group) => group.anchor && isDuplicate(group.members[0], item))
      : undefined;

    if (matchingGroup) {
      matchingGroup.members.push(item);
      matchingGroup.bestRank = Math.min(matchingGroup.bestRank, item.candidate.rank);
      matchingGroup.stableKey = [
        matchingGroup.stableKey,
        imageIdentity(item.candidate),
      ].sort()[0];
    } else {
      groups.push({
        anchor: item.fingerprint,
        members: [item],
        bestRank: item.candidate.rank,
        stableKey: imageIdentity(item.candidate),
      });
    }
  }

  return groups
    .sort((left, right) =>
      left.bestRank - right.bestRank ||
      left.stableKey.localeCompare(right.stableKey),
    )
    .map((group) => [...group.members]
      .sort((left, right) =>
        pixelArea(right.candidate) - pixelArea(left.candidate) ||
        compareRankThenIdentity(left.candidate, right.candidate),
      )[0].candidate);
}

function isDuplicate(
  left: FingerprintedCandidate,
  right: FingerprintedCandidate,
) {
  if (
    left.candidate.type !== right.candidate.type ||
    !left.fingerprint ||
    !right.fingerprint ||
    left.fingerprint.aspectRatio === null ||
    right.fingerprint.aspectRatio === null
  ) {
    return false;
  }

  const ratioDifference =
    Math.abs(left.fingerprint.aspectRatio - right.fingerprint.aspectRatio) /
    Math.max(left.fingerprint.aspectRatio, right.fingerprint.aspectRatio);

  return ratioDifference <= MAX_ASPECT_RATIO_DIFFERENCE &&
    hammingDistance(left.fingerprint.hash, right.fingerprint.hash) <=
      MAX_HASH_DISTANCE;
}

async function mapWithConcurrency<Input, Output>(
  inputs: Input[],
  concurrency: number,
  worker: (input: Input) => Promise<Output>,
) {
  const output = new Array<Output>(inputs.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < inputs.length) {
      const index = nextIndex;
      nextIndex += 1;
      output[index] = await worker(inputs[index]);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), inputs.length) },
      runWorker,
    ),
  );
  return output;
}
```

Add `pixelArea`, `imageIdentity`, and `compareRankThenIdentity` as small pure helpers. Treat missing or non-positive dimensions as area `-1`. Do not mutate candidate objects or replace the canonical candidate’s `rank`.

- [ ] **Step 7: Run focused tests**

Run:

```bash
npx vitest run src/providers/imageFingerprint.test.ts src/providers/imageDeduplication.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/providers/imageFingerprint.ts src/providers/imageFingerprint.test.ts src/providers/imageDeduplication.ts src/providers/imageDeduplication.test.ts
git commit -m "✨ feat(images): add perceptual duplicate detection"
```

---

### Task 2: Browser Fingerprint Adapter and TMDB Analysis URLs

**Files:**
- Modify: `src/domain/movie.ts`
- Modify: `src/providers/tmdbNormalizer.ts`
- Modify: `src/providers/tmdbNormalizer.test.ts`
- Create: `src/providers/browserImageFingerprint.ts`
- Create: `src/providers/browserImageFingerprint.test.ts`
- Create: `src/providers/imagePreparation.ts`
- Create: `src/providers/imagePreparation.test.ts`

**Interfaces:**
- Consumes: `differenceHashFromRgba` and `ImageFingerprint` from Task 1
- Produces:
  - optional `NormalizedImageCandidate.analysisUrl`
  - `loadBrowserImageFingerprint(candidate, dependencies?): Promise<ImageFingerprint>`
  - `prepareSelectableImages(images, loadFingerprint?): Promise<NormalizedImageCandidate[]>`

- [ ] **Step 1: Write failing normalizer and adapter tests**

In `src/providers/tmdbNormalizer.test.ts`, require low-bandwidth analysis URLs while preserving current preview URLs:

```ts
expect(normalized.images[0]).toMatchObject({
  previewUrl: `https://image.tmdb.org/t/p/w342${poster.file_path}`,
  analysisUrl: `https://image.tmdb.org/t/p/w300${poster.file_path}`,
});

expect(firstBackdrop).toMatchObject({
  previewUrl: `https://image.tmdb.org/t/p/w780${backdrop.file_path}`,
  analysisUrl: `https://image.tmdb.org/t/p/w300${backdrop.file_path}`,
});
```

Create `src/providers/browserImageFingerprint.test.ts`. Inject a successful fetch, bitmap decoder, and 9-by-8 canvas context; assert:

- `analysisUrl` is requested before `previewUrl`;
- the decoded bitmap is drawn into a 9-by-8 canvas;
- the returned aspect ratio uses the decoded bitmap dimensions;
- the bitmap’s `close()` method runs in `finally`;
- non-OK responses throw a generic image-analysis error;
- missing `analysisUrl` falls back to `previewUrl`, then `originalUrl`.

Create `src/providers/imagePreparation.test.ts` and assert that `prepareSelectableImages`:

- excludes non-English posters before fingerprint loading;
- processes English posters and backdrops independently;
- returns unique posters followed by unique backdrops in rank order;
- passes the injected fingerprint loader through to the pure deduplication engine.

- [ ] **Step 2: Run focused tests and verify they fail**

Run:

```bash
npx vitest run src/providers/tmdbNormalizer.test.ts src/providers/browserImageFingerprint.test.ts src/providers/imagePreparation.test.ts
```

Expected: FAIL because `analysisUrl` and the browser adapter do not exist.

- [ ] **Step 3: Add the provider-neutral analysis URL**

Add to `NormalizedImageCandidate` in `src/domain/movie.ts`:

```ts
analysisUrl?: string;
```

In `src/providers/tmdbNormalizer.ts`, add:

```ts
const TMDB_IMAGE_ANALYSIS_BASE = 'https://image.tmdb.org/t/p/w300';
```

Set `analysisUrl` in `normalizeImage` without changing `previewUrl`, `originalUrl`, or rank.

- [ ] **Step 4: Implement the browser adapter**

Create `src/providers/browserImageFingerprint.ts` with an injectable dependency boundary:

```ts
type FingerprintDependencies = {
  fetchImage: (url: string) => Promise<Blob>;
  decodeImage: (blob: Blob) => Promise<ImageBitmap>;
  createCanvas: () => HTMLCanvasElement;
};

const browserDependencies: FingerprintDependencies = {
  async fetchImage(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Image analysis request failed.');
    }
    return response.blob();
  },
  decodeImage: (blob) => createImageBitmap(blob),
  createCanvas: () => document.createElement('canvas'),
};

export async function loadBrowserImageFingerprint(
  candidate: NormalizedImageCandidate,
  dependencies = browserDependencies,
): Promise<ImageFingerprint> {
  const url = candidate.analysisUrl ?? candidate.previewUrl ?? candidate.originalUrl;
  const blob = await dependencies.fetchImage(url);
  const bitmap = await dependencies.decodeImage(blob);

  try {
    const canvas = dependencies.createCanvas();
    canvas.width = 9;
    canvas.height = 8;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Image analysis canvas is unavailable.');
    context.drawImage(bitmap, 0, 0, 9, 8);
    const rgba = context.getImageData(0, 0, 9, 8).data;
    return {
      hash: differenceHashFromRgba(rgba, 9, 8),
      aspectRatio: bitmap.height > 0 ? bitmap.width / bitmap.height : null,
    };
  } finally {
    bitmap.close();
  }
}
```

The default `fetchImage` must check `response.ok` before reading the blob. Error messages must not include the signed URL, response body, or plugin token.

- [ ] **Step 5: Add the selectable-image preparation boundary**

Create `src/providers/imagePreparation.ts`:

```ts
export async function prepareSelectableImages(
  images: NormalizedImageCandidate[],
  loadFingerprint: ImageFingerprintLoader = loadBrowserImageFingerprint,
) {
  const englishPosters = images.filter(isEnglishPoster);
  const backdrops = images.filter((image) => image.type === 'backdrop');
  const [uniquePosters, uniqueBackdrops] = await Promise.all([
    deduplicateImageCandidates(englishPosters, loadFingerprint),
    deduplicateImageCandidates(backdrops, loadFingerprint),
  ]);

  return [...uniquePosters, ...uniqueBackdrops];
}
```

Keep English filtering here so a higher-resolution non-English or textless duplicate cannot replace an eligible English poster.

- [ ] **Step 6: Run focused tests**

Run:

```bash
npx vitest run src/providers/tmdbNormalizer.test.ts src/providers/browserImageFingerprint.test.ts src/providers/imagePreparation.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/domain/movie.ts src/providers/tmdbNormalizer.ts src/providers/tmdbNormalizer.test.ts src/providers/browserImageFingerprint.ts src/providers/browserImageFingerprint.test.ts src/providers/imagePreparation.ts src/providers/imagePreparation.test.ts
git commit -m "✨ feat(images): add browser artwork fingerprints"
```

---

### Task 3: Exclusive Image Defaults and Selection Transitions

**Files:**
- Modify: `src/providers/imageProvider.ts`
- Modify: `src/providers/imageProvider.test.ts`

**Interfaces:**
- Produces:
  - `ImageDestinationAvailability`
  - `defaultImageSelection(current, images, availability): ImageSelection`
  - `selectHeroImage(selection, image): ImageSelection`
  - `toggleOtherImage(selection, image): ImageSelection`
- Consumes: processed unique candidates from Tasks 1 and 2

- [ ] **Step 1: Rewrite the failing default-selection expectations**

Update `src/providers/imageProvider.test.ts` so the default Hero candidate is excluded from Other Images:

```ts
expect(selection.heroImage?.providerImageId).toBe('/backdrop-1.jpg');
expect(selection.backdrops.map((image) => image.providerImageId))
  .toEqual(['/backdrop-2.jpg']);
```

Expand the six-backdrop fixture to seven and expect Other Images 2 through 6, five total.

Add destination-availability tests:

```ts
expect(defaultImageSelection(current, images, {
  poster: false,
  heroImage: false,
  backdrops: true,
}).backdrops[0]?.providerImageId).toBe('/backdrop-1.jpg');
```

Also verify that unmapped destinations remain `null` or empty.

- [ ] **Step 2: Add failing transition tests**

Add tests that:

- assigning Hero removes the same image from `backdrops`;
- moving Hero preserves unrelated Other Images;
- adding the current Hero to Other Images clears `heroImage`;
- unchecking Other Images does not affect Hero;
- clearing Hero with `null` preserves Other Images;
- provider key plus provider image ID defines identity.

Use the exact transitions:

```ts
const heroResult = selectHeroImage(
  { poster: null, heroImage: null, backdrops: [first, second] },
  first,
);
expect(heroResult).toEqual({
  poster: null,
  heroImage: first,
  backdrops: [second],
});

const otherResult = toggleOtherImage(
  { poster: null, heroImage: first, backdrops: [] },
  first,
);
expect(otherResult).toEqual({
  poster: null,
  heroImage: null,
  backdrops: [first],
});
```

- [ ] **Step 3: Run the provider tests and verify they fail**

Run:

```bash
npx vitest run src/providers/imageProvider.test.ts
```

Expected: FAIL because defaults overlap and transition helpers do not exist.

- [ ] **Step 4: Implement destination-aware defaults and transitions**

Add:

```ts
export type ImageDestinationAvailability = {
  poster: boolean;
  heroImage: boolean;
  backdrops: boolean;
};
```

Require availability as the third argument to `defaultImageSelection`. Compute Hero first, then select five Other Images after filtering out the Hero identity:

```ts
const heroImage =
  availability.heroImage && heroImageEmpty ? rankedBackdrops[0] ?? null : null;
const otherCandidates = heroImage
  ? rankedBackdrops.filter((candidate) => !sameImage(candidate, heroImage))
  : rankedBackdrops;

return {
  poster:
    availability.poster && posterEmpty
      ? ranked(images, 'poster').find(isEnglishPoster) ?? null
      : null,
  heroImage,
  backdrops:
    availability.backdrops && backdropsEmpty
      ? otherCandidates.slice(0, 5)
      : [],
};
```

Implement transitions as pure functions returning new arrays:

```ts
export function selectHeroImage(
  selection: ImageSelection,
  image: NormalizedImageCandidate | null,
): ImageSelection {
  return {
    ...selection,
    heroImage: image,
    backdrops: image
      ? selection.backdrops.filter((candidate) => !sameImage(candidate, image))
      : [...selection.backdrops],
  };
}

export function toggleOtherImage(
  selection: ImageSelection,
  image: NormalizedImageCandidate,
): ImageSelection {
  const alreadySelected = selection.backdrops.some((candidate) =>
    sameImage(candidate, image),
  );

  return {
    ...selection,
    heroImage:
      !alreadySelected && selection.heroImage &&
      sameImage(selection.heroImage, image)
        ? null
        : selection.heroImage,
    backdrops: alreadySelected
      ? selection.backdrops.filter((candidate) => !sameImage(candidate, image))
      : [...selection.backdrops, image],
  };
}
```

Export or retain one provider-aware `sameImage` helper in this module. Do not mutate `selection` or its `backdrops`.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npx vitest run src/providers/imageProvider.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/providers/imageProvider.ts src/providers/imageProvider.test.ts
git commit -m "✨ feat(images): enforce exclusive backdrop destinations"
```

---

### Task 4: Prepare Unique Artwork During Movie Loading

**Files:**
- Modify: `src/ui/SearchStep.tsx`
- Modify: `src/ui/ImportModal.tsx`
- Modify: `src/ui/ImportModal.test.tsx`

**Interfaces:**
- Consumes:
  - `prepareSelectableImages` from Task 2
  - destination-aware defaults and transitions from Task 3
- Produces:
  - `SearchActivity` value `checking_artwork`
  - optional `ImportModalProps.prepareImages` test seam
  - processed `movie.images` for Review Changes

- [ ] **Step 1: Write failing progress and fallback tests**

In `src/ui/ImportModal.test.tsx`, add `prepareImages` as an injected async function and use deferred promises to verify:

1. artwork preparation and Person matching are both started after `loadMovie`;
2. the screen shows `Checking artwork…` while preparation is pending;
3. after artwork resolves, `Matching directors and actors…` remains when Person matching is still pending;
4. Review Changes receives the processed candidate list;
5. rejected preparation logs `Movie Importer artwork preparation failed`, keeps raw ranked images, and still reaches Review Changes;
6. a Person-matching rejection remains blocking and returns to Find Movie.

Assert the fallback diagnostic object does not contain image URLs or tokens.

- [ ] **Step 2: Run the modal tests and verify they fail**

Run:

```bash
npx vitest run src/ui/ImportModal.test.tsx
```

Expected: FAIL because `prepareImages` and `checking_artwork` do not exist.

- [ ] **Step 3: Extend the search activity UI**

In `src/ui/SearchStep.tsx`:

```ts
export type SearchActivity =
  | 'searching'
  | 'loading_movie'
  | 'checking_artwork'
  | 'matching_people'
  | null;
```

Return `Checking artwork…` from `searchActivityMessage`. Treat every movie-load phase as busy so both search forms and result actions remain disabled.

- [ ] **Step 4: Integrate concurrent artwork and Person preparation**

Add to `ImportModalProps`:

```ts
prepareImages?: (
  images: NormalizedImageCandidate[],
) => Promise<NormalizedImageCandidate[]>;
```

Default it to `prepareSelectableImages`.

```ts
const prepareImages = props.prepareImages ?? prepareSelectableImages;
```

After loading the movie:

1. start a reflected Person-matching promise;
2. set `checking_artwork`;
3. await artwork preparation with a catch that logs token-safe details and returns `loaded.images`;
4. set `matching_people`;
5. await the already-running reflected Person result;
6. preserve the existing Person error branch;
7. create `preparedMovie = { ...loaded, images: preparedImages }`;
8. set movie, comparisons, people, and defaults from `preparedMovie`;
9. pass destination availability derived from `mappedFields`;
10. move to Review Changes.

Use reflected results so a fast rejection cannot become an unhandled promise while the other task is pending:

```ts
const peoplePromise = (props.resolvePeople?.(peopleCandidates) ?? Promise.resolve([]))
  .then(
    (value) => ({ status: 'fulfilled' as const, value }),
    (reason: unknown) => ({ status: 'rejected' as const, reason }),
  );

setSearchActivity('checking_artwork');
const preparedImages = await prepareImages(loaded.images).catch((reason) => {
  console.error(
    'Movie Importer artwork preparation failed',
    tokenSafeErrorDetails(reason),
  );
  return loaded.images;
});

setSearchActivity('matching_people');
const peopleResult = await peoplePromise;
if (peopleResult.status === 'rejected') {
  console.error(
    'Movie Importer person matching failed',
    tokenSafeErrorDetails(peopleResult.reason),
  );
  setError(
    'The TMDB movie loaded, but Person matching failed. Check that this editor can list Person records, then try again.',
  );
  setStep('search');
  return;
}

const preparedMovie = { ...loaded, images: preparedImages };
const availability = {
  poster: props.mappedFields.includes('poster'),
  heroImage: props.mappedFields.includes('heroImage'),
  backdrops: props.mappedFields.includes('backdrops'),
};
setMovie(preparedMovie);
setImageSelection(
  defaultImageSelection(props.currentValues, preparedImages, availability),
);
```

Replace inline Hero and Other Images state updates with `selectHeroImage` and `toggleOtherImage`.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npx vitest run src/ui/ImportModal.test.tsx src/providers/imageProvider.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/ui/SearchStep.tsx src/ui/ImportModal.tsx src/ui/ImportModal.test.tsx
git commit -m "✨ feat(import): prepare unique artwork during lookup"
```

---

### Task 5: Shared Backdrop Grid and Incremental Reveal

**Files:**
- Modify: `src/ui/ImagePicker.tsx`
- Create: `src/ui/ImagePicker.test.tsx`
- Modify: `src/ui/ImportModal.test.tsx`

**Interfaces:**
- Consumes: exclusive selection callbacks from Task 3 through `ImagePickerProps`
- Produces: one shared Backdrops grid, independent poster/backdrop reveal counts, and section-specific `Show 10 more` controls

- [ ] **Step 1: Write failing isolated picker tests**

Create `src/ui/ImagePicker.test.tsx`. Render more than twenty unique posters and backdrops with controlled selection state.

Test:

- only ten posters and ten backdrops initially render;
- `Show 10 more posters` affects only posters;
- `Show 10 more backdrops` affects only backdrops;
- each backdrop preview renders once when both destinations are enabled;
- one Hero radio and one Other Images checkbox exist per visible backdrop;
- Hero-only and Other-Images-only mappings render only the applicable controls;
- selected candidates outside the first batch remain visible;
- `Do not import a Hero Image` remains available;
- preview failures still show `Preview unavailable`;
- controls have destination-specific accessible names.

Use provider IDs in accessible names or test IDs so duplicate visible metadata does not make assertions ambiguous.

- [ ] **Step 2: Run the picker tests and verify they fail**

Run:

```bash
npx vitest run src/ui/ImagePicker.test.tsx
```

Expected: FAIL because the current picker truncates arrays and renders two backdrop lanes.

- [ ] **Step 3: Replace truncation with section reveal state**

In `ImagePicker.tsx`, replace `MAX_IMAGE_CANDIDATES_PER_TYPE` with:

```ts
const IMAGE_REVEAL_BATCH_SIZE = 10;
```

Track:

```ts
const [visiblePosterCount, setVisiblePosterCount] = useState(IMAGE_REVEAL_BATCH_SIZE);
const [visibleBackdropCount, setVisibleBackdropCount] = useState(IMAGE_REVEAL_BATCH_SIZE);
```

Create a pure local helper that returns the first `count` candidates plus assigned candidates outside that slice, without duplicates and in source order.

```ts
function visibleWithSelections(
  candidates: NormalizedImageCandidate[],
  count: number,
  selected: Array<NormalizedImageCandidate | null>,
) {
  const selectedKeys = new Set(
    selected
      .filter((candidate): candidate is NormalizedImageCandidate =>
        candidate !== null)
      .map(imageIdentity),
  );

  return candidates.filter(
    (candidate, index) =>
      index < count || selectedKeys.has(imageIdentity(candidate)),
  );
}

function imageIdentity(image: NormalizedImageCandidate) {
  return `${image.providerKey}:${image.providerImageId}`;
}
```

Render a muted DatoCMS `Button` only when the section has unrevealed candidates. Its visible text may remain `Show 10 more`; its accessible name must specify posters or backdrops.

```tsx
{posters.length > visiblePosterCount ? (
  <div className="movie-import-modal__image-reveal">
    <Button
      buttonType="muted"
      type="button"
      aria-label="Show 10 more posters"
      onClick={() => setVisiblePosterCount((count) =>
        Math.min(count + IMAGE_REVEAL_BATCH_SIZE, posters.length))}
    >
      Show 10 more
    </Button>
  </div>
) : null}
```

Repeat the complete block for backdrops with `visibleBackdropCount`, `backdrops.length`, and `aria-label="Show 10 more backdrops"`; do not create a coupled shared count.

- [ ] **Step 4: Replace duplicate lanes with one card component**

Replace `BackdropDestinationOption` with `SharedBackdropOption`. Its outer element must not be one `<label>` around both inputs.

Structure:

```tsx
<article className="movie-import-modal__image-option">
  <ImagePreview image={image} index={index} />
  <div className="movie-import-modal__image-footer movie-import-modal__image-footer--destinations">
    {allowHeroImage ? (
      <label className="movie-import-modal__image-destination">
        <input type="radio" name="hero-image-selection" checked={heroSelected} onChange={onSelectHero} />
        <span>Hero Image</span>
      </label>
    ) : null}
    {allowOtherImages ? (
      <label className="movie-import-modal__image-destination">
        <input type="checkbox" checked={otherSelected} onChange={onToggleOther} />
        <span>Other Images</span>
      </label>
    ) : null}
  </div>
</article>
```

Extract a small internal `ImagePreview` only if doing so removes duplicated preview-failure code without obscuring accessible names.

Remove secondary status chips and update helper copy to say:

`Assign each backdrop to Hero Image, Other Images, or neither. One image cannot be used for both destinations.`

- [ ] **Step 5: Update integration expectations**

In `src/ui/ImportModal.test.tsx`:

- replace the old “same backdrop can be used in both places” assertion;
- assert every backdrop preview occurs once;
- assert changing Hero and Other Images produces an exclusive import plan;
- retain provider-identity coverage;
- update the default import expectation so Hero Image is absent from `otherImagesToUpload`.

- [ ] **Step 6: Run focused tests**

Run:

```bash
npx vitest run src/ui/ImagePicker.test.tsx src/ui/ImportModal.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/ui/ImagePicker.tsx src/ui/ImagePicker.test.tsx src/ui/ImportModal.test.tsx
git commit -m "✨ feat(ui): share backdrop destination grid"
```

---

### Task 6: Native-Style Shared Card Polish and Full Verification

**Files:**
- Modify: `src/ui/ImportModal.css`
- Modify: `src/ui/ImportModal.css.test.ts`
- Modify: `src/devHarness.tsx`
- Modify: `src/devHarness.test.ts`

**Interfaces:**
- Consumes: shared-card markup and reveal controls from Task 5
- Produces: DatoCMS-consistent selected, unselected, focus, responsive, and progressive-reveal presentation

- [ ] **Step 1: Write failing CSS contract tests**

Extend `src/ui/ImportModal.css.test.ts` to require:

- the shared destination footer uses a vertical stack with a border between destination rows;
- each destination row keeps at least the existing minimum target height;
- selected cards use the existing Dato selected-border token;
- the selected footer uses selected surface and ink;
- unselected cards use neutral surface and border tokens;
- complete previews retain `object-fit: contain`;
- the reveal action aligns beneath its own grid and does not stretch media cards;
- the old destination-lane responsive selector is absent;
- the shared grid remains responsive at 540px and below.

- [ ] **Step 2: Run the CSS test and verify it fails**

Run:

```bash
npx vitest run src/ui/ImportModal.css.test.ts
```

Expected: FAIL because shared destination selectors do not exist and old lane rules remain.

- [ ] **Step 3: Implement the shared-card styles**

In `src/ui/ImportModal.css`:

- retain current card width, 144px preview canvas, containment, token aliases, border radius, hover border, and three-pixel selected outline;
- remove layout rules used only by duplicated destination lanes;
- add `.movie-import-modal__image-footer--destinations`;
- add `.movie-import-modal__image-destination`;
- apply selected footer tokens through `:has(input:checked)`;
- keep each radio and checkbox native and independently focusable;
- add a `.movie-import-modal__image-reveal` wrapper for the muted button;
- keep narrow cards within the modal without horizontal scrolling.

Use the existing spacing and selected-token aliases:

```css
.movie-import-modal__image-footer--destinations {
  display: grid;
  padding: 0;
}

.movie-import-modal__image-destination {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-height: 44px;
  padding: var(--spacing-s);
  cursor: pointer;
}

.movie-import-modal__image-destination + .movie-import-modal__image-destination {
  border-top: 1px solid var(--color--border);
}

.movie-import-modal__image-option:has(input:checked) {
  box-shadow: 0 0 0 3px var(--color--selected--border);
}

.movie-import-modal__image-option:has(input:checked)
  .movie-import-modal__image-footer--destinations {
  color: var(--movie-import-selected-control-ink);
  background: var(--movie-import-selected-control-surface);
  border-color: var(--movie-import-selected-control-border);
}

.movie-import-modal__image-reveal {
  display: flex;
  justify-content: flex-start;
  margin-top: var(--spacing-m);
}
```

If the current alias uses a fallback expression rather than the direct Dato token shown above, preserve that alias exactly and update the CSS contract assertion to match the production rule.

Do not copy private DatoCMS admin CSS or introduce hard-coded light/dark colors.

- [ ] **Step 4: Expand the harness data**

Update the modal harness fixtures to expose at least twelve English posters and twelve backdrops with valid unique identities. Keep selected examples within and outside the initial ten so the harness demonstrates:

- shared destination controls;
- exclusive selected states;
- independent `Show 10 more` buttons;
- an assigned candidate retained beyond the initial batch;
- light and DatoCMS dark themes.

Update `src/devHarness.test.ts` to assert the expanded fixture counts and identities.

- [ ] **Step 5: Run all automated checks**

Run:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Expected: all commands PASS.

- [ ] **Step 6: Inspect the harness**

Run:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5174/?impeccable=modal
http://127.0.0.1:5174/?impeccable=modal&theme=dato-dark&scenario=odyssey-existing
```

Verify:

- complete poster and backdrop previews;
- one shared backdrop grid;
- mutual exclusivity;
- no selected-state green surface;
- native Dato selected and unselected states;
- reveal buttons and retained out-of-batch selections;
- keyboard focus and control labels;
- desktop, intermediate, and narrow modal widths;
- stable sticky header and footer.

- [ ] **Step 7: Verify in the DatoCMS sandbox**

With the local plugin entry point running at `http://localhost:5174/`, use the configured test environment to:

1. search for a movie with more than ten artwork candidates;
2. confirm `Checking artwork…` appears;
3. confirm Review Changes opens if one image preview fails;
4. reveal additional posters and backdrops;
5. assign one Hero Image and multiple Other Images;
6. verify the Hero card is not also in Other Images;
7. complete a test import;
8. verify the original-resolution assets and destination fields are prepared correctly.

Do not treat the harness or automated tests as sandbox acceptance.

- [ ] **Step 8: Commit**

```bash
git add src/ui/ImportModal.css src/ui/ImportModal.css.test.ts src/devHarness.tsx src/devHarness.test.ts
git commit -m "💄 style(ui): polish shared artwork selection"
```

- [ ] **Step 9: Review the complete branch**

Run:

```bash
git log --oneline main..HEAD
git diff --stat main...HEAD
git diff --check main...HEAD
npm test
npm run lint
npm run build
```

Expected: six focused implementation commits after the design commits, a clean diff check, and all verification commands passing.
