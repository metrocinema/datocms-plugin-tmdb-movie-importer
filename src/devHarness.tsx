import React from 'react';
import ReactDOM from 'react-dom/client';
import { Canvas } from 'datocms-react-ui';
import { App, type PluginScreen } from './App';
import type { NormalizedMovie } from './domain/movie';

type HarnessMode = 'modal' | 'config' | 'field';

export function isDevHarnessRequest(url = window.location.href) {
  if (!import.meta.env.DEV) {
    return false;
  }

  return new URL(url).searchParams.has('impeccable');
}

export function renderDevHarness() {
  const root = ReactDOM.createRoot(document.getElementById('root')!);
  root.render(
    <React.StrictMode>
      <Canvas ctx={mockCanvasContext as never} noAutoResizer>
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

const designTokens = {
  '--color--ink': '#1f2933',
  '--color--ink-muted': '#5d6a76',
  '--color--border': '#d9e1e8',
  '--color--surface': '#ffffff',
  '--color--surface-muted': '#f5f7f9',
  '--color--surface-raised': '#ffffff',
  '--color--primary': '#2f80ed',
  '--color--primary-soft--surface': '#eaf3ff',
  '--color--primary-soft--ink': '#1559a7',
  '--color--warning-soft--surface': '#fff7e6',
  '--color--warning-soft--ink': '#8a4b00',
  '--color--warning-soft--border': '#f4d08a',
  '--font-size-xs': '12px',
  '--font-size-s': '13px',
  '--font-size-m': '14px',
  '--font-size-l': '16px',
  '--font-size-xl': '20px',
  '--font-size-xxl': '24px',
  '--spacing-xs': '4px',
  '--spacing-s': '8px',
  '--spacing-m': '16px',
  '--spacing-l': '24px',
  '--shadow--raised': '0 2px 8px rgb(31 41 51 / 8%)',
};

const mockCanvasContext = {
  bodyPadding: [24, 24, 24, 24],
  mode: 'renderModal',
  theme: designTokens,
  cssDesignTokens: designTokens,
};
