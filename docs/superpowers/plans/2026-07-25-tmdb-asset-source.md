# TMDB Asset Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a proper DatoCMS asset source that lets editors create Media Area uploads from TMDB movie artwork through DatoCMS' native asset-source flow.

**Architecture:** Keep the current movie-import Review step as the primary guided import flow, and add a separate `assetSources`/`renderAssetSource` surface for editors who want to pull TMDB artwork directly from DatoCMS media selection. Reuse the existing TMDB client and normalized image-candidate contract where practical, then call DatoCMS `ctx.select()` with a URL or base64 resource so DatoCMS creates the Upload. Treat TMDB image CORS as an explicit architecture gate: ship URL mode only if verified in the target sandbox, otherwise add a small proxy/base64 service as a separate approved phase.

**Tech Stack:** TypeScript, React, Vite, Vitest, Testing Library, `datocms-plugin-sdk@2.2.6`, `datocms-react-ui@2.2.6`, existing TMDB API client, optional serverless image proxy if URL-based `ctx.select()` cannot read TMDB image URLs.

## Global Constraints

- Keep the existing Search → Review → Import movie workflow intact.
- The asset source is a companion Media Area upload source, not a replacement for the movie-import review selector.
- Do not write movie fields from the asset-source flow.
- Do not create Person records from the asset-source flow.
- Do not save or publish DatoCMS records from the asset-source flow.
- Use the existing TMDB read token stored in plugin configuration.
- Never print TMDB tokens or DatoCMS user tokens in errors or logs.
- Use DatoCMS React UI components and tokens so the UI stays native and dark-mode compatible.
- Preserve the current frontend-only boundary unless the CORS verification task proves a proxy/base64 path is required and the user explicitly approves that expansion.
- For URL-based `ctx.select()`, the selected image URL must be readable by DatoCMS and must satisfy the SDK requirement for `Access-Control-Allow-Origin`.
- English poster filtering remains the default for poster selections.
- Backdrops can be selected through the asset source, but the asset source creates uploads only; field assignment remains a normal DatoCMS media-field action.
- TMDB attribution must be written into upload metadata where supported.
- Normal test runs use mocked clients and sanitized fixtures, not live TMDB.

---

## External References

- DatoCMS Asset Sources docs: `https://www.datocms.com/docs/plugin-sdk/asset-sources`
- DatoCMS SDK `renderAssetSource` type: `https://github.com/datocms/plugins-sdk/blob/master/packages/sdk/src/hooks/renderAssetSource.ts`
- DatoCMS React UI docs: `https://www.datocms.com/docs/plugin-sdk/react-datocms-ui`

---

## File Structure

- Modify `src/main.tsx`: register the TMDB asset source and route `renderAssetSource()` into React.
- Modify `src/App.tsx`: add an `assetSource` plugin screen variant.
- Create `src/ui/TmdbAssetSource.tsx`: asset-source search, result selection, and upload-confirm UI.
- Create `src/ui/TmdbAssetSource.test.tsx`: component and interaction tests for the asset-source UI.
- Create `src/providers/tmdbAssetSource.ts`: convert normalized image candidates into DatoCMS `ctx.select()` upload payloads.
- Create `src/providers/tmdbAssetSource.test.ts`: unit tests for filename, metadata, and resource mapping.
- Modify `src/providers/tmdbClient.ts`: add any missing image-search helpers only if the asset-source UI cannot reuse `searchMovies()` and `getMoviePackage()`.
- Modify `src/providers/tmdbNormalizer.ts`: export image URL constants or helper functions if needed by the asset-source payload mapper.
- Modify `src/devHarness.tsx`: add `?impeccable=asset-source` or equivalent harness state for browser review.
- Modify `src/ui/ImportModal.css`: add minimal asset-source styles using existing MediaCard-inspired classes where possible.
- Modify `README.md`: document what the asset source does, how to enable it, and the CORS/proxy limitation.
- Optional create `src/providers/tmdbImageProxy.ts`: only if approved after CORS verification, provide a proxy/base64 resource adapter boundary.

---

### Task 1: Register the TMDB Asset Source Shell

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`
- Create: `src/ui/TmdbAssetSource.tsx`
- Create: `src/ui/TmdbAssetSource.test.tsx`

**Interfaces:**
- Produces: `PluginScreen` variant `{ type: 'assetSource'; assetSourceId: string; searchMovies: TmdbClient['searchMovies']; loadMovie: (tmdbId: number) => Promise<NormalizedMovie>; selectUpload: (candidate: NormalizedImageCandidate, movie: NormalizedMovie) => Promise<void>; }`
- Produces: `TmdbAssetSource(props: TmdbAssetSourceProps): JSX.Element`
- Consumes: existing `TmdbClient.searchMovies()` and `normalizeTmdbMovie()`

- [ ] **Step 1: Write the failing screen-routing test**

Add this test to `src/ui/TmdbAssetSource.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { TmdbAssetSource } from './TmdbAssetSource';

describe('TmdbAssetSource', () => {
  it('renders the TMDB asset source search surface', () => {
    render(
      <TmdbAssetSource
        searchMovies={async () => []}
        loadMovie={async () => {
          throw new Error('loadMovie should not run on initial render');
        }}
        selectUpload={async () => undefined}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Add artwork from TMDB' })).toBeInTheDocument();
    expect(screen.getByLabelText('Movie title')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search TMDB' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run src/ui/TmdbAssetSource.test.tsx`

Expected: fail because `src/ui/TmdbAssetSource.tsx` does not exist.

- [ ] **Step 3: Create the minimal asset-source component**

Create `src/ui/TmdbAssetSource.tsx`:

```tsx
import { Button, TextField } from 'datocms-react-ui';
import { useState } from 'react';
import type { NormalizedImageCandidate, NormalizedMovie } from '../domain/movie';
import type { TmdbSearchResult } from '../providers/tmdbTypes';

export type TmdbAssetSourceProps = {
  searchMovies: (query: { title: string; year?: number | null }) => Promise<TmdbSearchResult[]>;
  loadMovie: (tmdbId: number) => Promise<NormalizedMovie>;
  selectUpload: (candidate: NormalizedImageCandidate, movie: NormalizedMovie) => Promise<void>;
};

export function TmdbAssetSource({ searchMovies }: TmdbAssetSourceProps) {
  const [title, setTitle] = useState('');

  return (
    <section className="movie-import-modal">
      <div className="movie-import-modal__header">
        <p>TMDB asset source</p>
        <h2>Add artwork from TMDB</h2>
        <p>Search TMDB and add selected artwork to the DatoCMS Media Area.</p>
      </div>
      <div className="movie-import-modal__fieldset">
        <TextField
          id="tmdb-asset-source-title"
          name="title"
          label="Movie title"
          value={title}
          onChange={(value) => setTitle(value)}
        />
        <div className="movie-import-modal__actions">
          <Button buttonType="primary" type="button" onClick={() => void searchMovies({ title })}>
            Search TMDB
          </Button>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Add the screen variant and route**

Modify `src/App.tsx` so `PluginScreen` includes:

```ts
| {
    type: 'assetSource';
    assetSourceId: string;
    searchMovies: (query: { title: string; year?: number | null }) => Promise<TmdbSearchResult[]>;
    loadMovie: (tmdbId: number) => Promise<NormalizedMovie>;
    selectUpload: (candidate: NormalizedImageCandidate, movie: NormalizedMovie) => Promise<void>;
  }
```

Render it with:

```tsx
if (screen.type === 'assetSource') {
  return (
    <TmdbAssetSource
      searchMovies={screen.searchMovies}
      loadMovie={screen.loadMovie}
      selectUpload={screen.selectUpload}
    />
  );
}
```

Add imports for `TmdbAssetSource`, `TmdbSearchResult`, `NormalizedMovie`, and `NormalizedImageCandidate` as needed.

- [ ] **Step 5: Register the asset source in DatoCMS**

Modify the `connect({ ... })` object in `src/main.tsx`:

```ts
  assetSources() {
    return [
      {
        id: 'tmdb-images',
        name: 'TMDB Images',
        icon: {
          type: 'svg',
          viewBox: '0 0 24 24',
          content: '<path fill="currentColor" d="M4 5h16v14H4V5Zm2 2v10h12V7H6Zm2 8 2.5-3 2 2.4 1.5-1.9 2 2.5H8Z"/>',
        },
        modal: {
          width: 'l',
        },
      },
    ];
  },
```

Add `renderAssetSource(assetSourceId, ctx)`:

```ts
  renderAssetSource(assetSourceId, ctx) {
    const params = parsePluginParameters(ctx.plugin.attributes.parameters);
    const tmdb = new TmdbClient({ readToken: params.tmdbReadToken });

    render(
      {
        type: 'assetSource',
        assetSourceId,
        searchMovies: (query) => tmdb.searchMovies(query),
        loadMovie: async (tmdbId) => normalizeTmdbMovie(await tmdb.getMoviePackage(tmdbId), params.actorLimit),
        selectUpload: async () => {
          ctx.alert('TMDB asset upload selection is not implemented yet.');
        },
      },
      ctx,
    );
  },
```

- [ ] **Step 6: Run the focused test**

Run: `npm test -- --run src/ui/TmdbAssetSource.test.tsx`

Expected: pass.

- [ ] **Step 7: Run typecheck**

Run: `npm run typecheck`

Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add src/main.tsx src/App.tsx src/ui/TmdbAssetSource.tsx src/ui/TmdbAssetSource.test.tsx
git commit -m "feat: register tmdb asset source shell"
```

---

### Task 2: Map TMDB Image Candidates to DatoCMS Upload Payloads

**Files:**
- Create: `src/providers/tmdbAssetSource.ts`
- Create: `src/providers/tmdbAssetSource.test.ts`
- Modify: `src/providers/tmdbNormalizer.ts`

**Interfaces:**
- Produces: `tmdbImageUploadPayload(candidate: NormalizedImageCandidate, movie: NormalizedMovie): TmdbAssetSourceUploadPayload`
- Produces: `TmdbAssetSourceUploadPayload` with `resource`, `copyright`, `author`, `notes`, `tags`, and `default_field_metadata`
- Consumes: `NormalizedImageCandidate` and `NormalizedMovie`

- [ ] **Step 1: Write the failing payload test**

Create `src/providers/tmdbAssetSource.test.ts`:

```ts
import type { NormalizedImageCandidate, NormalizedMovie } from '../domain/movie';
import { tmdbImageUploadPayload } from './tmdbAssetSource';

const movie: NormalizedMovie = {
  tmdbId: 843,
  title: 'In the Mood for Love',
  primaryReleaseDate: '2000-09-29',
  yearReleased: 2000,
  mpaaRating: 'PG',
  runtime: 99,
  tagline: 'Feel the heat.',
  description: 'Two neighbors form a strong bond.',
  directors: [],
  actors: [],
  images: [],
};

const candidate: NormalizedImageCandidate = {
  providerKey: 'tmdb',
  providerImageId: '/backdrop.jpg',
  movieIdentity: { providerKey: 'tmdb', tmdbId: 843 },
  type: 'backdrop',
  originalUrl: 'https://image.tmdb.org/t/p/original/backdrop.jpg',
  previewUrl: 'https://image.tmdb.org/t/p/w780/backdrop.jpg',
  width: 1920,
  height: 1080,
  language: null,
  rank: 1,
  attribution: 'TMDB',
};

describe('tmdbImageUploadPayload', () => {
  it('creates a DatoCMS upload payload with attribution and metadata', () => {
    expect(tmdbImageUploadPayload(candidate, movie)).toEqual({
      resource: {
        url: 'https://image.tmdb.org/t/p/original/backdrop.jpg',
        filename: 'tmdb-843-in-the-mood-for-love-backdrop.jpg',
      },
      copyright: 'Image metadata from TMDB',
      author: 'TMDB',
      notes: 'TMDB movie 843: In the Mood for Love. Source image /backdrop.jpg.',
      tags: ['tmdb', 'tmdb-movie-843', 'movie-artwork', 'backdrop'],
      default_field_metadata: {
        en: {
          alt: 'In the Mood for Love backdrop',
          title: 'In the Mood for Love backdrop',
          custom_data: {
            provider: 'tmdb',
            tmdbMovieId: 843,
            tmdbImagePath: '/backdrop.jpg',
            imageType: 'backdrop',
          },
        },
      },
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run src/providers/tmdbAssetSource.test.ts`

Expected: fail because `tmdbAssetSource.ts` does not exist.

- [ ] **Step 3: Implement the payload mapper**

Create `src/providers/tmdbAssetSource.ts`:

```ts
import type { NormalizedImageCandidate, NormalizedMovie } from '../domain/movie';

export type TmdbAssetSourceUploadPayload = {
  resource: {
    url: string;
    filename: string;
  };
  copyright: string;
  author: string;
  notes: string;
  tags: string[];
  default_field_metadata: {
    en: {
      alt: string;
      title: string;
      custom_data: {
        provider: string;
        tmdbMovieId: number;
        tmdbImagePath: string;
        imageType: 'poster' | 'backdrop';
      };
    };
  };
};

export function tmdbImageUploadPayload(candidate: NormalizedImageCandidate, movie: NormalizedMovie): TmdbAssetSourceUploadPayload {
  const imageType = candidate.type === 'poster' ? 'poster' : 'backdrop';
  const titleSlug = slugify(movie.title);
  const extension = extensionFromPath(candidate.providerImageId);

  return {
    resource: {
      url: candidate.originalUrl,
      filename: `tmdb-${movie.tmdbId}-${titleSlug}-${imageType}.${extension}`,
    },
    copyright: 'Image metadata from TMDB',
    author: candidate.attribution ?? 'TMDB',
    notes: `TMDB movie ${movie.tmdbId}: ${movie.title}. Source image ${candidate.providerImageId}.`,
    tags: ['tmdb', `tmdb-movie-${movie.tmdbId}`, 'movie-artwork', imageType],
    default_field_metadata: {
      en: {
        alt: `${movie.title} ${imageType}`,
        title: `${movie.title} ${imageType}`,
        custom_data: {
          provider: candidate.providerKey,
          tmdbMovieId: movie.tmdbId,
          tmdbImagePath: candidate.providerImageId,
          imageType,
        },
      },
    },
  };
}

function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'movie';
}

function extensionFromPath(path: string) {
  const match = path.match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : 'jpg';
}
```

- [ ] **Step 4: Run the focused test**

Run: `npm test -- --run src/providers/tmdbAssetSource.test.ts`

Expected: pass.

- [ ] **Step 5: Add an accented-title filename test**

Append to `src/providers/tmdbAssetSource.test.ts`:

```ts
it('normalizes accented movie titles in filenames', () => {
  const payload = tmdbImageUploadPayload(candidate, { ...movie, title: 'Amélie' });

  expect(payload.resource.filename).toBe('tmdb-843-amelie-backdrop.jpg');
  expect(payload.default_field_metadata.en.alt).toBe('Amélie backdrop');
});
```

- [ ] **Step 6: Run the focused test again**

Run: `npm test -- --run src/providers/tmdbAssetSource.test.ts`

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add src/providers/tmdbAssetSource.ts src/providers/tmdbAssetSource.test.ts
git commit -m "feat: map tmdb artwork to asset upload payloads"
```

---

### Task 3: Build the Asset Source Search and Selection UI

**Files:**
- Modify: `src/ui/TmdbAssetSource.tsx`
- Modify: `src/ui/TmdbAssetSource.test.tsx`
- Modify: `src/ui/ImportModal.css`

**Interfaces:**
- Consumes: `TmdbAssetSourceProps.searchMovies()`
- Consumes: `TmdbAssetSourceProps.loadMovie()`
- Consumes: `TmdbAssetSourceProps.selectUpload()`
- Produces: accessible search results and image candidate cards

- [ ] **Step 1: Write the search-result interaction test**

Add to `src/ui/TmdbAssetSource.test.tsx`:

```tsx
import userEvent from '@testing-library/user-event';

it('searches movies, loads artwork, and selects an image upload', async () => {
  const selectUpload = vi.fn();

  render(
    <TmdbAssetSource
      searchMovies={async () => [
        {
          id: 843,
          title: 'In the Mood for Love',
          releaseDate: '2000-09-29',
          overview: 'Two neighbors form a strong bond.',
          posterPath: '/poster.jpg',
          posterUrl: 'https://image.tmdb.org/t/p/w154/poster.jpg',
        },
      ]}
      loadMovie={async () => ({
        tmdbId: 843,
        title: 'In the Mood for Love',
        primaryReleaseDate: '2000-09-29',
        yearReleased: 2000,
        mpaaRating: 'PG',
        runtime: 99,
        tagline: null,
        description: 'Two neighbors form a strong bond.',
        directors: [],
        actors: [],
        images: [
          {
            providerKey: 'tmdb',
            providerImageId: '/poster.jpg',
            movieIdentity: { providerKey: 'tmdb', tmdbId: 843 },
            type: 'poster',
            originalUrl: 'https://image.tmdb.org/t/p/original/poster.jpg',
            previewUrl: 'https://image.tmdb.org/t/p/w342/poster.jpg',
            width: 1000,
            height: 1500,
            language: 'en',
            rank: 1,
            attribution: 'TMDB',
          },
        ],
      })}
      selectUpload={selectUpload}
    />,
  );

  await userEvent.type(screen.getByLabelText('Movie title'), 'In the Mood for Love');
  await userEvent.click(screen.getByRole('button', { name: 'Search TMDB' }));
  await userEvent.click(await screen.findByRole('button', { name: /Use In the Mood for Love/i }));
  await userEvent.click(await screen.findByRole('button', { name: /Add poster to Media Area/i }));

  expect(selectUpload).toHaveBeenCalledTimes(1);
  expect(selectUpload.mock.calls[0][0]).toMatchObject({
    providerImageId: '/poster.jpg',
    type: 'poster',
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run src/ui/TmdbAssetSource.test.tsx`

Expected: fail because the search/result UI is incomplete.

- [ ] **Step 3: Implement search state**

Update `src/ui/TmdbAssetSource.tsx` to track:

```ts
const [results, setResults] = useState<TmdbSearchResult[]>([]);
const [movie, setMovie] = useState<NormalizedMovie | null>(null);
const [isSearching, setIsSearching] = useState(false);
const [error, setError] = useState<string | null>(null);
```

Add a search handler:

```ts
async function handleSearch() {
  setError(null);
  setIsSearching(true);
  try {
    setResults(await searchMovies({ title }));
  } catch (error) {
    setError(error instanceof Error ? error.message : 'TMDB search failed.');
  } finally {
    setIsSearching(false);
  }
}
```

Wire the button:

```tsx
<Button buttonType="primary" type="button" onClick={() => void handleSearch()} disabled={title.trim().length === 0 || isSearching}>
  {isSearching ? 'Searching…' : 'Search TMDB'}
</Button>
```

- [ ] **Step 4: Render movie results**

Add result cards after the search form:

```tsx
{results.length > 0 ? (
  <div className="movie-import-modal__cards">
    {results.map((result) => (
      <article className="movie-import-modal__card" key={result.id}>
        {result.posterUrl ? <img src={result.posterUrl} alt={`${result.title} poster`} /> : null}
        <div>
          <h3>{result.title}</h3>
          <p>{result.releaseDate ? result.releaseDate.slice(0, 4) : 'Year unavailable'}</p>
          {result.overview ? <p>{result.overview}</p> : null}
        </div>
        <Button type="button" onClick={() => void loadSelectedMovie(result.id)}>
          Use {result.title}
        </Button>
      </article>
    ))}
  </div>
) : null}
```

Add:

```ts
async function loadSelectedMovie(tmdbId: number) {
  setError(null);
  try {
    setMovie(await loadMovie(tmdbId));
  } catch (error) {
    setError(error instanceof Error ? error.message : 'TMDB artwork could not be loaded.');
  }
}
```

- [ ] **Step 5: Render poster and backdrop image candidates**

Render after `movie` is set:

```tsx
{movie ? (
  <div className="movie-import-modal__review-list">
    <div className="movie-import-modal__asset-group">
      <div className="movie-import-modal__asset-copy">
        <h4>{movie.title} artwork</h4>
        <p>Select one TMDB image to add to the DatoCMS Media Area.</p>
      </div>
      <div className="movie-import-modal__image-grid">
        {movie.images
          .filter((image) => image.type === 'backdrop' || image.language === 'en')
          .map((image, index) => (
            <button
              className="movie-import-modal__image-option"
              key={`${image.providerKey}:${image.providerImageId}`}
              type="button"
              onClick={() => void selectUpload(image, movie)}
            >
              <span className="movie-import-modal__image-preview">
                <img
                  className={`movie-import-modal__image-thumb movie-import-modal__image-thumb--${image.type}`}
                  src={image.previewUrl ?? image.originalUrl}
                  alt={`${movie.title} ${image.type} option ${index + 1}`}
                  loading="lazy"
                />
                <span className="movie-import-modal__image-meta">
                  {image.attribution ?? image.providerKey.toUpperCase()} · {image.width ?? 'Unknown'} × {image.height ?? 'unknown'} · {image.language ? image.language.toUpperCase() : 'No language metadata'}
                </span>
              </span>
              <span className="movie-import-modal__image-footer">
                Add {image.type} to Media Area
              </span>
            </button>
          ))}
      </div>
    </div>
  </div>
) : null}
```

- [ ] **Step 6: Show errors accessibly**

Render:

```tsx
{error ? <p role="alert" className="movie-import-modal__warning">{error}</p> : null}
```

- [ ] **Step 7: Run focused UI tests**

Run: `npm test -- --run src/ui/TmdbAssetSource.test.tsx`

Expected: pass.

- [ ] **Step 8: Run detector**

Run: `node /Users/roger.tinch/.agents/skills/impeccable/scripts/detect.mjs --json src/ui/TmdbAssetSource.tsx src/ui/ImportModal.css`

Expected: `[]`.

- [ ] **Step 9: Commit**

```bash
git add src/ui/TmdbAssetSource.tsx src/ui/TmdbAssetSource.test.tsx src/ui/ImportModal.css
git commit -m "feat: add tmdb asset source picker"
```

---

### Task 4: Wire `ctx.select()` Behind a Testable Adapter

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/providers/tmdbAssetSource.ts`
- Modify: `src/providers/tmdbAssetSource.test.ts`

**Interfaces:**
- Consumes: `tmdbImageUploadPayload(candidate, movie)`
- Produces: `createTmdbAssetSourceSelector(ctx): (candidate, movie) => Promise<void>`

- [ ] **Step 1: Write the selector adapter test**

Append to `src/providers/tmdbAssetSource.test.ts`:

```ts
import { createTmdbAssetSourceSelector } from './tmdbAssetSource';

it('passes the upload payload to ctx.select', async () => {
  const select = vi.fn();
  const selectUpload = createTmdbAssetSourceSelector({ select });

  await selectUpload(candidate, movie);

  expect(select).toHaveBeenCalledWith(tmdbImageUploadPayload(candidate, movie));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run src/providers/tmdbAssetSource.test.ts`

Expected: fail because `createTmdbAssetSourceSelector` does not exist.

- [ ] **Step 3: Implement the adapter**

Add to `src/providers/tmdbAssetSource.ts`:

```ts
type AssetSourceSelectCtx = {
  select: (payload: TmdbAssetSourceUploadPayload) => void;
};

export function createTmdbAssetSourceSelector(ctx: AssetSourceSelectCtx) {
  return async (candidate: NormalizedImageCandidate, movie: NormalizedMovie) => {
    ctx.select(tmdbImageUploadPayload(candidate, movie));
  };
}
```

- [ ] **Step 4: Wire the adapter in `renderAssetSource`**

Modify `src/main.tsx`:

```ts
import { createTmdbAssetSourceSelector } from './providers/tmdbAssetSource';
```

Use it in `renderAssetSource`:

```ts
selectUpload: createTmdbAssetSourceSelector(ctx),
```

- [ ] **Step 5: Run focused tests**

Run: `npm test -- --run src/providers/tmdbAssetSource.test.ts src/ui/TmdbAssetSource.test.tsx`

Expected: pass.

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add src/main.tsx src/providers/tmdbAssetSource.ts src/providers/tmdbAssetSource.test.ts
git commit -m "feat: create tmdb uploads from asset source"
```

---

### Task 5: Verify TMDB Image CORS and Decide URL vs Proxy/Base64

**Files:**
- Create: `docs/superpowers/specs/2026-07-25-tmdb-asset-source-cors.md`
- Optional create after approval: `src/providers/tmdbImageProxy.ts`

**Interfaces:**
- Consumes: DatoCMS SDK requirement that URL resources need `Access-Control-Allow-Origin`.
- Produces: written decision: `url-resource-ok`, `proxy-required`, or `base64-required`.

- [ ] **Step 1: Document the CORS verification command**

Create `docs/superpowers/specs/2026-07-25-tmdb-asset-source-cors.md`:

```markdown
# TMDB Asset Source CORS Verification

## Question

Can DatoCMS create uploads directly from TMDB image URLs passed to `ctx.select({ resource: { url } })`, or do we need a proxy/base64 resource path?

## SDK Constraint

DatoCMS URL resources must be readable by DatoCMS and respond with an `Access-Control-Allow-Origin` header.

## Local Header Probe

Run:

`curl -I -L "https://image.tmdb.org/t/p/original/<known-file-path>"`

Record whether `access-control-allow-origin` is present.

## Sandbox Acceptance Probe

1. Install the local plugin in the DatoCMS sandbox.
2. Open a Media Area field.
3. Choose Add asset.
4. Choose TMDB Images.
5. Search for a known movie.
6. Select one poster and one backdrop in separate attempts.
7. Confirm whether DatoCMS creates the Upload.

## Decision

- `url-resource-ok`: direct `ctx.select({ resource: { url } })` works in sandbox.
- `proxy-required`: direct URL fails and a serverless proxy must return CORS-safe image responses.
- `base64-required`: direct URL fails and proxy should return base64 data URIs to the plugin.
```

- [ ] **Step 2: Run the local header probe**

Run with a real TMDB image path from a fixture or sandbox response:

```bash
curl -I -L "https://image.tmdb.org/t/p/original/backdrop.jpg"
```

Expected if direct URL is risky: no `access-control-allow-origin` response header.

- [ ] **Step 3: Run sandbox acceptance**

Use the checklist in `docs/superpowers/specs/2026-07-25-tmdb-asset-source-cors.md`.

Expected: one of `url-resource-ok`, `proxy-required`, or `base64-required`.

- [ ] **Step 4: Stop if proxy/base64 is required**

If the decision is `proxy-required` or `base64-required`, stop implementation and ask the user to approve the backend/proxy expansion.

Do not add a proxy in this task without explicit approval because it expands beyond the current frontend-only boundary.

- [ ] **Step 5: Commit the decision doc**

```bash
git add docs/superpowers/specs/2026-07-25-tmdb-asset-source-cors.md
git commit -m "docs: record tmdb asset source cors decision"
```

---

### Task 6: Add Dev Harness and Visual Review State

**Files:**
- Modify: `src/devHarness.tsx`
- Modify: `src/ui/TmdbAssetSource.test.tsx`

**Interfaces:**
- Produces: local URL `http://127.0.0.1:5174/?impeccable=asset-source`
- Consumes: `TmdbAssetSource`

- [ ] **Step 1: Write a harness smoke test**

Add to `src/ui/TmdbAssetSource.test.tsx`:

```tsx
it('supports a no-result state', async () => {
  render(
    <TmdbAssetSource
      searchMovies={async () => []}
      loadMovie={async () => {
        throw new Error('not used');
      }}
      selectUpload={async () => undefined}
    />,
  );

  await userEvent.type(screen.getByLabelText('Movie title'), 'Nope');
  await userEvent.click(screen.getByRole('button', { name: 'Search TMDB' }));

  expect(await screen.findByText('No TMDB movies matched this search.')).toBeInTheDocument();
});
```

- [ ] **Step 2: Implement no-result copy**

In `src/ui/TmdbAssetSource.tsx`, render:

```tsx
{!isSearching && title.trim().length > 0 && results.length === 0 ? (
  <p className="movie-import-modal__empty">No TMDB movies matched this search.</p>
) : null}
```

Gate it with a `hasSearched` state so it does not appear on first render.

- [ ] **Step 3: Add the dev harness route**

Modify `src/devHarness.tsx` so `isDevHarnessRequest()` recognizes `?impeccable=asset-source` and renders `TmdbAssetSource` with fixture-backed `searchMovies`, `loadMovie`, and `selectUpload`.

Use fixture images from `src/test/fixtures/tmdb/complete-movie.json` and the existing `normalizeTmdbMovie()` helper.

- [ ] **Step 4: Run the dev server**

Run: `npm run dev`

Expected: Vite serves on port `5174`.

- [ ] **Step 5: Inspect in browser**

Open: `http://127.0.0.1:5174/?impeccable=asset-source`

Verify:

- Search surface renders.
- Movie results render.
- Poster/backdrop cards render.
- Selecting an image shows a success notice or harness-visible selected state.
- Mobile width has no horizontal overflow.

- [ ] **Step 6: Run detector**

Run: `node /Users/roger.tinch/.agents/skills/impeccable/scripts/detect.mjs --json src/ui/TmdbAssetSource.tsx src/devHarness.tsx`

Expected: `[]`.

- [ ] **Step 7: Commit**

```bash
git add src/devHarness.tsx src/ui/TmdbAssetSource.tsx src/ui/TmdbAssetSource.test.tsx
git commit -m "test: add tmdb asset source visual harness"
```

---

### Task 7: Document Editor Behavior and Release Boundary

**Files:**
- Modify: `README.md`
- Create: `docs/superpowers/specs/2026-07-25-tmdb-asset-source-editor-guide.md`

**Interfaces:**
- Consumes: final asset-source behavior from Tasks 1-6.
- Produces: maintainer and editor-facing documentation.

- [ ] **Step 1: Add README section**

Append to `README.md`:

```markdown
## TMDB Images asset source

The plugin can expose a `TMDB Images` asset source inside DatoCMS' Media Area upload flow.

Use it when an editor wants to create a DatoCMS Upload from TMDB artwork outside the guided movie-import modal.

This asset source:

- searches TMDB movies;
- shows TMDB posters and backdrops;
- creates a DatoCMS Upload from the selected image;
- writes TMDB attribution and source metadata to the upload when supported;
- does not update movie fields;
- does not create Person records;
- does not save or publish records.

The guided movie-import modal remains the recommended path when an editor wants to update movie metadata, Hero Image, and Other Images together.

### CORS/proxy note

DatoCMS asset-source URL resources must be readable by DatoCMS. If TMDB image URLs cannot be selected directly in the sandbox, this feature requires an approved image proxy or base64 resource path before release.
```

- [ ] **Step 2: Create editor guide**

Create `docs/superpowers/specs/2026-07-25-tmdb-asset-source-editor-guide.md`:

```markdown
# TMDB Images Asset Source Editor Guide

## When to use it

Use TMDB Images when you want to add a poster or backdrop to the DatoCMS Media Area without running the full movie import workflow.

Use the movie import modal when you want to review movie metadata, Hero Image, Other Images, directors, and actors together.

## What happens

1. You choose TMDB Images from DatoCMS' asset source picker.
2. You search for a movie.
3. You select one poster or backdrop.
4. DatoCMS creates a Media Area upload.
5. You can use that upload in normal DatoCMS file or gallery fields.

## What does not happen

- The movie record is not saved.
- The movie record is not published.
- Movie fields are not changed automatically.
- Person records are not created.

## Attribution

Uploads created from TMDB include TMDB source metadata where DatoCMS supports it.
```

- [ ] **Step 3: Run documentation grep**

Run:

```bash
rg -n "TMDB Images|asset source|CORS|proxy" README.md docs/superpowers
```

Expected: the new README and editor-guide sections appear.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/superpowers/specs/2026-07-25-tmdb-asset-source-editor-guide.md
git commit -m "docs: explain tmdb asset source behavior"
```

---

### Task 8: Final Verification and Release Gate

**Files:**
- Modify only if verification finds defects in files from earlier tasks.

**Interfaces:**
- Consumes: all prior task output.
- Produces: release evidence and explicit acceptance boundary.

- [ ] **Step 1: Run full tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: typecheck and Vite build pass.

- [ ] **Step 3: Run Impeccable detector**

Run:

```bash
node /Users/roger.tinch/.agents/skills/impeccable/scripts/detect.mjs --json src/ui/TmdbAssetSource.tsx src/ui/ImportModal.css src/devHarness.tsx
```

Expected: `[]`.

- [ ] **Step 4: Run browser harness review**

Open: `http://127.0.0.1:5174/?impeccable=asset-source`

Verify:

- desktop search/result/artwork states;
- mobile search/result/artwork states;
- keyboard focus order reaches search, result selection, and artwork selection;
- no horizontal overflow at 390px;
- no console errors except known harness favicon noise.

- [ ] **Step 5: Run DatoCMS sandbox acceptance**

In the sandbox project:

1. Install or refresh the local plugin URL.
2. Open the Media Area add/upload flow.
3. Choose `TMDB Images`.
4. Search for `In the Mood for Love`.
5. Select one poster.
6. Confirm an Upload is created.
7. Repeat for one backdrop.
8. Confirm attribution/source metadata is present where expected.

Expected: poster and backdrop uploads are created from TMDB images.

- [ ] **Step 6: Record acceptance boundary**

If sandbox acceptance was not run, state:

```markdown
Local tests and harness passed. Live DatoCMS sandbox asset-source acceptance remains unverified.
```

If sandbox acceptance passed, state:

```markdown
Local tests, harness, and DatoCMS sandbox asset-source acceptance passed.
```

- [ ] **Step 7: Commit final fixes**

Only if Step 1-5 required changes:

```bash
git add <changed-files>
git commit -m "fix: finish tmdb asset source acceptance"
```

---

## Self-Review

- Spec coverage: This plan covers asset-source registration, search UI, TMDB image mapping, DatoCMS upload creation, CORS/proxy decision, visual harness, documentation, and final verification.
- Placeholder scan: The plan intentionally stops at a proxy/base64 gate because that is an authority boundary, not a missing implementation detail.
- Type consistency: The core handoff types are `TmdbAssetSourceProps`, `tmdbImageUploadPayload()`, `TmdbAssetSourceUploadPayload`, and `createTmdbAssetSourceSelector()`.
- Product boundary: The asset source creates Media Area uploads only and does not replace the guided movie importer.
