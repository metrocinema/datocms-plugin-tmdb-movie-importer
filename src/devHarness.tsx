import React from 'react';
import { Canvas } from 'datocms-react-ui';
import { App, type PluginScreen } from './App';
import type { ImportProgressEvent, PrepareImportResult } from './dato/importExecutor';
import type { ImportPlan } from './domain/importPlanning';
import type { NormalizedMovie } from './domain/movie';
import { renderIntoRoot } from './reactRoot';

type HarnessMode = 'modal' | 'config' | 'field';
type HarnessTheme = 'light' | 'dark' | 'dato-dark';
type HarnessScenario = 'default' | 'odyssey-existing';
export type HarnessProgress = 'search' | 'import' | 'failure' | null;

export function isDevHarnessRequest(url = window.location.href, isEmbedded = window.parent !== window) {
  if (!import.meta.env.DEV) {
    return false;
  }

  if (isEmbedded) {
    return false;
  }

  return new URL(url).searchParams.has('impeccable');
}

export function renderDevHarness() {
  const theme = harnessTheme();
  const colorScheme = theme === 'dato-dark' ? 'dark' : theme;
  const ctx = mockCanvasContext(theme);
  const scenario = harnessScenario();
  const progress = harnessProgress();

  document.documentElement.dataset.colorScheme = colorScheme;
  document.documentElement.style.colorScheme = colorScheme;

  renderIntoRoot(
    document.getElementById('root')!,
    <React.StrictMode>
      <Canvas ctx={ctx as never} noAutoResizer>
        <App screen={screenForHarnessMode(harnessMode(), scenario, progress)} />
      </Canvas>
    </React.StrictMode>,
  );
}

function harnessMode(): HarnessMode {
  const requestedMode = new URL(window.location.href).searchParams.get('impeccable');

  if (requestedMode === 'config' || requestedMode === 'field') {
    return requestedMode;
  }

  return 'modal';
}

export function harnessTheme(url = window.location.href): HarnessTheme {
  const requestedTheme = new URL(url).searchParams.get('theme');

  if (requestedTheme === 'dark' || requestedTheme === 'dato-dark') {
    return requestedTheme;
  }

  return 'light';
}

export function harnessScenario(url = window.location.href): HarnessScenario {
  return new URL(url).searchParams.get('scenario') === 'odyssey-existing' ? 'odyssey-existing' : 'default';
}

export function harnessProgress(url = window.location.href): HarnessProgress {
  const value = new URL(url).searchParams.get('progress');
  return value === 'search' || value === 'import' || value === 'failure' ? value : null;
}

export function screenForHarnessMode(
  mode: HarnessMode,
  scenario: HarnessScenario = 'default',
  progress: HarnessProgress = null,
): PluginScreen {
  if (mode === 'config') {
    return {
      type: 'config',
      parameters: {
        tmdbReadToken: 'visual-review-token',
        movieModelApiKey: 'movie',
        movieFields: {
          title: 'title',
          yearReleased: 'year_released',
          mpaaRating: 'mpaa_rating',
          runtime: 'run_time_min',
          tmdbId: 'tmdb_id',
          tagline: 'tagline',
          description: 'description',
          poster: 'poster_image',
          heroImage: 'hero_image',
          backdrops: 'other_images',
          directors: 'directors',
          actors: 'actors',
        },
        personModelApiKey: 'person',
        personNameFieldApiKey: 'name',
        personTmdbIdFieldApiKey: 'tmdb_id',
        actorLimit: 10,
      },
      onSave: async () => undefined,
    };
  }

  if (mode === 'field') {
    return {
      type: 'fieldAddon',
      tmdbId: null,
      onOpen: () => undefined,
      configurationIssues: [],
    };
  }

  const modalScenario = modalScenarioFor(scenario);

  return {
    type: 'modal',
    configurationIssues: [],
    initialTitle: modalScenario.initialTitle,
    initialYear: modalScenario.initialYear,
    initialTmdbId: null,
    currentValues: modalScenario.currentValues,
    mappedFields: ['title', 'yearReleased', 'mpaaRating', 'runtime', 'tmdbId', 'tagline', 'description', 'poster', 'heroImage', 'backdrops', 'directors', 'actors'],
    searchMovies: progress === 'search'
      ? () => pendingHarnessPromise()
      : async () => modalScenario.searchResults,
    loadMovie: async () => modalScenario.movie,
    tmdbIdFieldConfigured: true,
    resolvePeople: async () => modalScenario.people,
    prepare: (plan, onProgress) => prepareHarnessImport(progress, plan, onProgress),
    resolve: async (prepared) => {
      console.info('Impeccable harness prepared import', prepared);
    },
  };
}

function prepareHarnessImport(
  progress: HarnessProgress,
  plan: ImportPlan,
  onProgress: (event: ImportProgressEvent) => void,
): Promise<PrepareImportResult> {
  console.info('Impeccable harness import plan', plan);

  if (progress === 'import') {
    onProgress({ phase: 'people_create', state: 'active', completed: 1, total: 2 });
    onProgress({ phase: 'images', state: 'active', completed: 2, total: 5 });
    return pendingHarnessPromise();
  }

  if (progress === 'failure') {
    onProgress({ phase: 'people_create', state: 'complete', completed: 1, total: 1 });
    onProgress({ phase: 'images', state: 'failed', completed: 1, total: 2, message: 'The second image could not be uploaded.' });
    return Promise.resolve({
      status: 'dependency_failed' as const,
      failedPhase: 'images' as const,
      message: 'The second image could not be uploaded.',
      createdPeople: ['person-wong-kar-wai'],
      uploadedAssets: ['upload-poster'],
    });
  }

  return pendingHarnessPromise();
}

function pendingHarnessPromise<T = never>(): Promise<T> {
  return new Promise<T>(() => undefined);
}

function modalScenarioFor(scenario: HarnessScenario) {
  if (scenario === 'odyssey-existing') {
    return {
      initialTitle: 'The Odyssey',
      initialYear: 2026,
      currentValues: {
        title: 'The Odyssey',
        yearReleased: 2026,
        mpaaRating: 'R',
        runtime: 172,
        tmdbId: 1368337,
        tagline: '',
        description: 'Christopher Nolan reimagines Homer’s legendary epic, following Odysseus on his perilous voyage home after the Trojan War.',
        poster: { upload_id: 'existing-poster' },
        heroImage: { upload_id: 'existing-hero' },
        backdrops: [{ upload_id: 'existing-backdrop' }],
        directors: [{ id: 'existing-director-christopher-nolan' }],
        actors: [{ id: 'existing-actor-matt-damon' }],
      },
      movie: odysseyFixtureMovie,
      searchResults: [searchResultForMovie(odysseyFixtureMovie)],
      people: [
        { id: 'person-christopher-nolan', name: 'Christopher Nolan', tmdbId: 525 },
        { id: 'person-matt-damon', name: 'Matt Damon', tmdbId: 1892 },
      ],
    };
  }

  return {
    initialTitle: 'In the Mood for Love',
    initialYear: 2000,
    currentValues: {
      title: '',
      yearReleased: null,
      mpaaRating: '',
      runtime: null,
      tmdbId: null,
      tagline: '',
      description: '',
      poster: null,
      heroImage: null,
      backdrops: [],
      directors: [],
      actors: [],
    },
    movie: fixtureMovie,
    searchResults: [
      searchResultForMovie(fixtureMovie),
      {
        tmdbId: 194,
        id: 194,
        title: 'Amélie',
        releaseDate: '2001-04-25',
        yearReleased: 2001,
        posterPath: '/oTKduWL2tpIKEmkAqF4mFEAWAsv.jpg',
        posterUrl: 'https://image.tmdb.org/t/p/w342/oTKduWL2tpIKEmkAqF4mFEAWAsv.jpg',
        overview: 'A shy Parisian waitress gently changes the lives of the people around her.',
      },
    ],
    people: [
      { id: 'person-tony-leung', name: 'Tony Leung Chiu-wai', tmdbId: 1337 },
    ],
  };
}

function searchResultForMovie(movie: NormalizedMovie) {
  return {
    tmdbId: movie.tmdbId,
    id: movie.tmdbId,
    title: movie.title,
    releaseDate: movie.primaryReleaseDate,
    yearReleased: movie.yearReleased,
    posterPath: movie.images.find((image) => image.type === 'poster')?.providerImageId ?? null,
    posterUrl: movie.images.find((image) => image.type === 'poster')?.previewUrl ?? movie.images.find((image) => image.type === 'poster')?.originalUrl ?? null,
    overview: movie.description,
  };
}

const fixtureMovie: NormalizedMovie = {
  tmdbId: 843,
  title: 'In the Mood for Love',
  primaryReleaseDate: '2000-09-29',
  yearReleased: 2000,
  mpaaRating: 'PG',
  runtime: 99,
  tagline: 'Feel the heat, keep the feeling burning, let the sensation explode.',
  description: 'Two neighbors form a strong bond after both suspect extramarital activities of their spouses.',
  directors: [{ tmdbId: 12453, name: 'Wong Kar-wai', order: 0, role: 'director' }],
  actors: [
    { tmdbId: 1337, name: 'Tony Leung Chiu-wai', order: 0, role: 'actor' },
    { tmdbId: 1620, name: 'Maggie Cheung', order: 1, role: 'actor' },
  ],
  images: [
    {
      providerKey: 'tmdb',
      providerImageId: '/iYypPT4bhqXfq1b6EnmxvRt6b2Y.jpg',
      movieIdentity: { providerKey: 'tmdb', tmdbId: 843 },
      type: 'poster',
      originalUrl: 'https://image.tmdb.org/t/p/original/iYypPT4bhqXfq1b6EnmxvRt6b2Y.jpg',
      previewUrl: 'https://image.tmdb.org/t/p/w342/iYypPT4bhqXfq1b6EnmxvRt6b2Y.jpg',
      width: 1000,
      height: 1500,
      language: 'en',
      rank: 1,
      attribution: 'TMDB',
    },
    {
      providerKey: 'tmdb',
      providerImageId: '/5mO2F1HKLk7thS2FSNm4LaDkpoZ.jpg',
      movieIdentity: { providerKey: 'tmdb', tmdbId: 843 },
      type: 'backdrop',
      originalUrl: 'https://image.tmdb.org/t/p/original/5mO2F1HKLk7thS2FSNm4LaDkpoZ.jpg',
      previewUrl: 'https://image.tmdb.org/t/p/w780/5mO2F1HKLk7thS2FSNm4LaDkpoZ.jpg',
      width: 1920,
      height: 1080,
      language: null,
      rank: 1,
      attribution: 'TMDB',
    },
    {
      providerKey: 'tmdb',
      providerImageId: '/m6Nq7VwTAeA5H7mbISNjxTWEqdd.jpg',
      movieIdentity: { providerKey: 'tmdb', tmdbId: 843 },
      type: 'backdrop',
      originalUrl: 'https://image.tmdb.org/t/p/original/m6Nq7VwTAeA5H7mbISNjxTWEqdd.jpg',
      previewUrl: 'https://image.tmdb.org/t/p/w780/m6Nq7VwTAeA5H7mbISNjxTWEqdd.jpg',
      width: 1920,
      height: 1080,
      language: null,
      rank: 2,
      attribution: 'TMDB',
    },
  ],
};

const odysseyFixtureMovie: NormalizedMovie = {
  tmdbId: 1368337,
  title: 'The Odyssey',
  primaryReleaseDate: '2026-07-17',
  yearReleased: 2026,
  mpaaRating: 'R',
  runtime: 173,
  tagline: 'Defy the gods.',
  description: 'Odysseus, the legendary King of Ithaca, embarks on a long and perilous journey home after the Trojan War.',
  directors: [{ tmdbId: 525, name: 'Christopher Nolan', order: 0, role: 'director' }],
  actors: [
    { tmdbId: 1892, name: 'Matt Damon', order: 0, role: 'actor' },
    { tmdbId: 500, name: 'Tom Holland', order: 1, role: 'actor' },
    { tmdbId: 10882, name: 'Zendaya', order: 2, role: 'actor' },
  ],
  images: [
    ...posterCandidatesFor(1368337),
    ...backdropCandidatesFor(1368337),
  ],
};

function posterCandidatesFor(tmdbId: number) {
  return Array.from({ length: 10 }, (_, index) => {
    const rank = index + 1;
    const id = `/odyssey-poster-${rank}.jpg`;
    return {
      providerKey: 'tmdb',
      providerImageId: id,
      movieIdentity: { providerKey: 'tmdb' as const, tmdbId },
      type: 'poster' as const,
      originalUrl: `https://image.tmdb.org/t/p/original${id}`,
      previewUrl: `https://image.tmdb.org/t/p/w342${id}`,
      width: 1000,
      height: 1500,
      language: 'en',
      rank,
      attribution: 'TMDB',
    };
  });
}

function backdropCandidatesFor(tmdbId: number) {
  return Array.from({ length: 10 }, (_, index) => {
    const rank = index + 1;
    const id = `/odyssey-backdrop-${rank}.jpg`;
    return {
      providerKey: 'tmdb',
      providerImageId: id,
      movieIdentity: { providerKey: 'tmdb' as const, tmdbId },
      type: 'backdrop' as const,
      originalUrl: `https://image.tmdb.org/t/p/original${id}`,
      previewUrl: `https://image.tmdb.org/t/p/w780${id}`,
      width: 1920,
      height: 1080,
      language: null,
      rank,
      attribution: 'TMDB',
    };
  });
}

const lightDesignTokens = {
  '--color--ink': '#1f2933',
  '--color--ink-subtle': '#5d6a76',
  '--color--ink-muted': '#5d6a76',
  '--color--ink-placeholder': '#8c99a5',
  '--color--border': '#d9e1e8',
  '--color--border-hover': '#b9c6d3',
  '--color--surface': '#ffffff',
  '--color--surface-hover': '#f5f7f9',
  '--color--surface-muted': '#f5f7f9',
  '--color--surface-raised': '#ffffff',
  '--color--primary': '#2f80ed',
  '--color--primary--surface': '#2563eb',
  '--color--primary--surface-hover': '#1d4ed8',
  '--color--primary--surface-active': '#1e40af',
  '--color--primary--surface-secondary': '#dbeafe',
  '--color--primary--ink': '#ffffff',
  '--color--primary-soft--surface': '#eaf3ff',
  '--color--primary-soft--ink': '#1559a7',
  '--color--selected--surface': '#eef6ff',
  '--color--selected--border': '#2f80ed',
  '--color--selected--ink': '#1559a7',
  '--color--focus--border': '#2f80ed',
  '--color--focus--outline': 'rgb(47 128 237 / 20%)',
  '--color--field-group-media--surface': '#f3f5f8',
  '--color--field-group-media--ink': '#1f2933',
  '--color--success-soft--surface': '#eaf8ef',
  '--color--success-soft--ink': '#1f7a3f',
  '--color--success-soft--border': '#b8e5c7',
  '--color--warning-soft--surface': '#fff7e6',
  '--color--warning-soft--ink': '#8a4b00',
  '--color--warning-soft--border': '#f4d08a',
  '--color--scrollbar--fill': '#b9c6d3',
  '--shadow--raised': '0 2px 8px rgb(31 41 51 / 8%)',
};

const darkDesignTokens = {
  '--color--ink': '#f5f7fb',
  '--color--ink-subtle': '#c4ccd6',
  '--color--ink-muted': '#a7b2bf',
  '--color--ink-placeholder': '#818c99',
  '--color--border': '#344150',
  '--color--border-hover': '#4a5a6b',
  '--color--surface': '#141a22',
  '--color--surface-hover': '#1b2430',
  '--color--surface-muted': '#10151d',
  '--color--surface-raised': '#1a222d',
  '--color--primary': '#60a5fa',
  '--color--primary--surface': '#3b82f6',
  '--color--primary--surface-hover': '#60a5fa',
  '--color--primary--surface-active': '#2563eb',
  '--color--primary--surface-secondary': '#1e3a5f',
  '--color--primary--ink': '#ffffff',
  '--color--primary-soft--surface': '#172f4f',
  '--color--primary-soft--ink': '#bfdbfe',
  '--color--selected--surface': '#18375c',
  '--color--selected--border': '#60a5fa',
  '--color--selected--ink': '#dbeafe',
  '--color--focus--border': '#60a5fa',
  '--color--focus--outline': 'rgb(96 165 250 / 25%)',
  '--color--field-group-media--surface': '#1d2430',
  '--color--field-group-media--ink': '#f5f7fb',
  '--color--success-soft--surface': '#12351f',
  '--color--success-soft--ink': '#86efac',
  '--color--success-soft--border': '#166534',
  '--color--warning-soft--surface': '#3a2a12',
  '--color--warning-soft--ink': '#facc15',
  '--color--warning-soft--border': '#854d0e',
  '--color--scrollbar--fill': '#4a5a6b',
  '--shadow--raised': '0 2px 8px rgb(0 0 0 / 30%)',
};

const datoDarkDesignTokens = {
  '--color--ink': 'oklch(1 0 288)',
  '--color--ink-subtle': 'oklch(0.72 0.012 288)',
  '--color--ink-muted': 'oklch(0.385 0.012 288)',
  '--color--ink-placeholder': 'oklch(0.54 0.012 288)',
  '--color--border': 'oklch(0.385 0.012 288)',
  '--color--border-hover': 'oklch(0.48 0.012 288)',
  '--color--surface': 'oklch(0.2028 0.012 288)',
  '--color--surface-hover': 'oklch(0.24 0.012 288)',
  '--color--surface-muted': 'oklch(0.245 0.012 288)',
  '--color--surface-raised': 'oklch(0.2028 0.012 288)',
  '--color--primary': 'oklch(0.52 0.2 288)',
  '--color--primary--surface': 'oklch(0.3292 0.1714 288)',
  '--color--primary--surface-hover': 'oklch(0.39 0.19 288)',
  '--color--primary--surface-active': 'oklch(0.29 0.16 288)',
  '--color--primary--surface-secondary': 'oklch(0.3292 0.1714 288)',
  '--color--primary--ink': 'oklch(1 0 288)',
  '--color--primary-soft--surface': 'oklch(0.3292 0.1714 288)',
  '--color--primary-soft--ink': 'oklch(1 0 288)',
  '--color--selected--surface': 'oklch(0.3292 0.1714 288)',
  '--color--selected--border': 'oklch(0.52 0.2 288)',
  '--color--selected--ink': 'oklch(1 0 288)',
  '--color--focus--border': 'oklch(0.52 0.2 288)',
  '--color--focus--outline': 'color-mix(in oklch, oklch(0.52 0.2 288) 35%, transparent)',
  '--color--field-group-media--surface': 'oklch(0.2028 0.012 288)',
  '--color--field-group-media--ink': 'oklch(1 0 288)',
  '--color--success-soft--surface': '#12351f',
  '--color--success-soft--ink': '#86efac',
  '--color--success-soft--border': '#166534',
  '--color--warning-soft--surface': 'rgb(59, 34, 0)',
  '--color--warning-soft--ink': 'rgb(249, 224, 185)',
  '--color--warning-soft--border': 'rgb(249, 224, 185)',
  '--color--scrollbar--fill': 'color-mix(in oklch, oklch(0.9462 0.012 288) 30%, transparent)',
  '--shadow--raised': '0 2px 8px rgb(0 0 0 / 30%)',
};

export function harnessDesignTokens(colorScheme: HarnessTheme) {
  if (colorScheme === 'dato-dark') {
    return datoDarkDesignTokens;
  }

  return colorScheme === 'dark' ? darkDesignTokens : lightDesignTokens;
}

function mockCanvasContext(colorScheme: HarnessTheme) {
  const cssDesignTokens = harnessDesignTokens(colorScheme);

  return {
    bodyPadding: [24, 24, 24, 24],
    colorScheme: colorScheme === 'dato-dark' ? 'dark' : colorScheme,
    mode: 'renderModal',
    theme: cssDesignTokens,
    cssDesignTokens,
  };
}
