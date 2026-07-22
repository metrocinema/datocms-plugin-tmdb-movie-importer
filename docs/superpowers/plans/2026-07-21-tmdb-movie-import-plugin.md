# TMDB Movie Import Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a frontend-only DatoCMS plugin that lets editors search or refresh TMDB movie data, review every proposed change, create/link people, upload selected images, and apply approved values to the unsaved movie form.

**Architecture:** Create a Vite React plugin shell with DatoCMS SDK hooks at the edge and plain TypeScript modules for providers, matching, planning, and import execution. TMDB remains the metadata provider, while image providers use a source-neutral contract so future image sources can be added without rewriting mapping or review behavior. DatoCMS writes go through the current editor context and stop before movie form updates if person or upload dependencies fail.

**Tech Stack:** TypeScript, React, Vite, Vitest, Testing Library, `datocms-plugin-sdk@2.2.6`, `datocms-react-ui@2.2.6`, `@datocms/cma-client@5.5.5`.

## Global Constraints

- Version one supports movie records only.
- Frontend-only: do not add a backend proxy or separate service.
- TMDB supplies canonical movie metadata and identity.
- Version one ships only a TMDB image adapter, but image candidates must use a provider-neutral contract.
- The TMDB language and content locale are fixed to US English for version one.
- The plugin writes only to the configured English locale for localized fields.
- DatoCMS remains the permission and publishing authority.
- DatoCMS writes must use the current editor's access token and environment.
- Do not request or store a separate project-wide DatoCMS CMA token.
- The TMDB read token is stored in plugin configuration and visible to authenticated browser users in this frontend-only version.
- Error messages and logs must never print TMDB or DatoCMS tokens.
- Missing TMDB values never clear existing DatoCMS values.
- Existing populated fields are unselected by default; empty fields are selected by default.
- Poster and backdrop replacements are preselected only when the destination field is empty.
- Backdrops default to the five highest-ranked TMDB backdrops when the destination is empty.
- Directors and actors use one shared person model.
- Person records created by the plugin remain drafts and are not published automatically.
- Person matching uses TMDB person ID when configured, otherwise exact normalized name with warnings.
- The plugin does not save or publish the movie record.
- The plugin does not automatically delete people or uploads created before a later failure.
- Normal test runs use mocked clients and sanitized fixtures, not live TMDB.

---

## File Structure

- Create `package.json`: scripts, dependencies, dev dependencies, and package metadata.
- Create `index.html`: Vite entry host for the DatoCMS plugin iframe.
- Create `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `vitest.config.ts`: TypeScript, build, and test configuration.
- Create `.gitignore`: generated Node and build outputs.
- Create `src/main.tsx`: DatoCMS `connect()` entry point and hook routing.
- Create `src/App.tsx`: thin route component for plugin configuration, field add-on, and modal screens.
- Create `src/plugin/parameters.ts`: plugin parameter schema, defaults, parsing, and validation.
- Create `src/plugin/datoFieldMapping.ts`: DatoCMS field compatibility checks and form-value helpers.
- Create `src/domain/movie.ts`: normalized movie, person, image, and import-plan types.
- Create `src/domain/fieldComparison.ts`: current-versus-proposed comparison and default selection rules.
- Create `src/domain/personMatching.ts`: name normalization and person match decisions.
- Create `src/domain/importPlanning.ts`: immutable import plan construction.
- Create `src/providers/tmdbClient.ts`: TMDB HTTP client with token-safe errors.
- Create `src/providers/tmdbNormalizer.ts`: TMDB movie detail/search normalization.
- Create `src/providers/imageProvider.ts`: provider-neutral image candidate contract and TMDB image adapter glue.
- Create `src/dato/datoGateway.ts`: person query/create and upload operations through the current editor token.
- Create `src/dato/importExecutor.ts`: confirmation write order and partial-result reporting.
- Create `src/ui/ConfigScreen.tsx`: admin configuration UI and validation summary.
- Create `src/ui/FieldAddon.tsx`: compact TMDB ID field add-on launcher.
- Create `src/ui/ImportModal.tsx`: three-step Search, Review, Import modal.
- Create `src/ui/SearchStep.tsx`, `src/ui/ReviewStep.tsx`, `src/ui/ConfirmStep.tsx`: focused modal step components.
- Create `src/ui/ImagePicker.tsx`, `src/ui/PersonResolutionList.tsx`, `src/ui/FieldDiffTable.tsx`: reusable review controls.
- Create `src/test/fixtures/tmdb/*.json`: sanitized TMDB fixtures.
- Create `src/**/*.test.ts` and `src/**/*.test.tsx`: unit, fixture, component, and mocked integration tests beside the code under test.
- Create `README.md`: local setup, DatoCMS configuration, security limitation, and sandbox verification notes.

---

### Task 1: Scaffold the Vite React Plugin Shell

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/setupTests.ts`
- Create: `README.md`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `test`, `test:watch`, `typecheck`, `lint`.
- Produces: `App(props: { screen: PluginScreen }): JSX.Element`.
- Produces: `PluginScreen` union with `config`, `fieldAddon`, `modal`, and `unknown`.
- Consumes: no earlier task output.

- [ ] **Step 1: Create package metadata and scripts**

Create `package.json` with this content:

```json
{
  "name": "mcs-datocms-plugin",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -b --pretty false",
    "lint": "tsc -b --pretty false"
  },
  "dependencies": {
    "@datocms/cma-client": "5.5.5",
    "@vitejs/plugin-react": "latest",
    "datocms-plugin-sdk": "2.2.6",
    "datocms-react-ui": "2.2.6",
    "react": "latest",
    "react-dom": "latest"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "latest",
    "@testing-library/react": "latest",
    "@testing-library/user-event": "latest",
    "@types/node": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "jsdom": "latest",
    "typescript": "7.0.2",
    "vite": "8.1.5",
    "vitest": "4.1.10"
  }
}
```

- [ ] **Step 2: Create TypeScript and Vite configuration**

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MCS TMDB Movie Import</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

Create `vite.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: true,
  },
});
```

Create `vitest.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
  },
});
```

Create `.gitignore`:

```gitignore
node_modules/
dist/
coverage/
.DS_Store
.env
.env.*
```

- [ ] **Step 3: Create the minimal React entry**

Create `src/setupTests.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

Create `src/App.tsx`:

```tsx
export type PluginScreen =
  | { type: 'config' }
  | { type: 'fieldAddon' }
  | { type: 'modal' }
  | { type: 'unknown'; label: string };

type AppProps = {
  screen: PluginScreen;
};

export function App({ screen }: AppProps) {
  if (screen.type === 'config') {
    return <div>Configure TMDB Movie Import</div>;
  }

  if (screen.type === 'fieldAddon') {
    return <button type="button">Find movie</button>;
  }

  if (screen.type === 'modal') {
    return <div>TMDB Movie Import</div>;
  }

  return <div>Unsupported plugin screen: {screen.label}</div>;
}
```

Create `src/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { connect } from 'datocms-plugin-sdk';
import { Canvas } from 'datocms-react-ui';
import 'datocms-react-ui/styles.css';
import { App, type PluginScreen } from './App';

function render(screen: PluginScreen, ctx: unknown) {
  const root = ReactDOM.createRoot(document.getElementById('root')!);
  root.render(
    <React.StrictMode>
      <Canvas ctx={ctx as never}>
        <App screen={screen} />
      </Canvas>
    </React.StrictMode>,
  );
}

connect({
  renderConfigScreen(ctx) {
    render({ type: 'config' }, ctx);
  },
  renderFieldExtension(_fieldExtensionId, ctx) {
    render({ type: 'fieldAddon' }, ctx);
  },
  renderModal(_modalId, ctx) {
    render({ type: 'modal' }, ctx);
  },
});
```

- [ ] **Step 4: Add a smoke test**

Create `src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders the config screen', () => {
    render(<App screen={{ type: 'config' }} />);

    expect(screen.getByText('Configure TMDB Movie Import')).toBeInTheDocument();
  });

  it('renders the field add-on launcher', () => {
    render(<App screen={{ type: 'fieldAddon' }} />);

    expect(screen.getByRole('button', { name: 'Find movie' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Install dependencies and verify scaffold**

Run: `npm install`

Expected: `package-lock.json` is created and dependencies install without errors.

Run: `npm test`

Expected: PASS for `src/App.test.tsx`.

Run: `npm run typecheck`

Expected: command exits 0.

Run: `npm run build`

Expected: command exits 0 and creates `dist/`.

- [ ] **Step 6: Commit scaffold**

Run:

```bash
git add .gitignore README.md index.html package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts vitest.config.ts src
git commit -m "chore: scaffold DatoCMS plugin app"
```

Expected: commit succeeds with only scaffold files staged.

---

### Task 2: Define Domain Types, Parameters, and Field Mapping Validation

**Files:**
- Create: `src/domain/movie.ts`
- Create: `src/plugin/parameters.ts`
- Create: `src/plugin/datoFieldMapping.ts`
- Create: `src/plugin/parameters.test.ts`
- Create: `src/plugin/datoFieldMapping.test.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `PluginScreen` from `src/App.tsx`.
- Produces: `PluginParameters`, `parsePluginParameters(input: unknown): PluginParameters`.
- Produces: `validatePluginParameters(params: PluginParameters): ValidationIssue[]`.
- Produces: `validateFieldMappings(params: PluginParameters, schema: DatoSchemaSnapshot): ValidationIssue[]`.
- Produces: normalized domain types used by every later task.

- [ ] **Step 1: Write parameter parsing tests**

Create `src/plugin/parameters.test.ts`:

```ts
import { parsePluginParameters, validatePluginParameters } from './parameters';

describe('plugin parameters', () => {
  it('fills safe defaults for a new install', () => {
    const params = parsePluginParameters({});

    expect(params.targetLocale).toBe('en');
    expect(params.actorLimit).toBe(10);
    expect(params.tmdbReadToken).toBe('');
  });

  it('rejects missing required mappings', () => {
    const issues = validatePluginParameters(parsePluginParameters({}));

    expect(issues.map((issue) => issue.code)).toContain('missing_tmdb_token');
    expect(issues.map((issue) => issue.code)).toContain('missing_movie_model');
    expect(issues.map((issue) => issue.code)).toContain('missing_person_model');
  });

  it('normalizes actor limit to a positive integer', () => {
    const params = parsePluginParameters({ actorLimit: '7' });

    expect(params.actorLimit).toBe(7);
  });
});
```

- [ ] **Step 2: Implement parameters and domain types**

Create `src/domain/movie.ts`:

```ts
export type MovieFieldKey =
  | 'title'
  | 'yearReleased'
  | 'mpaaRating'
  | 'runtime'
  | 'tmdbId'
  | 'tagline'
  | 'description'
  | 'poster'
  | 'backdrops'
  | 'directors'
  | 'actors';

export type PersonCandidate = {
  tmdbId: number;
  name: string;
  order: number;
  role: 'director' | 'actor';
};

export type NormalizedImageCandidate = {
  providerKey: string;
  providerImageId: string;
  movieIdentity: { providerKey: 'tmdb'; tmdbId: number };
  type: 'poster' | 'backdrop';
  originalUrl: string;
  width: number | null;
  height: number | null;
  language: string | null;
  rank: number;
  attribution: string | null;
};

export type NormalizedMovie = {
  tmdbId: number;
  title: string;
  primaryReleaseDate: string | null;
  yearReleased: number | null;
  mpaaRating: string | null;
  runtime: number | null;
  tagline: string | null;
  description: string | null;
  directors: PersonCandidate[];
  actors: PersonCandidate[];
  images: NormalizedImageCandidate[];
};

export type ValidationIssue = {
  code: string;
  message: string;
  severity: 'error' | 'warning';
};
```

Create `src/plugin/parameters.ts`:

```ts
import type { MovieFieldKey, ValidationIssue } from '../domain/movie';

export type MovieFieldMappings = Partial<Record<MovieFieldKey, string>>;

export type PluginParameters = {
  tmdbReadToken: string;
  movieModelApiKey: string;
  targetLocale: 'en';
  movieFields: MovieFieldMappings;
  personModelApiKey: string;
  personNameFieldApiKey: string;
  personTmdbIdFieldApiKey: string | null;
  actorLimit: number;
};

const DEFAULT_PARAMETERS: PluginParameters = {
  tmdbReadToken: '',
  movieModelApiKey: '',
  targetLocale: 'en',
  movieFields: {},
  personModelApiKey: '',
  personNameFieldApiKey: '',
  personTmdbIdFieldApiKey: null,
  actorLimit: 10,
};

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalStringValue(value: unknown): string | null {
  const parsed = stringValue(value);
  return parsed.length > 0 ? parsed : null;
}

function actorLimitValue(value: unknown): number {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : 10;
}

export function parsePluginParameters(input: unknown): PluginParameters {
  const source = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const rawFields = typeof source.movieFields === 'object' && source.movieFields !== null ? source.movieFields : {};

  return {
    ...DEFAULT_PARAMETERS,
    tmdbReadToken: stringValue(source.tmdbReadToken),
    movieModelApiKey: stringValue(source.movieModelApiKey),
    targetLocale: 'en',
    movieFields: rawFields as MovieFieldMappings,
    personModelApiKey: stringValue(source.personModelApiKey),
    personNameFieldApiKey: stringValue(source.personNameFieldApiKey),
    personTmdbIdFieldApiKey: optionalStringValue(source.personTmdbIdFieldApiKey),
    actorLimit: actorLimitValue(source.actorLimit),
  };
}

export function validatePluginParameters(params: PluginParameters): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!params.tmdbReadToken) {
    issues.push({ code: 'missing_tmdb_token', message: 'TMDB read token is required.', severity: 'error' });
  }

  if (!params.movieModelApiKey) {
    issues.push({ code: 'missing_movie_model', message: 'Movie model is required.', severity: 'error' });
  }

  if (!params.personModelApiKey) {
    issues.push({ code: 'missing_person_model', message: 'Person model is required.', severity: 'error' });
  }

  if (!params.personNameFieldApiKey) {
    issues.push({ code: 'missing_person_name_field', message: 'Person name field is required.', severity: 'error' });
  }

  return issues;
}
```

- [ ] **Step 3: Verify parameter tests**

Run: `npm test -- src/plugin/parameters.test.ts`

Expected: PASS.

- [ ] **Step 4: Write field mapping validation tests**

Create `src/plugin/datoFieldMapping.test.ts`:

```ts
import { validateFieldMappings, type DatoSchemaSnapshot } from './datoFieldMapping';
import type { PluginParameters } from './parameters';

const baseParams: PluginParameters = {
  tmdbReadToken: 'token',
  movieModelApiKey: 'movie',
  targetLocale: 'en',
  movieFields: {
    title: 'title',
    poster: 'poster',
    backdrops: 'backdrops',
    directors: 'directors',
    actors: 'actors',
  },
  personModelApiKey: 'person',
  personNameFieldApiKey: 'name',
  personTmdbIdFieldApiKey: null,
  actorLimit: 10,
};

const schema: DatoSchemaSnapshot = {
  models: {
    movie: {
      apiKey: 'movie',
      fields: {
        title: { apiKey: 'title', fieldType: 'string', localized: true, validators: {} },
        poster: { apiKey: 'poster', fieldType: 'file', localized: false, validators: {} },
        backdrops: { apiKey: 'backdrops', fieldType: 'gallery', localized: false, validators: {} },
        directors: { apiKey: 'directors', fieldType: 'links', localized: false, validators: { itemItemType: { itemTypes: ['person'] } } },
        actors: { apiKey: 'actors', fieldType: 'links', localized: false, validators: { itemItemType: { itemTypes: ['person'] } } },
      },
    },
    person: {
      apiKey: 'person',
      fields: {
        name: { apiKey: 'name', fieldType: 'string', localized: false, validators: {} },
      },
    },
  },
};

describe('validateFieldMappings', () => {
  it('accepts configured movie and person relationships', () => {
    expect(validateFieldMappings(baseParams, schema)).toEqual([]);
  });

  it('rejects people fields that do not target the shared person model', () => {
    const badSchema: DatoSchemaSnapshot = {
      ...schema,
      models: {
        ...schema.models,
        movie: {
          ...schema.models.movie,
          fields: {
            ...schema.models.movie.fields,
            actors: { apiKey: 'actors', fieldType: 'links', localized: false, validators: { itemItemType: { itemTypes: ['director'] } } },
          },
        },
      },
    };

    expect(validateFieldMappings(baseParams, badSchema).map((issue) => issue.code)).toContain('actors_wrong_target_model');
  });
});
```

- [ ] **Step 5: Implement field mapping validation**

Create `src/plugin/datoFieldMapping.ts`:

```ts
import type { ValidationIssue } from '../domain/movie';
import type { PluginParameters } from './parameters';

export type DatoFieldSnapshot = {
  apiKey: string;
  fieldType: string;
  localized: boolean;
  validators: Record<string, unknown>;
};

export type DatoModelSnapshot = {
  apiKey: string;
  fields: Record<string, DatoFieldSnapshot>;
};

export type DatoSchemaSnapshot = {
  models: Record<string, DatoModelSnapshot>;
};

const FIELD_TYPES: Record<string, string[]> = {
  title: ['string'],
  yearReleased: ['integer', 'float'],
  mpaaRating: ['string'],
  runtime: ['integer', 'float'],
  tmdbId: ['integer', 'float', 'string'],
  tagline: ['string', 'text'],
  description: ['text', 'string'],
  poster: ['file'],
  backdrops: ['gallery'],
  directors: ['links'],
  actors: ['links'],
};

function linkedItemTypes(field: DatoFieldSnapshot): string[] {
  const itemItemType = field.validators.itemItemType as { itemTypes?: unknown } | undefined;
  return Array.isArray(itemItemType?.itemTypes) ? itemItemType.itemTypes.filter((value): value is string => typeof value === 'string') : [];
}

export function validateFieldMappings(params: PluginParameters, schema: DatoSchemaSnapshot): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const movieModel = schema.models[params.movieModelApiKey];

  if (!movieModel) {
    return [{ code: 'movie_model_not_found', message: 'Configured movie model was not found.', severity: 'error' }];
  }

  for (const [fieldKey, fieldApiKey] of Object.entries(params.movieFields)) {
    if (!fieldApiKey) {
      continue;
    }

    const field = movieModel.fields[fieldApiKey];
    if (!field) {
      issues.push({ code: `${fieldKey}_field_not_found`, message: `Movie field ${fieldApiKey} was not found.`, severity: 'error' });
      continue;
    }

    if (!FIELD_TYPES[fieldKey]?.includes(field.fieldType)) {
      issues.push({ code: `${fieldKey}_wrong_type`, message: `${fieldApiKey} has incompatible type ${field.fieldType}.`, severity: 'error' });
    }

    if ((fieldKey === 'directors' || fieldKey === 'actors') && !linkedItemTypes(field).includes(params.personModelApiKey)) {
      issues.push({ code: `${fieldKey}_wrong_target_model`, message: `${fieldApiKey} must link to the configured person model.`, severity: 'error' });
    }
  }

  const personModel = schema.models[params.personModelApiKey];
  const nameField = personModel?.fields[params.personNameFieldApiKey];

  if (!personModel) {
    issues.push({ code: 'person_model_not_found', message: 'Configured person model was not found.', severity: 'error' });
  } else if (!nameField || !['string', 'text'].includes(nameField.fieldType)) {
    issues.push({ code: 'person_name_field_invalid', message: 'Person name field must be a string or text field.', severity: 'error' });
  }

  return issues;
}
```

- [ ] **Step 6: Verify mapping tests**

Run: `npm test -- src/plugin/parameters.test.ts src/plugin/datoFieldMapping.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit domain and config foundation**

Run:

```bash
git add src/domain src/plugin src/App.tsx
git commit -m "feat: add plugin configuration validation"
```

Expected: commit succeeds.

---

### Task 3: Implement TMDB Client, Fixtures, and Metadata Normalization

**Files:**
- Create: `src/providers/tmdbTypes.ts`
- Create: `src/providers/tmdbClient.ts`
- Create: `src/providers/tmdbNormalizer.ts`
- Create: `src/providers/tmdbNormalizer.test.ts`
- Create: `src/test/fixtures/tmdb/complete-movie.json`
- Create: `src/test/fixtures/tmdb/missing-certification.json`

**Interfaces:**
- Consumes: `NormalizedMovie` and `PersonCandidate` from `src/domain/movie.ts`.
- Produces: `TmdbClient` with `searchMovies(query: TmdbSearchQuery): Promise<TmdbSearchResult[]>` and `getMoviePackage(tmdbId: number): Promise<TmdbMoviePackage>`.
- Produces: `normalizeTmdbMovie(input: TmdbMoviePackage, actorLimit: number): NormalizedMovie`.
- Produces: `selectUsCertification(releaseDates: TmdbReleaseDatesResponse): string | null`.

- [ ] **Step 1: Add representative TMDB fixtures**

Create `src/test/fixtures/tmdb/complete-movie.json` with one sanitized movie containing `id`, `title`, `release_date`, `runtime`, `tagline`, `overview`, `credits.cast`, `credits.crew`, `release_dates.results`, and `images.posters/backdrops`. Use stable IDs and names from a well-known public TMDB response, but remove any fields the plugin does not consume.

Create `src/test/fixtures/tmdb/missing-certification.json` by copying the same shape and setting every US `certification` to an empty string.

- [ ] **Step 2: Write TMDB normalization tests**

Create `src/providers/tmdbNormalizer.test.ts`:

```ts
import completeMovie from '../test/fixtures/tmdb/complete-movie.json';
import missingCertification from '../test/fixtures/tmdb/missing-certification.json';
import { normalizeTmdbMovie, selectUsCertification } from './tmdbNormalizer';

describe('normalizeTmdbMovie', () => {
  it('normalizes scalar movie fields and derives release year', () => {
    const movie = normalizeTmdbMovie(completeMovie, 10);

    expect(movie.tmdbId).toBe(completeMovie.id);
    expect(movie.title).toBe(completeMovie.title);
    expect(movie.yearReleased).toBe(Number(completeMovie.release_date.slice(0, 4)));
    expect(movie.runtime).toBe(completeMovie.runtime);
    expect(movie.tagline).toBe(completeMovie.tagline);
    expect(movie.description).toBe(completeMovie.overview);
  });

  it('selects the preferred US certification and returns null when missing', () => {
    expect(selectUsCertification(completeMovie.release_dates)).toBe('PG-13');
    expect(selectUsCertification(missingCertification.release_dates)).toBeNull();
  });

  it('keeps director order and truncates actors to the configured limit', () => {
    const movie = normalizeTmdbMovie(completeMovie, 2);

    expect(movie.directors.every((person) => person.role === 'director')).toBe(true);
    expect(movie.actors).toHaveLength(2);
    expect(movie.actors.map((actor) => actor.order)).toEqual([0, 1]);
  });
});
```

- [ ] **Step 3: Implement TMDB response types**

Create `src/providers/tmdbTypes.ts`:

```ts
export type TmdbSearchQuery = {
  title: string;
  year?: number | null;
};

export type TmdbSearchResult = {
  id: number;
  title: string;
  releaseDate: string | null;
  overview: string | null;
  posterPath: string | null;
};

export type TmdbReleaseDate = {
  certification: string;
  type: number;
};

export type TmdbReleaseDatesResponse = {
  results: Array<{
    iso_3166_1: string;
    release_dates: TmdbReleaseDate[];
  }>;
};

export type TmdbCreditPerson = {
  id: number;
  name: string;
  order?: number;
  job?: string;
};

export type TmdbImage = {
  file_path: string;
  width?: number;
  height?: number;
  iso_639_1?: string | null;
  vote_average?: number;
  vote_count?: number;
};

export type TmdbMoviePackage = {
  id: number;
  title: string;
  release_date?: string | null;
  runtime?: number | null;
  tagline?: string | null;
  overview?: string | null;
  credits: {
    cast: TmdbCreditPerson[];
    crew: TmdbCreditPerson[];
  };
  release_dates: TmdbReleaseDatesResponse;
  images: {
    posters: TmdbImage[];
    backdrops: TmdbImage[];
  };
};
```

- [ ] **Step 4: Implement normalization**

Create `src/providers/tmdbNormalizer.ts`:

```ts
import type { NormalizedImageCandidate, NormalizedMovie, PersonCandidate } from '../domain/movie';
import type { TmdbImage, TmdbMoviePackage, TmdbReleaseDatesResponse } from './tmdbTypes';

const TMDB_IMAGE_ORIGINAL_BASE = 'https://image.tmdb.org/t/p/original';
const THEATRICAL_RELEASE_TYPES = new Set([2, 3]);

export function selectUsCertification(releaseDates: TmdbReleaseDatesResponse): string | null {
  const us = releaseDates.results.find((entry) => entry.iso_3166_1 === 'US');
  const values = us?.release_dates ?? [];
  const theatrical = values.find((release) => THEATRICAL_RELEASE_TYPES.has(release.type) && release.certification.trim().length > 0);
  const fallback = values.find((release) => release.certification.trim().length > 0);

  return theatrical?.certification.trim() || fallback?.certification.trim() || null;
}

function releaseYear(releaseDate: string | null | undefined): number | null {
  if (!releaseDate || !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) {
    return null;
  }

  return Number(releaseDate.slice(0, 4));
}

function normalizePeople(input: TmdbMoviePackage, actorLimit: number): { directors: PersonCandidate[]; actors: PersonCandidate[] } {
  const directors = input.credits.crew
    .filter((person) => person.job === 'Director')
    .map((person, index) => ({ tmdbId: person.id, name: person.name, order: index, role: 'director' as const }));

  const actors = input.credits.cast
    .slice(0, actorLimit)
    .map((person, index) => ({ tmdbId: person.id, name: person.name, order: person.order ?? index, role: 'actor' as const }));

  return { directors, actors };
}

function normalizeImage(tmdbId: number, type: 'poster' | 'backdrop', image: TmdbImage, index: number): NormalizedImageCandidate {
  const voteAverage = image.vote_average ?? 0;
  const voteCount = image.vote_count ?? 0;

  return {
    providerKey: 'tmdb',
    providerImageId: image.file_path,
    movieIdentity: { providerKey: 'tmdb', tmdbId },
    type,
    originalUrl: `${TMDB_IMAGE_ORIGINAL_BASE}${image.file_path}`,
    width: image.width ?? null,
    height: image.height ?? null,
    language: image.iso_639_1 ?? null,
    rank: index - voteAverage * 1000 - voteCount,
    attribution: 'TMDB',
  };
}

function normalizeImages(input: TmdbMoviePackage): NormalizedImageCandidate[] {
  const posters = input.images.posters.map((image, index) => normalizeImage(input.id, 'poster', image, index));
  const backdrops = input.images.backdrops.map((image, index) => normalizeImage(input.id, 'backdrop', image, index));

  return [...posters, ...backdrops].sort((a, b) => a.rank - b.rank);
}

export function normalizeTmdbMovie(input: TmdbMoviePackage, actorLimit: number): NormalizedMovie {
  const people = normalizePeople(input, actorLimit);

  return {
    tmdbId: input.id,
    title: input.title,
    primaryReleaseDate: input.release_date ?? null,
    yearReleased: releaseYear(input.release_date),
    mpaaRating: selectUsCertification(input.release_dates),
    runtime: input.runtime ?? null,
    tagline: input.tagline || null,
    description: input.overview || null,
    directors: people.directors,
    actors: people.actors,
    images: normalizeImages(input),
  };
}
```

- [ ] **Step 5: Implement token-safe TMDB client**

Create `src/providers/tmdbClient.ts`:

```ts
import type { TmdbMoviePackage, TmdbSearchQuery, TmdbSearchResult } from './tmdbTypes';

export class TmdbError extends Error {
  constructor(
    message: string,
    readonly code: 'auth' | 'rate_limit' | 'network' | 'not_found' | 'unknown',
  ) {
    super(message);
  }
}

type TmdbClientOptions = {
  readToken: string;
  fetchImpl?: typeof fetch;
};

export class TmdbClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: TmdbClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async searchMovies(query: TmdbSearchQuery): Promise<TmdbSearchResult[]> {
    const params = new URLSearchParams({
      query: query.title,
      include_adult: 'false',
      language: 'en-US',
    });

    if (query.year) {
      params.set('year', String(query.year));
    }

    const json = await this.getJson<{ results: Array<{ id: number; title: string; release_date?: string; overview?: string; poster_path?: string | null }> }>(
      `/search/movie?${params}`,
    );

    return json.results.map((movie) => ({
      id: movie.id,
      title: movie.title,
      releaseDate: movie.release_date ?? null,
      overview: movie.overview ?? null,
      posterPath: movie.poster_path ?? null,
    }));
  }

  async getMoviePackage(tmdbId: number): Promise<TmdbMoviePackage> {
    return this.getJson<TmdbMoviePackage>(`/movie/${tmdbId}?language=en-US&append_to_response=credits,release_dates,images&include_image_language=en,null`);
  }

  private async getJson<T>(path: string): Promise<T> {
    let response: Response;

    try {
      response = await this.fetchImpl(`https://api.themoviedb.org/3${path}`, {
        headers: {
          Authorization: `Bearer ${this.options.readToken}`,
          Accept: 'application/json',
        },
      });
    } catch {
      throw new TmdbError('TMDB network request failed.', 'network');
    }

    if (response.status === 401 || response.status === 403) {
      throw new TmdbError('TMDB read token is invalid or not allowed.', 'auth');
    }

    if (response.status === 404) {
      throw new TmdbError('TMDB movie was not found.', 'not_found');
    }

    if (response.status === 429) {
      throw new TmdbError('TMDB rate limit reached. Try again shortly.', 'rate_limit');
    }

    if (!response.ok) {
      throw new TmdbError('TMDB request failed.', 'unknown');
    }

    return response.json() as Promise<T>;
  }
}
```

- [ ] **Step 6: Verify TMDB tests**

Run: `npm test -- src/providers/tmdbNormalizer.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: command exits 0.

- [ ] **Step 7: Commit TMDB provider**

Run:

```bash
git add src/providers src/test/fixtures/tmdb
git commit -m "feat: normalize TMDB movie data"
```

Expected: commit succeeds.

---

### Task 4: Implement Field Comparison, Image Selection, and Import Planning

**Files:**
- Create: `src/domain/fieldComparison.ts`
- Create: `src/domain/fieldComparison.test.ts`
- Create: `src/providers/imageProvider.ts`
- Create: `src/providers/imageProvider.test.ts`
- Create: `src/domain/importPlanning.ts`
- Create: `src/domain/importPlanning.test.ts`

**Interfaces:**
- Consumes: `NormalizedMovie`, `NormalizedImageCandidate`, `MovieFieldKey`.
- Produces: `compareMovieFields(current: CurrentMovieValues, movie: NormalizedMovie, mappedFields: MovieFieldKey[]): FieldComparison[]`.
- Produces: `defaultImageSelection(current: CurrentMovieValues, images: NormalizedImageCandidate[]): ImageSelection`.
- Produces: `buildImportPlan(input: BuildImportPlanInput): ImportPlan`.

- [ ] **Step 1: Write comparison and selection tests**

Create `src/domain/fieldComparison.test.ts`:

```ts
import { compareMovieFields } from './fieldComparison';
import type { NormalizedMovie } from './movie';

const movie: NormalizedMovie = {
  tmdbId: 123,
  title: 'Example Movie',
  primaryReleaseDate: '2024-03-01',
  yearReleased: 2024,
  mpaaRating: null,
  runtime: 125,
  tagline: 'A useful tagline',
  description: 'Overview text',
  directors: [],
  actors: [],
  images: [],
};

describe('compareMovieFields', () => {
  it('selects empty destination fields by default', () => {
    const [title] = compareMovieFields({ title: '' }, movie, ['title']);

    expect(title.selected).toBe(true);
    expect(title.proposedValue).toBe('Example Movie');
  });

  it('does not select populated fields by default', () => {
    const [title] = compareMovieFields({ title: 'Editorial Title' }, movie, ['title']);

    expect(title.selected).toBe(false);
  });

  it('marks missing TMDB values as unavailable and never selected', () => {
    const [rating] = compareMovieFields({ mpaaRating: 'R' }, movie, ['mpaaRating']);

    expect(rating.available).toBe(false);
    expect(rating.selected).toBe(false);
  });
});
```

Create `src/providers/imageProvider.test.ts`:

```ts
import { defaultImageSelection } from './imageProvider';
import type { NormalizedImageCandidate } from '../domain/movie';

const images: NormalizedImageCandidate[] = [
  { providerKey: 'tmdb', providerImageId: '/poster.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'poster', originalUrl: 'https://image.tmdb.org/t/p/original/poster.jpg', width: 100, height: 150, language: 'en', rank: 1, attribution: 'TMDB' },
  { providerKey: 'tmdb', providerImageId: '/backdrop-1.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'backdrop', originalUrl: 'https://image.tmdb.org/t/p/original/backdrop-1.jpg', width: 300, height: 150, language: null, rank: 1, attribution: 'TMDB' },
  { providerKey: 'tmdb', providerImageId: '/backdrop-2.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'backdrop', originalUrl: 'https://image.tmdb.org/t/p/original/backdrop-2.jpg', width: 300, height: 150, language: null, rank: 2, attribution: 'TMDB' },
];

describe('defaultImageSelection', () => {
  it('preselects poster and top backdrops when destinations are empty', () => {
    const selection = defaultImageSelection({ poster: null, backdrops: [] }, images);

    expect(selection.poster?.providerImageId).toBe('/poster.jpg');
    expect(selection.backdrops.map((image) => image.providerImageId)).toEqual(['/backdrop-1.jpg', '/backdrop-2.jpg']);
  });

  it('does not preselect replacements when destinations are populated', () => {
    const selection = defaultImageSelection({ poster: 'asset-1', backdrops: ['asset-2'] }, images);

    expect(selection.poster).toBeNull();
    expect(selection.backdrops).toEqual([]);
  });
});
```

- [ ] **Step 2: Implement field comparison and image selection**

Create `src/domain/fieldComparison.ts`:

```ts
import type { MovieFieldKey, NormalizedMovie } from './movie';

export type CurrentMovieValues = Partial<Record<MovieFieldKey, unknown>>;

export type FieldComparison = {
  key: MovieFieldKey;
  currentValue: unknown;
  proposedValue: unknown;
  selected: boolean;
  available: boolean;
  changed: boolean;
};

const SCALAR_KEYS: MovieFieldKey[] = ['title', 'yearReleased', 'mpaaRating', 'runtime', 'tmdbId', 'tagline', 'description'];

function proposedValue(movie: NormalizedMovie, key: MovieFieldKey): unknown {
  if (key === 'tmdbId') {
    return movie.tmdbId;
  }

  return movie[key as keyof NormalizedMovie];
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

export function compareMovieFields(current: CurrentMovieValues, movie: NormalizedMovie, mappedFields: MovieFieldKey[]): FieldComparison[] {
  return mappedFields
    .filter((key) => SCALAR_KEYS.includes(key))
    .map((key) => {
      const currentValue = current[key];
      const nextValue = proposedValue(movie, key);
      const available = !isEmpty(nextValue);
      const changed = JSON.stringify(currentValue ?? null) !== JSON.stringify(nextValue ?? null);

      return {
        key,
        currentValue,
        proposedValue: nextValue,
        selected: available && changed && isEmpty(currentValue),
        available,
        changed,
      };
    });
}
```

Create `src/providers/imageProvider.ts`:

```ts
import type { CurrentMovieValues } from '../domain/fieldComparison';
import type { NormalizedImageCandidate } from '../domain/movie';

export type ImageSelection = {
  poster: NormalizedImageCandidate | null;
  backdrops: NormalizedImageCandidate[];
};

export type ImageProvider = {
  key: string;
  findImages(tmdbId: number): Promise<NormalizedImageCandidate[]>;
};

function ranked(images: NormalizedImageCandidate[], type: 'poster' | 'backdrop'): NormalizedImageCandidate[] {
  return images.filter((image) => image.type === type).sort((a, b) => a.rank - b.rank);
}

export function defaultImageSelection(current: CurrentMovieValues, images: NormalizedImageCandidate[]): ImageSelection {
  const posterEmpty = current.poster === null || current.poster === undefined || current.poster === '';
  const backdropsEmpty = !Array.isArray(current.backdrops) || current.backdrops.length === 0;

  return {
    poster: posterEmpty ? ranked(images, 'poster')[0] ?? null : null,
    backdrops: backdropsEmpty ? ranked(images, 'backdrop').slice(0, 5) : [],
  };
}
```

- [ ] **Step 3: Verify comparison and image tests**

Run: `npm test -- src/domain/fieldComparison.test.ts src/providers/imageProvider.test.ts`

Expected: PASS.

- [ ] **Step 4: Write import planning tests**

Create `src/domain/importPlanning.test.ts`:

```ts
import { buildImportPlan } from './importPlanning';
import type { FieldComparison } from './fieldComparison';

const fields: FieldComparison[] = [
  { key: 'title', currentValue: '', proposedValue: 'Example Movie', selected: true, available: true, changed: true },
  { key: 'runtime', currentValue: 120, proposedValue: 125, selected: false, available: true, changed: true },
  { key: 'mpaaRating', currentValue: 'R', proposedValue: null, selected: false, available: false, changed: true },
];

describe('buildImportPlan', () => {
  it('includes only selected available field changes', () => {
    const plan = buildImportPlan({
      fieldComparisons: fields,
      directors: [],
      actors: [],
      imageSelection: { poster: null, backdrops: [] },
      personResolutions: [],
    });

    expect(plan.fieldChanges).toEqual([{ key: 'title', value: 'Example Movie' }]);
  });

  it('records person creates and asset uploads before final form values', () => {
    const plan = buildImportPlan({
      fieldComparisons: [],
      directors: [{ tmdbId: 10, name: 'Director Name', order: 0, role: 'director' }],
      actors: [],
      imageSelection: {
        poster: { providerKey: 'tmdb', providerImageId: '/poster.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'poster', originalUrl: 'https://image.tmdb.org/t/p/original/poster.jpg', width: 100, height: 150, language: 'en', rank: 1, attribution: 'TMDB' },
        backdrops: [],
      },
      personResolutions: [{ candidateTmdbId: 10, action: 'create', name: 'Director Name' }],
    });

    expect(plan.peopleToCreate).toEqual([{ candidateTmdbId: 10, name: 'Director Name' }]);
    expect(plan.assetsToUpload).toHaveLength(1);
  });
});
```

- [ ] **Step 5: Implement immutable import plan construction**

Create `src/domain/importPlanning.ts`:

```ts
import type { FieldComparison } from './fieldComparison';
import type { NormalizedImageCandidate, PersonCandidate, MovieFieldKey } from './movie';
import type { ImageSelection } from '../providers/imageProvider';

export type PersonResolution =
  | { candidateTmdbId: number; action: 'reuse'; recordId: string; name: string }
  | { candidateTmdbId: number; action: 'create'; name: string };

export type ImportPlan = {
  fieldChanges: Array<{ key: MovieFieldKey; value: unknown }>;
  directors: PersonCandidate[];
  actors: PersonCandidate[];
  peopleToCreate: Array<{ candidateTmdbId: number; name: string }>;
  peopleToReuse: Array<{ candidateTmdbId: number; recordId: string; name: string }>;
  assetsToUpload: NormalizedImageCandidate[];
};

export type BuildImportPlanInput = {
  fieldComparisons: FieldComparison[];
  directors: PersonCandidate[];
  actors: PersonCandidate[];
  imageSelection: ImageSelection;
  personResolutions: PersonResolution[];
};

export function buildImportPlan(input: BuildImportPlanInput): ImportPlan {
  const fieldChanges = input.fieldComparisons
    .filter((comparison) => comparison.selected && comparison.available && comparison.changed)
    .map((comparison) => ({ key: comparison.key, value: comparison.proposedValue }));

  return {
    fieldChanges,
    directors: [...input.directors],
    actors: [...input.actors],
    peopleToCreate: input.personResolutions
      .filter((resolution): resolution is Extract<PersonResolution, { action: 'create' }> => resolution.action === 'create')
      .map((resolution) => ({ candidateTmdbId: resolution.candidateTmdbId, name: resolution.name })),
    peopleToReuse: input.personResolutions
      .filter((resolution): resolution is Extract<PersonResolution, { action: 'reuse' }> => resolution.action === 'reuse')
      .map((resolution) => ({ candidateTmdbId: resolution.candidateTmdbId, recordId: resolution.recordId, name: resolution.name })),
    assetsToUpload: [input.imageSelection.poster, ...input.imageSelection.backdrops].filter((image): image is NormalizedImageCandidate => image !== null),
  };
}
```

- [ ] **Step 6: Verify planning tests**

Run: `npm test -- src/domain/fieldComparison.test.ts src/providers/imageProvider.test.ts src/domain/importPlanning.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit comparison and planning**

Run:

```bash
git add src/domain src/providers/imageProvider.ts src/providers/imageProvider.test.ts
git commit -m "feat: plan selected TMDB imports"
```

Expected: commit succeeds.

---

### Task 5: Implement Person Matching and DatoCMS Gateway

**Files:**
- Create: `src/domain/personMatching.ts`
- Create: `src/domain/personMatching.test.ts`
- Create: `src/dato/datoGateway.ts`
- Create: `src/dato/datoGateway.test.ts`

**Interfaces:**
- Consumes: `PersonCandidate`, `PluginParameters`, `NormalizedImageCandidate`.
- Produces: `normalizePersonName(name: string): string`.
- Produces: `matchPerson(candidate: PersonCandidate, records: ExistingPersonRecord[], tmdbIdFieldConfigured: boolean): PersonMatchDecision`.
- Produces: `DatoGateway` interface with `findPeople`, `createPersonDraft`, `uploadImage`, and `applyFormValues`.

- [ ] **Step 1: Write person matching tests**

Create `src/domain/personMatching.test.ts`:

```ts
import { matchPerson, normalizePersonName } from './personMatching';

describe('person matching', () => {
  it('normalizes case, whitespace, and unicode shape', () => {
    expect(normalizePersonName('  JOSE\u0301   Alvarez ')).toBe(normalizePersonName('josé alvarez'));
  });

  it('matches by TMDB id when configured', () => {
    const decision = matchPerson(
      { tmdbId: 44, name: 'Actor Name', order: 0, role: 'actor' },
      [{ id: 'person-1', name: 'Different Name', tmdbId: 44 }],
      true,
    );

    expect(decision).toEqual({ type: 'reuse', recordId: 'person-1', warning: null });
  });

  it('requires editor choice for ambiguous name matches', () => {
    const decision = matchPerson(
      { tmdbId: 44, name: 'Actor Name', order: 0, role: 'actor' },
      [
        { id: 'person-1', name: 'Actor Name', tmdbId: null },
        { id: 'person-2', name: ' actor   name ', tmdbId: null },
      ],
      false,
    );

    expect(decision.type).toBe('ambiguous');
  });

  it('proposes draft creation when no match exists', () => {
    const decision = matchPerson({ tmdbId: 44, name: 'Actor Name', order: 0, role: 'actor' }, [], false);

    expect(decision).toEqual({ type: 'create', name: 'Actor Name', warning: null });
  });
});
```

- [ ] **Step 2: Implement matching logic**

Create `src/domain/personMatching.ts`:

```ts
import type { PersonCandidate } from './movie';

export type ExistingPersonRecord = {
  id: string;
  name: string;
  tmdbId: number | null;
};

export type PersonMatchDecision =
  | { type: 'reuse'; recordId: string; warning: string | null }
  | { type: 'create'; name: string; warning: string | null }
  | { type: 'ambiguous'; options: ExistingPersonRecord[]; warning: string };

export function normalizePersonName(name: string): string {
  return name.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

export function matchPerson(candidate: PersonCandidate, records: ExistingPersonRecord[], tmdbIdFieldConfigured: boolean): PersonMatchDecision {
  if (tmdbIdFieldConfigured) {
    const tmdbMatch = records.find((record) => record.tmdbId === candidate.tmdbId);
    if (tmdbMatch) {
      return { type: 'reuse', recordId: tmdbMatch.id, warning: null };
    }
  }

  const normalized = normalizePersonName(candidate.name);
  const nameMatches = records.filter((record) => normalizePersonName(record.name) === normalized);

  if (nameMatches.length === 1) {
    return {
      type: 'reuse',
      recordId: nameMatches[0].id,
      warning: 'Matched by exact normalized name because no TMDB person ID match was available.',
    };
  }

  if (nameMatches.length > 1) {
    return {
      type: 'ambiguous',
      options: nameMatches,
      warning: 'Multiple people share this normalized name. Choose one record or create a new draft.',
    };
  }

  return { type: 'create', name: candidate.name, warning: null };
}
```

- [ ] **Step 3: Verify person matching tests**

Run: `npm test -- src/domain/personMatching.test.ts`

Expected: PASS.

- [ ] **Step 4: Write Dato gateway tests with mocked clients**

Create `src/dato/datoGateway.test.ts`:

```ts
import { createDatoGateway } from './datoGateway';

describe('DatoGateway', () => {
  it('creates draft people with name and optional TMDB id', async () => {
    const created: unknown[] = [];
    const gateway = createDatoGateway({
      client: {
        items: {
          create: async (payload: unknown) => {
            created.push(payload);
            return { id: 'person-1' };
          },
        },
      },
      ctx: { environment: 'main' },
    });

    const record = await gateway.createPersonDraft({
      modelApiKey: 'person',
      nameFieldApiKey: 'name',
      tmdbIdFieldApiKey: 'tmdb_id',
      name: 'Director Name',
      tmdbId: 77,
    });

    expect(record.id).toBe('person-1');
    expect(created[0]).toMatchObject({
      item_type: { type: 'item_type', id: 'person' },
      name: 'Director Name',
      tmdb_id: 77,
    });
  });

  it('applies form values through the provided setter', async () => {
    const calls: Array<[string, unknown]> = [];
    const gateway = createDatoGateway({
      client: {},
      ctx: {
        setFieldValue: async (fieldPath: string, value: unknown) => {
          calls.push([fieldPath, value]);
        },
      },
    });

    await gateway.applyFormValues([{ fieldPath: 'title.en', value: 'Example Movie' }]);

    expect(calls).toEqual([['title.en', 'Example Movie']]);
  });
});
```

- [ ] **Step 5: Implement Dato gateway**

Create `src/dato/datoGateway.ts`:

```ts
import type { NormalizedImageCandidate } from '../domain/movie';

export type GatewayClient = {
  items?: {
    create?: (payload: Record<string, unknown>) => Promise<{ id: string }>;
  };
  uploads?: {
    createFromUrl?: (payload: { url: string; default_field_metadata?: Record<string, unknown> }) => Promise<{ id: string }>;
  };
};

export type GatewayContext = {
  environment?: string;
  setFieldValue?: (fieldPath: string, value: unknown) => Promise<void>;
};

export type DatoGateway = {
  createPersonDraft(input: CreatePersonDraftInput): Promise<{ id: string }>;
  uploadImage(image: NormalizedImageCandidate): Promise<{ id: string }>;
  applyFormValues(changes: Array<{ fieldPath: string; value: unknown }>): Promise<void>;
};

export type CreatePersonDraftInput = {
  modelApiKey: string;
  nameFieldApiKey: string;
  tmdbIdFieldApiKey: string | null;
  name: string;
  tmdbId: number;
};

type CreateDatoGatewayInput = {
  client: GatewayClient;
  ctx: GatewayContext;
};

export function createDatoGateway(input: CreateDatoGatewayInput): DatoGateway {
  return {
    async createPersonDraft(person) {
      if (!input.client.items?.create) {
        throw new Error('DatoCMS item create permission is unavailable.');
      }

      const payload: Record<string, unknown> = {
        item_type: { type: 'item_type', id: person.modelApiKey },
        [person.nameFieldApiKey]: person.name,
      };

      if (person.tmdbIdFieldApiKey) {
        payload[person.tmdbIdFieldApiKey] = person.tmdbId;
      }

      return input.client.items.create(payload);
    },

    async uploadImage(image) {
      if (!input.client.uploads?.createFromUrl) {
        throw new Error('DatoCMS upload permission is unavailable.');
      }

      return input.client.uploads.createFromUrl({
        url: image.originalUrl,
        default_field_metadata: {
          en: {
            alt: `${image.type} from ${image.providerKey}`,
            title: image.providerImageId,
          },
        },
      });
    },

    async applyFormValues(changes) {
      if (!input.ctx.setFieldValue) {
        throw new Error('DatoCMS form update API is unavailable.');
      }

      for (const change of changes) {
        await input.ctx.setFieldValue(change.fieldPath, change.value);
      }
    },
  };
}
```

- [ ] **Step 6: Verify gateway tests**

Run: `npm test -- src/domain/personMatching.test.ts src/dato/datoGateway.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit matching and gateway**

Run:

```bash
git add src/domain/personMatching.ts src/domain/personMatching.test.ts src/dato
git commit -m "feat: resolve people and DatoCMS writes"
```

Expected: commit succeeds.

---

### Task 6: Implement Import Executor and Form Value Mapping

**Files:**
- Create: `src/dato/importExecutor.ts`
- Create: `src/dato/importExecutor.test.ts`
- Modify: `src/plugin/datoFieldMapping.ts`
- Modify: `src/plugin/datoFieldMapping.test.ts`

**Interfaces:**
- Consumes: `ImportPlan`, `DatoGateway`, `PluginParameters`.
- Produces: `executeImportPlan(plan: ImportPlan, params: PluginParameters, gateway: DatoGateway): Promise<ImportResult>`.
- Produces: `fieldPathForMovieField(fieldApiKey: string, localized: boolean, locale: 'en'): string`.
- Produces: `assetReference(id: string)` and `itemReference(id: string)` helpers for Dato form values.

- [ ] **Step 1: Write form value helper tests**

Append to `src/plugin/datoFieldMapping.test.ts`:

```ts
import { assetReference, fieldPathForMovieField, itemReference } from './datoFieldMapping';

describe('form value helpers', () => {
  it('targets English for localized fields', () => {
    expect(fieldPathForMovieField('title', true, 'en')).toBe('title.en');
  });

  it('targets raw field path for non-localized fields', () => {
    expect(fieldPathForMovieField('runtime', false, 'en')).toBe('runtime');
  });

  it('builds Dato reference objects', () => {
    expect(itemReference('person-1')).toEqual({ type: 'item', id: 'person-1' });
    expect(assetReference('upload-1')).toEqual({ type: 'upload', id: 'upload-1' });
  });
});
```

- [ ] **Step 2: Implement form value helpers**

Append to `src/plugin/datoFieldMapping.ts`:

```ts
export function fieldPathForMovieField(fieldApiKey: string, localized: boolean, locale: 'en'): string {
  return localized ? `${fieldApiKey}.${locale}` : fieldApiKey;
}

export function itemReference(id: string): { type: 'item'; id: string } {
  return { type: 'item', id };
}

export function assetReference(id: string): { type: 'upload'; id: string } {
  return { type: 'upload', id };
}
```

- [ ] **Step 3: Write import executor tests**

Create `src/dato/importExecutor.test.ts`:

```ts
import { executeImportPlan } from './importExecutor';
import type { ImportPlan } from '../domain/importPlanning';
import type { PluginParameters } from '../plugin/parameters';

const params: PluginParameters = {
  tmdbReadToken: 'token',
  movieModelApiKey: 'movie',
  targetLocale: 'en',
  movieFields: {
    title: 'title',
    poster: 'poster',
    directors: 'directors',
  },
  personModelApiKey: 'person',
  personNameFieldApiKey: 'name',
  personTmdbIdFieldApiKey: null,
  actorLimit: 10,
};

const plan: ImportPlan = {
  fieldChanges: [{ key: 'title', value: 'Example Movie' }],
  directors: [{ tmdbId: 10, name: 'Director Name', order: 0, role: 'director' }],
  actors: [],
  peopleToCreate: [{ candidateTmdbId: 10, name: 'Director Name' }],
  peopleToReuse: [],
  assetsToUpload: [{ providerKey: 'tmdb', providerImageId: '/poster.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'poster', originalUrl: 'https://image.tmdb.org/t/p/original/poster.jpg', width: 100, height: 150, language: 'en', rank: 1, attribution: 'TMDB' }],
};

describe('executeImportPlan', () => {
  it('creates people and uploads assets before applying form values', async () => {
    const order: string[] = [];
    const result = await executeImportPlan(plan, params, {
      async createPersonDraft() {
        order.push('person');
        return { id: 'person-1' };
      },
      async uploadImage() {
        order.push('upload');
        return { id: 'upload-1' };
      },
      async applyFormValues() {
        order.push('form');
      },
    });

    expect(result.status).toBe('success');
    expect(order).toEqual(['person', 'upload', 'form']);
  });

  it('stops before form updates when a dependency write fails', async () => {
    const order: string[] = [];
    const result = await executeImportPlan(plan, params, {
      async createPersonDraft() {
        order.push('person');
        throw new Error('permission denied');
      },
      async uploadImage() {
        order.push('upload');
        return { id: 'upload-1' };
      },
      async applyFormValues() {
        order.push('form');
      },
    });

    expect(result.status).toBe('dependency_failed');
    expect(order).toEqual(['person']);
  });
});
```

- [ ] **Step 4: Implement executor**

Create `src/dato/importExecutor.ts`:

```ts
import type { DatoGateway } from './datoGateway';
import type { ImportPlan } from '../domain/importPlanning';
import type { PluginParameters } from '../plugin/parameters';
import { assetReference, itemReference } from '../plugin/datoFieldMapping';

export type ImportResult =
  | { status: 'success'; createdPeople: string[]; uploadedAssets: string[]; appliedFields: string[] }
  | { status: 'dependency_failed'; message: string; createdPeople: string[]; uploadedAssets: string[] }
  | { status: 'form_failed'; message: string; createdPeople: string[]; uploadedAssets: string[]; appliedFields: string[] };

export async function executeImportPlan(plan: ImportPlan, params: PluginParameters, gateway: DatoGateway): Promise<ImportResult> {
  const createdPeople: string[] = [];
  const uploadedAssets: string[] = [];
  const personIdsByTmdb = new Map<number, string>();

  try {
    for (const person of plan.peopleToReuse) {
      personIdsByTmdb.set(person.candidateTmdbId, person.recordId);
    }

    for (const person of plan.peopleToCreate) {
      const record = await gateway.createPersonDraft({
        modelApiKey: params.personModelApiKey,
        nameFieldApiKey: params.personNameFieldApiKey,
        tmdbIdFieldApiKey: params.personTmdbIdFieldApiKey,
        name: person.name,
        tmdbId: person.candidateTmdbId,
      });
      createdPeople.push(record.id);
      personIdsByTmdb.set(person.candidateTmdbId, record.id);
    }

    for (const image of plan.assetsToUpload) {
      const upload = await gateway.uploadImage(image);
      uploadedAssets.push(upload.id);
    }
  } catch (error) {
    return {
      status: 'dependency_failed',
      message: error instanceof Error ? error.message : 'Dependency write failed.',
      createdPeople,
      uploadedAssets,
    };
  }

  const changes = plan.fieldChanges
    .map((change) => {
      const fieldApiKey = params.movieFields[change.key];
      return fieldApiKey ? { fieldPath: fieldApiKey, value: change.value } : null;
    })
    .filter((change): change is { fieldPath: string; value: unknown } => change !== null);

  const directorField = params.movieFields.directors;
  if (directorField) {
    changes.push({
      fieldPath: directorField,
      value: plan.directors.map((person) => personIdsByTmdb.get(person.tmdbId)).filter((id): id is string => Boolean(id)).map(itemReference),
    });
  }

  const posterField = params.movieFields.poster;
  if (posterField && uploadedAssets[0]) {
    changes.push({ fieldPath: posterField, value: assetReference(uploadedAssets[0]) });
  }

  try {
    await gateway.applyFormValues(changes);
  } catch (error) {
    return {
      status: 'form_failed',
      message: error instanceof Error ? error.message : 'Form update failed.',
      createdPeople,
      uploadedAssets,
      appliedFields: [],
    };
  }

  return {
    status: 'success',
    createdPeople,
    uploadedAssets,
    appliedFields: changes.map((change) => change.fieldPath),
  };
}
```

- [ ] **Step 5: Verify executor tests**

Run: `npm test -- src/plugin/datoFieldMapping.test.ts src/dato/importExecutor.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: command exits 0.

- [ ] **Step 6: Commit executor**

Run:

```bash
git add src/dato/importExecutor.ts src/dato/importExecutor.test.ts src/plugin/datoFieldMapping.ts src/plugin/datoFieldMapping.test.ts
git commit -m "feat: execute approved import plans"
```

Expected: commit succeeds.

---

### Task 7: Build Configuration Screen and Field Add-on Launcher

**Files:**
- Create: `src/ui/ConfigScreen.tsx`
- Create: `src/ui/ConfigScreen.test.tsx`
- Create: `src/ui/FieldAddon.tsx`
- Create: `src/ui/FieldAddon.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `parsePluginParameters`, `validatePluginParameters`.
- Produces: `ConfigScreen(props: { parameters: PluginParameters; onSave: (params: PluginParameters) => Promise<void> })`.
- Produces: `FieldAddon(props: { tmdbId: number | string | null; onOpen: (mode: 'find' | 'refresh') => void })`.
- Updates: `App` routes real screens instead of placeholders.

- [ ] **Step 1: Write UI tests for configuration and launcher**

Create `src/ui/FieldAddon.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FieldAddon } from './FieldAddon';

describe('FieldAddon', () => {
  it('opens find mode when no TMDB id exists', async () => {
    const onOpen = vi.fn();
    render(<FieldAddon tmdbId={null} onOpen={onOpen} />);

    await userEvent.click(screen.getByRole('button', { name: 'Find movie' }));

    expect(onOpen).toHaveBeenCalledWith('find');
  });

  it('opens refresh mode when a TMDB id exists', async () => {
    const onOpen = vi.fn();
    render(<FieldAddon tmdbId={123} onOpen={onOpen} />);

    await userEvent.click(screen.getByRole('button', { name: 'Refresh from TMDB' }));

    expect(onOpen).toHaveBeenCalledWith('refresh');
  });
});
```

Create `src/ui/ConfigScreen.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { ConfigScreen } from './ConfigScreen';
import { parsePluginParameters } from '../plugin/parameters';

describe('ConfigScreen', () => {
  it('shows token visibility warning for frontend-only v1', () => {
    render(<ConfigScreen parameters={parsePluginParameters({})} onSave={vi.fn()} />);

    expect(screen.getByText(/authenticated editors can inspect the TMDB read token/i)).toBeInTheDocument();
  });

  it('shows validation errors for missing required values', () => {
    render(<ConfigScreen parameters={parsePluginParameters({})} onSave={vi.fn()} />);

    expect(screen.getByText('TMDB read token is required.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement UI components**

Create `src/ui/FieldAddon.tsx`:

```tsx
type FieldAddonProps = {
  tmdbId: number | string | null;
  onOpen: (mode: 'find' | 'refresh') => void;
};

export function FieldAddon({ tmdbId, onOpen }: FieldAddonProps) {
  const hasTmdbId = tmdbId !== null && tmdbId !== '';
  const mode = hasTmdbId ? 'refresh' : 'find';

  return (
    <button type="button" onClick={() => onOpen(mode)}>
      {hasTmdbId ? 'Refresh from TMDB' : 'Find movie'}
    </button>
  );
}
```

Create `src/ui/ConfigScreen.tsx`:

```tsx
import { Button, FieldGroup, TextField } from 'datocms-react-ui';
import { useState } from 'react';
import { parsePluginParameters, validatePluginParameters, type PluginParameters } from '../plugin/parameters';

type ConfigScreenProps = {
  parameters: PluginParameters;
  onSave: (params: PluginParameters) => Promise<void>;
};

export function ConfigScreen({ parameters, onSave }: ConfigScreenProps) {
  const [draft, setDraft] = useState(parameters);
  const issues = validatePluginParameters(draft);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(draft);
      }}
    >
      <FieldGroup>
        <TextField
          id="tmdbReadToken"
          name="tmdbReadToken"
          label="TMDB read token"
          value={draft.tmdbReadToken}
          onChange={(value) => setDraft(parsePluginParameters({ ...draft, tmdbReadToken: value }))}
        />
      </FieldGroup>
      <p>Because this version is frontend-only, authenticated editors can inspect the TMDB read token in the browser.</p>
      {issues.map((issue) => (
        <p key={issue.code}>{issue.message}</p>
      ))}
      <Button type="submit" buttonType="primary">
        Save configuration
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Route real components through App**

Modify `src/App.tsx` so it imports `ConfigScreen`, `FieldAddon`, and `parsePluginParameters`, then renders:

```tsx
import { ConfigScreen } from './ui/ConfigScreen';
import { FieldAddon } from './ui/FieldAddon';
import { parsePluginParameters } from './plugin/parameters';

export type PluginScreen =
  | { type: 'config'; parameters?: unknown; onSave?: (params: unknown) => Promise<void> }
  | { type: 'fieldAddon'; tmdbId?: number | string | null; onOpen?: (mode: 'find' | 'refresh') => void }
  | { type: 'modal' }
  | { type: 'unknown'; label: string };

type AppProps = {
  screen: PluginScreen;
};

export function App({ screen }: AppProps) {
  if (screen.type === 'config') {
    return <ConfigScreen parameters={parsePluginParameters(screen.parameters)} onSave={async (params) => screen.onSave?.(params)} />;
  }

  if (screen.type === 'fieldAddon') {
    return <FieldAddon tmdbId={screen.tmdbId ?? null} onOpen={(mode) => screen.onOpen?.(mode)} />;
  }

  if (screen.type === 'modal') {
    return <div>TMDB Movie Import</div>;
  }

  return <div>Unsupported plugin screen: {screen.label}</div>;
}
```

- [ ] **Step 4: Wire DatoCMS hooks to screens**

Modify `src/main.tsx` to pass plugin parameters to config and read the current field value in the field add-on:

```tsx
connect({
  renderConfigScreen(ctx) {
    render(
      {
        type: 'config',
        parameters: ctx.plugin.attributes.parameters,
        onSave: async (params) => {
          await ctx.updatePluginParameters(params as Record<string, unknown>);
          ctx.notice('Configuration saved');
        },
      },
      ctx,
    );
  },
  renderFieldExtension(_fieldExtensionId, ctx) {
    render(
      {
        type: 'fieldAddon',
        tmdbId: ctx.formValues[ctx.fieldPath] as number | string | null,
        onOpen: async (mode) => {
          await ctx.openModal({
            id: 'tmdbMovieImport',
            title: mode === 'refresh' ? 'Refresh from TMDB' : 'Find movie',
            width: 'l',
            parameters: { mode },
          });
        },
      },
      ctx,
    );
  },
  renderModal(_modalId, ctx) {
    render({ type: 'modal' }, ctx);
  },
});
```

- [ ] **Step 5: Verify UI route tests**

Run: `npm test -- src/ui/FieldAddon.test.tsx src/ui/ConfigScreen.test.tsx src/App.test.tsx`

Expected: PASS.

Run: `npm run typecheck`

Expected: command exits 0.

- [ ] **Step 6: Commit configuration and launcher UI**

Run:

```bash
git add src/App.tsx src/main.tsx src/ui/ConfigScreen.tsx src/ui/ConfigScreen.test.tsx src/ui/FieldAddon.tsx src/ui/FieldAddon.test.tsx
git commit -m "feat: add plugin configuration and launcher UI"
```

Expected: commit succeeds.

---

### Task 8: Build Guided Search, Review, and Confirmation Modal

**Files:**
- Create: `src/ui/ImportModal.tsx`
- Create: `src/ui/ImportModal.test.tsx`
- Create: `src/ui/SearchStep.tsx`
- Create: `src/ui/ReviewStep.tsx`
- Create: `src/ui/ConfirmStep.tsx`
- Create: `src/ui/FieldDiffTable.tsx`
- Create: `src/ui/ImagePicker.tsx`
- Create: `src/ui/PersonResolutionList.tsx`
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `TmdbClient`, `normalizeTmdbMovie`, `compareMovieFields`, `defaultImageSelection`, `buildImportPlan`, `executeImportPlan`.
- Produces: `ImportModal(props: ImportModalProps)` where `ImportModalProps` receives current values, parameters, provider client, gateway, and `onClose`.
- Produces: three-step editor flow: Search, Review, Import.

- [ ] **Step 1: Write modal workflow tests**

Create `src/ui/ImportModal.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportModal } from './ImportModal';
import type { NormalizedMovie } from '../domain/movie';

const movie: NormalizedMovie = {
  tmdbId: 123,
  title: 'Example Movie',
  primaryReleaseDate: '2024-03-01',
  yearReleased: 2024,
  mpaaRating: 'PG-13',
  runtime: 125,
  tagline: 'A useful tagline',
  description: 'Overview text',
  directors: [{ tmdbId: 10, name: 'Director Name', order: 0, role: 'director' }],
  actors: [{ tmdbId: 20, name: 'Actor Name', order: 0, role: 'actor' }],
  images: [],
};

describe('ImportModal', () => {
  it('searches, shows review, and reaches confirmation without writing early', async () => {
    const execute = vi.fn();
    render(
      <ImportModal
        initialTitle="Example"
        initialYear={2024}
        currentValues={{ title: '' }}
        mappedFields={['title', 'runtime', 'tmdbId']}
        searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: 'Overview text', posterPath: null }]}
        loadMovie={async () => movie}
        execute={execute}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    await userEvent.click(screen.getByRole('button', { name: /Example Movie/i }));

    expect(screen.getByText('Review changes')).toBeInTheDocument();
    expect(execute).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Confirm import')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement small modal step components**

Create `src/ui/SearchStep.tsx`:

```tsx
import type { TmdbSearchResult } from '../providers/tmdbTypes';

type SearchStepProps = {
  title: string;
  year: number | null;
  results: TmdbSearchResult[];
  onTitleChange: (title: string) => void;
  onYearChange: (year: number | null) => void;
  onSearch: () => void;
  onSelect: (id: number) => void;
};

export function SearchStep({ title, year, results, onTitleChange, onYearChange, onSearch, onSelect }: SearchStepProps) {
  return (
    <section>
      <h2>Search</h2>
      <label>
        Title
        <input value={title} onChange={(event) => onTitleChange(event.target.value)} />
      </label>
      <label>
        Year
        <input value={year ?? ''} onChange={(event) => onYearChange(event.target.value ? Number(event.target.value) : null)} />
      </label>
      <button type="button" onClick={onSearch}>
        Search
      </button>
      {results.map((result) => (
        <button key={result.id} type="button" onClick={() => onSelect(result.id)}>
          {result.title} {result.releaseDate ? `(${result.releaseDate.slice(0, 4)})` : ''}
        </button>
      ))}
    </section>
  );
}
```

Create `src/ui/FieldDiffTable.tsx`:

```tsx
import type { FieldComparison } from '../domain/fieldComparison';

type FieldDiffTableProps = {
  comparisons: FieldComparison[];
  onToggle: (key: FieldComparison['key']) => void;
  onSelectAll: () => void;
};

export function FieldDiffTable({ comparisons, onToggle, onSelectAll }: FieldDiffTableProps) {
  return (
    <div>
      <button type="button" onClick={onSelectAll}>
        Select all changes
      </button>
      {comparisons.map((comparison) => (
        <label key={comparison.key}>
          <input type="checkbox" checked={comparison.selected} disabled={!comparison.available || !comparison.changed} onChange={() => onToggle(comparison.key)} />
          {comparison.key}: {String(comparison.currentValue ?? '')} -> {String(comparison.proposedValue ?? '')}
        </label>
      ))}
    </div>
  );
}
```

Create `src/ui/ReviewStep.tsx`:

```tsx
import type { FieldComparison } from '../domain/fieldComparison';
import { FieldDiffTable } from './FieldDiffTable';

type ReviewStepProps = {
  comparisons: FieldComparison[];
  onToggle: (key: FieldComparison['key']) => void;
  onSelectAll: () => void;
  onContinue: () => void;
};

export function ReviewStep({ comparisons, onToggle, onSelectAll, onContinue }: ReviewStepProps) {
  return (
    <section>
      <h2>Review changes</h2>
      <FieldDiffTable comparisons={comparisons} onToggle={onToggle} onSelectAll={onSelectAll} />
      <button type="button" onClick={onContinue}>
        Continue
      </button>
    </section>
  );
}
```

Create `src/ui/ConfirmStep.tsx`:

```tsx
import type { ImportPlan } from '../domain/importPlanning';

type ConfirmStepProps = {
  plan: ImportPlan;
  onConfirm: () => void;
};

export function ConfirmStep({ plan, onConfirm }: ConfirmStepProps) {
  return (
    <section>
      <h2>Confirm import</h2>
      <p>{plan.fieldChanges.length} field changes</p>
      <p>{plan.peopleToCreate.length} draft people to create</p>
      <p>{plan.assetsToUpload.length} images to upload</p>
      <button type="button" onClick={onConfirm}>
        Apply to unsaved movie
      </button>
    </section>
  );
}
```

- [ ] **Step 3: Implement image and person review controls**

Create `src/ui/ImagePicker.tsx`:

```tsx
import type { NormalizedImageCandidate } from '../domain/movie';

type ImagePickerProps = {
  images: NormalizedImageCandidate[];
  selectedIds: string[];
  onToggle: (providerImageId: string) => void;
};

export function ImagePicker({ images, selectedIds, onToggle }: ImagePickerProps) {
  return (
    <div>
      {images.map((image) => (
        <label key={`${image.providerKey}:${image.providerImageId}`}>
          <input type="checkbox" checked={selectedIds.includes(image.providerImageId)} onChange={() => onToggle(image.providerImageId)} />
          <img src={image.originalUrl} alt={`${image.type} candidate`} width={120} />
        </label>
      ))}
    </div>
  );
}
```

Create `src/ui/PersonResolutionList.tsx`:

```tsx
import type { PersonMatchDecision } from '../domain/personMatching';
import type { PersonCandidate } from '../domain/movie';

type PersonResolutionListProps = {
  people: Array<{ candidate: PersonCandidate; decision: PersonMatchDecision }>;
};

export function PersonResolutionList({ people }: PersonResolutionListProps) {
  return (
    <div>
      {people.map(({ candidate, decision }) => (
        <div key={`${candidate.role}:${candidate.tmdbId}`}>
          <strong>{candidate.name}</strong>
          <span>{decision.type}</span>
          {decision.warning ? <p>{decision.warning}</p> : null}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Implement modal orchestration**

Create `src/ui/ImportModal.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { compareMovieFields, type CurrentMovieValues, type FieldComparison } from '../domain/fieldComparison';
import { buildImportPlan, type ImportPlan } from '../domain/importPlanning';
import type { MovieFieldKey, NormalizedMovie } from '../domain/movie';
import type { TmdbSearchQuery, TmdbSearchResult } from '../providers/tmdbTypes';
import { defaultImageSelection } from '../providers/imageProvider';
import { ConfirmStep } from './ConfirmStep';
import { ReviewStep } from './ReviewStep';
import { SearchStep } from './SearchStep';

type Step = 'search' | 'review' | 'confirm';

export type ImportModalProps = {
  initialTitle: string;
  initialYear: number | null;
  currentValues: CurrentMovieValues;
  mappedFields: MovieFieldKey[];
  searchMovies: (query: TmdbSearchQuery) => Promise<TmdbSearchResult[]>;
  loadMovie: (tmdbId: number) => Promise<NormalizedMovie>;
  execute: (plan: ImportPlan) => Promise<void>;
};

export function ImportModal(props: ImportModalProps) {
  const [step, setStep] = useState<Step>('search');
  const [title, setTitle] = useState(props.initialTitle);
  const [year, setYear] = useState<number | null>(props.initialYear);
  const [results, setResults] = useState<TmdbSearchResult[]>([]);
  const [movie, setMovie] = useState<NormalizedMovie | null>(null);
  const [comparisons, setComparisons] = useState<FieldComparison[]>([]);

  const plan = useMemo(() => {
    return buildImportPlan({
      fieldComparisons: comparisons,
      directors: movie?.directors ?? [],
      actors: movie?.actors ?? [],
      imageSelection: movie ? defaultImageSelection(props.currentValues, movie.images) : { poster: null, backdrops: [] },
      personResolutions: [],
    });
  }, [comparisons, movie, props.currentValues]);

  if (step === 'search') {
    return (
      <SearchStep
        title={title}
        year={year}
        results={results}
        onTitleChange={setTitle}
        onYearChange={setYear}
        onSearch={async () => setResults(await props.searchMovies({ title, year }))}
        onSelect={async (id) => {
          const loaded = await props.loadMovie(id);
          setMovie(loaded);
          setComparisons(compareMovieFields(props.currentValues, loaded, props.mappedFields));
          setStep('review');
        }}
      />
    );
  }

  if (step === 'review') {
    return (
      <ReviewStep
        comparisons={comparisons}
        onToggle={(key) => setComparisons((items) => items.map((item) => (item.key === key ? { ...item, selected: !item.selected } : item)))}
        onSelectAll={() => setComparisons((items) => items.map((item) => ({ ...item, selected: item.available && item.changed })))}
        onContinue={() => setStep('confirm')}
      />
    );
  }

  return <ConfirmStep plan={plan} onConfirm={() => void props.execute(plan)} />;
}
```

- [ ] **Step 5: Wire modal into App and Dato renderModal**

Modify `src/App.tsx` to make the modal screen accept `ImportModalProps`:

```tsx
import { ConfigScreen } from './ui/ConfigScreen';
import { FieldAddon } from './ui/FieldAddon';
import { ImportModal, type ImportModalProps } from './ui/ImportModal';
import { parsePluginParameters } from './plugin/parameters';

export type PluginScreen =
  | { type: 'config'; parameters?: unknown; onSave?: (params: unknown) => Promise<void> }
  | { type: 'fieldAddon'; tmdbId?: number | string | null; onOpen?: (mode: 'find' | 'refresh') => void }
  | ({ type: 'modal' } & ImportModalProps)
  | { type: 'unknown'; label: string };

type AppProps = {
  screen: PluginScreen;
};

export function App({ screen }: AppProps) {
  if (screen.type === 'config') {
    return <ConfigScreen parameters={parsePluginParameters(screen.parameters)} onSave={async (params) => screen.onSave?.(params)} />;
  }

  if (screen.type === 'fieldAddon') {
    return <FieldAddon tmdbId={screen.tmdbId ?? null} onOpen={(mode) => screen.onOpen?.(mode)} />;
  }

  if (screen.type === 'modal') {
    return <ImportModal {...screen} />;
  }

  return <div>Unsupported plugin screen: {screen.label}</div>;
}
```

Modify `src/main.tsx` so `renderModal` creates `TmdbClient`, normalizes loaded movies, creates the Dato gateway, and passes callbacks into `ImportModal`. Use the pure module interfaces from earlier tasks and keep the Dato SDK-specific code inside `main.tsx`.

- [ ] **Step 6: Verify modal workflow tests**

Run: `npm test -- src/ui/ImportModal.test.tsx`

Expected: PASS.

Run: `npm run typecheck`

Expected: command exits 0.

- [ ] **Step 7: Commit modal workflow**

Run:

```bash
git add src/App.tsx src/main.tsx src/ui
git commit -m "feat: add guided TMDB import modal"
```

Expected: commit succeeds.

---

### Task 9: Complete Integration Tests, Documentation, and Release Verification

**Files:**
- Create: `src/dato/importFlow.integration.test.ts`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-07-21-tmdb-movie-import-plugin-design.md` only if implementation reveals a design correction that the user approves first.

**Interfaces:**
- Consumes: all prior production modules.
- Produces: mocked end-to-end proof that no DatoCMS side effects occur before confirmation, dependency failures block movie form updates, selected fields only are applied, and missing TMDB values do not clear fields.

- [ ] **Step 1: Write mocked integration test for successful import**

Create `src/dato/importFlow.integration.test.ts`:

```ts
import { compareMovieFields } from '../domain/fieldComparison';
import { buildImportPlan } from '../domain/importPlanning';
import { executeImportPlan } from './importExecutor';
import type { NormalizedMovie } from '../domain/movie';
import type { PluginParameters } from '../plugin/parameters';

const params: PluginParameters = {
  tmdbReadToken: 'token',
  movieModelApiKey: 'movie',
  targetLocale: 'en',
  movieFields: { title: 'title', runtime: 'runtime', directors: 'directors' },
  personModelApiKey: 'person',
  personNameFieldApiKey: 'name',
  personTmdbIdFieldApiKey: 'tmdb_id',
  actorLimit: 10,
};

const movie: NormalizedMovie = {
  tmdbId: 123,
  title: 'Example Movie',
  primaryReleaseDate: '2024-03-01',
  yearReleased: 2024,
  mpaaRating: null,
  runtime: 125,
  tagline: null,
  description: null,
  directors: [{ tmdbId: 10, name: 'Director Name', order: 0, role: 'director' }],
  actors: [],
  images: [],
};

describe('import flow integration', () => {
  it('applies only selected fields after dependencies resolve', async () => {
    const comparisons = compareMovieFields({ title: '', runtime: 120, mpaaRating: 'R' }, movie, ['title', 'runtime', 'mpaaRating']);
    const plan = buildImportPlan({
      fieldComparisons: comparisons,
      directors: movie.directors,
      actors: movie.actors,
      imageSelection: { poster: null, backdrops: [] },
      personResolutions: [{ candidateTmdbId: 10, action: 'create', name: 'Director Name' }],
    });
    const applied: Array<{ fieldPath: string; value: unknown }> = [];

    const result = await executeImportPlan(plan, params, {
      async createPersonDraft() {
        return { id: 'person-1' };
      },
      async uploadImage() {
        throw new Error('unexpected upload');
      },
      async applyFormValues(changes) {
        applied.push(...changes);
      },
    });

    expect(result.status).toBe('success');
    expect(applied.map((change) => change.fieldPath)).toEqual(['title', 'directors']);
  });
});
```

- [ ] **Step 2: Add integration tests for failure and retry behavior**

Append to `src/dato/importFlow.integration.test.ts`:

```ts
it('does not update movie form when person creation fails', async () => {
  const plan = buildImportPlan({
    fieldComparisons: compareMovieFields({ title: '' }, movie, ['title']),
    directors: movie.directors,
    actors: [],
    imageSelection: { poster: null, backdrops: [] },
    personResolutions: [{ candidateTmdbId: 10, action: 'create', name: 'Director Name' }],
  });
  const applyFormValues = vi.fn();

  const result = await executeImportPlan(plan, params, {
    async createPersonDraft() {
      throw new Error('item create permission denied');
    },
    async uploadImage() {
      return { id: 'upload-1' };
    },
    applyFormValues,
  });

  expect(result.status).toBe('dependency_failed');
  expect(applyFormValues).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Complete README**

Update `README.md` with these sections:

- `Local development`: `npm install`, `npm run dev`, `npm test`, `npm run build`.
- `DatoCMS setup`: install the plugin, configure movie model mappings, attach the field add-on to the TMDB ID field, configure shared person model and name field.
- `Security note`: frontend-only v1 exposes the TMDB read token to authenticated editors and never stores a DatoCMS CMA token.
- `Editor flow`: Find movie, Review changes, Confirm import, then manually save/publish the movie.
- `Verification`: automated commands and manual sandbox checklist.

- [ ] **Step 4: Run full automated verification**

Run: `npm test`

Expected: all tests pass.

Run: `npm run typecheck`

Expected: command exits 0.

Run: `npm run lint`

Expected: command exits 0.

Run: `npm run build`

Expected: command exits 0 and `dist/` is produced.

- [ ] **Step 5: Manual DatoCMS sandbox acceptance**

Use a sandbox project with:

- Movie model containing all mapped fields from the spec.
- Shared person model with `name` and optional `tmdb_id`.
- Editor role with item create and upload permissions.
- Restricted role without at least one required permission.

Verify:

- Authorized editor can configure mappings.
- Field add-on opens from TMDB ID field.
- Search by title/year works.
- Direct TMDB ID refresh works.
- Empty fields are selected by default.
- Populated fields are unselected by default.
- Missing TMDB values cannot clear existing content.
- Ambiguous people require an editor choice.
- Missing people are created as drafts.
- Poster and selected backdrops upload to DatoCMS Media.
- The movie form changes but the record is not saved or published.
- Restricted role receives a permission error before movie form updates.

- [ ] **Step 6: Commit release-ready implementation**

Run:

```bash
git add README.md src/dato/importFlow.integration.test.ts
git commit -m "test: cover TMDB import flow"
```

Expected: commit succeeds.

---

## Self-Review

### Spec Coverage

- Movie-only scope: covered in global constraints, domain types, TMDB client, and modal flow tasks.
- Field mappings for title, year, rating, runtime, TMDB ID, tagline, description, poster, backdrops, directors, actors: covered by domain types, parameter validation, field comparison, image selection, planning, and executor tasks.
- Shared person model with name-only current schema and optional TMDB ID: covered by parameter validation, person matching, and gateway tasks.
- Frontend-only DatoCMS current-user token architecture: covered by global constraints, gateway, config screen, and main hook wiring.
- Guided Search, Review, Import modal: covered by Task 8.
- Review defaults for empty/populated fields and missing TMDB values: covered by Task 4 and Task 9 integration tests.
- Poster/backdrop selection defaults and provider-neutral image boundary: covered by Task 4 and Task 8.
- Person matching order and draft creation: covered by Task 5 and Task 6.
- Import write order and partial failure behavior: covered by Task 6 and Task 9.
- Security limitations and token redaction: covered by Task 3 TMDB errors, Task 7 config warning, and README.
- Test strategy: unit, fixture, component, mocked integration, build, and manual sandbox verification are covered by Tasks 1 through 9.

### Placeholder Scan

- The plan avoids blank-marker language and unbounded catch-all instructions.
- Task 8 names the modules and interfaces that own modal wiring so implementation stays bounded to DatoCMS hook routing plus the pure modules created earlier.

### Type Consistency

- `PluginParameters`, `MovieFieldKey`, `NormalizedMovie`, `NormalizedImageCandidate`, `PersonCandidate`, `FieldComparison`, `ImageSelection`, `PersonResolution`, `ImportPlan`, `DatoGateway`, and `ImportResult` names are introduced before later tasks consume them.
- Later UI and integration tests consume the same names defined in earlier tasks.
- Field keys use the same camelCase names across parameters, comparisons, plans, and tests.
