import React from 'react';
import ReactDOM from 'react-dom/client';
import { Canvas } from 'datocms-react-ui';
import { App, type PluginScreen } from './App';
import type { NormalizedMovie } from './domain/movie';

type HarnessMode = 'modal' | 'config' | 'field';
type HarnessTheme = 'light' | 'dark';

export function isDevHarnessRequest(url = window.location.href) {
  if (!import.meta.env.DEV) {
    return false;
  }

  return new URL(url).searchParams.has('impeccable');
}

export function renderDevHarness() {
  const theme = harnessTheme();
  const ctx = mockCanvasContext(theme);

  document.documentElement.dataset.colorScheme = theme;
  document.documentElement.style.colorScheme = theme;

  const root = ReactDOM.createRoot(document.getElementById('root')!);
  root.render(
    <React.StrictMode>
      <Canvas ctx={ctx as never} noAutoResizer>
        <App screen={screenForHarnessMode(harnessMode())} />
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

function harnessTheme(): HarnessTheme {
  const requestedTheme = new URL(window.location.href).searchParams.get('theme');

  return requestedTheme === 'dark' ? 'dark' : 'light';
}

function screenForHarnessMode(mode: HarnessMode): PluginScreen {
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

  return {
    type: 'modal',
    configurationIssues: [],
    initialTitle: 'In the Mood for Love',
    initialYear: 2000,
    initialTmdbId: null,
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
    mappedFields: ['title', 'yearReleased', 'mpaaRating', 'runtime', 'tmdbId', 'tagline', 'description', 'poster', 'heroImage', 'backdrops', 'directors', 'actors'],
    searchMovies: async () => [
      {
        tmdbId: fixtureMovie.tmdbId,
        id: fixtureMovie.tmdbId,
        title: fixtureMovie.title,
        releaseDate: fixtureMovie.primaryReleaseDate,
        yearReleased: fixtureMovie.yearReleased,
        posterPath: fixtureMovie.images[0]?.providerImageId ?? null,
        posterUrl: fixtureMovie.images[0]?.originalUrl ?? null,
        overview: fixtureMovie.description,
      },
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
    loadMovie: async () => fixtureMovie,
    tmdbIdFieldConfigured: true,
    resolvePeople: async () => [
      { id: 'person-tony-leung', name: 'Tony Leung Chiu-wai', tmdbId: 1337 },
    ],
    execute: async (plan) => {
      console.info('Impeccable harness import plan', plan);
    },
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
      width: 1920,
      height: 1080,
      language: null,
      rank: 2,
      attribution: 'TMDB',
    },
  ],
};

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

function mockCanvasContext(colorScheme: HarnessTheme) {
  const cssDesignTokens = colorScheme === 'dark' ? darkDesignTokens : lightDesignTokens;

  return {
    bodyPadding: [24, 24, 24, 24],
    colorScheme,
    mode: 'renderModal',
    theme: cssDesignTokens,
    cssDesignTokens,
  };
}
