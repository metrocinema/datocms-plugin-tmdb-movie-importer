import React from 'react';
import { fireEvent, render, screen as testingScreen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { harnessDesignTokens, harnessProgress, harnessScenario, harnessTheme, isDevHarnessRequest, screenForHarnessMode } from './devHarness';
import { compareMovieFields } from './domain/fieldComparison';
import type { ImportPlan } from './domain/importPlanning';
import type { NormalizedImageCandidate } from './domain/movie';
import { defaultImageSelection } from './providers/imageProvider';
import { TrailerReview } from './ui/TrailerReview';

const harnessPlan: ImportPlan = {
  fieldChanges: [{ key: 'title', value: 'Harness movie' }],
  directors: [],
  actors: [],
  peopleToCreate: [
    { candidateTmdbId: 1, candidateRole: 'director', name: 'First Person', source: 'auto' },
    { candidateTmdbId: 2, candidateRole: 'actor', name: 'Second Person', source: 'auto' },
    { candidateTmdbId: 3, candidateRole: 'actor', name: 'Third Person', source: 'auto' },
  ],
  peopleToReuse: [],
  heroImageToUpload: null,
  otherImagesToUpload: [],
  assetsToUpload: Array.from({ length: 5 }, (_, index) => harnessImage(index + 1)),
};

function harnessImage(index: number): NormalizedImageCandidate {
  return {
    providerKey: 'tmdb',
    providerImageId: `/harness-${index}.jpg`,
    movieIdentity: { providerKey: 'tmdb', tmdbId: 843 },
    type: index === 1 ? 'poster' : 'backdrop',
    originalUrl: `https://image.tmdb.org/t/p/original/harness-${index}.jpg`,
    previewUrl: `https://image.tmdb.org/t/p/w780/harness-${index}.jpg`,
    width: 1920,
    height: 1080,
    language: 'en',
    rank: index,
    attribution: 'TMDB',
  };
}

describe('devHarness', () => {
  it('starts the import fixture without selected assets', async () => {
    const screen = screenForHarnessMode('modal', 'default', 'import');
    expect(screen.type).toBe('modal');
    if (screen.type !== 'modal') return;
    const movie = await screen.loadMovie(843);
    const selection = defaultImageSelection(screen.currentValues, movie.images, {
      poster: true,
      heroImage: true,
      backdrops: true,
    });
    expect(selection).toEqual({
      poster: null,
      heroImage: null,
      backdrops: [],
    });
  });

  it('derives pending import progress totals from the plan', async () => {
    const screen = screenForHarnessMode('modal', 'default', 'import');
    expect(screen.type).toBe('modal');
    if (screen.type !== 'modal') return;
    const progress = vi.fn();

    const outcome = await Promise.race([
      screen.prepare(harnessPlan, progress),
      Promise.resolve('pending'),
    ]);

    expect(outcome).toBe('pending');
    expect(progress).toHaveBeenCalledWith({ phase: 'people_create', state: 'active', completed: 1, total: 3 });
    expect(progress).toHaveBeenCalledWith({ phase: 'images', state: 'active', completed: 2, total: 5 });
  });

  it('completes default preparation with sanitized deterministic references', async () => {
    const screen = screenForHarnessMode('modal');
    expect(screen.type).toBe('modal');
    if (screen.type !== 'modal') return;

    const result = await screen.prepare(harnessPlan, vi.fn());

    expect(result).toMatchObject({
      status: 'success',
      prepared: {
        createdPeople: ['harness-person-1', 'harness-person-2', 'harness-person-3'],
        uploadedAssets: ['harness-upload-1', 'harness-upload-2', 'harness-upload-3', 'harness-upload-4', 'harness-upload-5'],
      },
    });
    expect(JSON.stringify(result)).not.toContain('https://');
  });

  it('reports dependency failure counts from the plan', async () => {
    const screen = screenForHarnessMode('modal', 'default', 'failure');
    expect(screen.type).toBe('modal');
    if (screen.type !== 'modal') return;
    const progress = vi.fn();

    const result = await screen.prepare(harnessPlan, progress);

    expect(result).toMatchObject({
      status: 'dependency_failed',
      createdPeople: ['harness-person-1', 'harness-person-2', 'harness-person-3'],
      uploadedAssets: ['harness-upload-1'],
    });
    expect(progress).toHaveBeenCalledWith({ phase: 'people_create', state: 'complete', completed: 3, total: 3 });
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ phase: 'images', state: 'failed', completed: 1, total: 5 }));
  });

  it.each([
    ['search', 'search'],
    ['import', 'import'],
    ['failure', 'failure'],
    ['unknown', null],
    [null, null],
  ] as const)('routes progress=%s to the stable visual progress scenario', (progress, expected) => {
    const url = progress
      ? `http://127.0.0.1:5174/?impeccable=modal&progress=${progress}`
      : 'http://127.0.0.1:5174/?impeccable=modal';

    expect(harnessProgress(url)).toBe(expected);
  });

  it('supports a Dato dark theme mode for sandbox-accurate visual review', () => {
    expect(harnessTheme('http://127.0.0.1:5174/?impeccable=modal&theme=dato-dark')).toBe('dato-dark');
  });

  it('does not activate the standalone visual harness when embedded inside DatoCMS', () => {
    expect(isDevHarnessRequest('http://127.0.0.1:5174/?impeccable=modal', true)).toBe(false);
  });

  it('uses captured DatoCMS dark color values for dato-dark visual review', () => {
    const tokens = harnessDesignTokens('dato-dark');

    expect(tokens['--color--primary--surface']).toBe('oklch(0.3292 0.1714 288)');
    expect(tokens['--color--selected--surface']).toBe('oklch(0.3292 0.1714 288)');
    expect(tokens['--color--selected--border']).toBe('oklch(0.52 0.2 288)');
    expect(tokens['--color--ink-muted']).toBe('oklch(0.385 0.012 288)');
    expect(tokens['--color--surface']).toBe('oklch(0.2028 0.012 288)');
  });

  it('supports an Odyssey existing-values modal scenario', async () => {
    expect(harnessScenario('http://127.0.0.1:5174/?impeccable=modal&scenario=odyssey-existing')).toBe('odyssey-existing');

    const screen = screenForHarnessMode('modal', 'odyssey-existing');
    expect(screen.type).toBe('modal');
    if (screen.type !== 'modal') return;

    await expect(screen.searchMovies({ title: 'The Odyssey', year: 2026 })).resolves.toMatchObject([
      { id: 1368337, title: 'The Odyssey', releaseDate: '2026-07-17' },
    ]);
    await expect(screen.loadMovie(1368337)).resolves.toMatchObject({ tmdbId: 1368337, title: 'The Odyssey' });
    expect(screen.initialTitle).toBe('The Odyssey');
    expect(screen.initialYear).toBe(2026);
    expect(screen.currentValues).toMatchObject({
      title: 'The Odyssey',
      tmdbId: 1368337,
      runtime: 172,
      mpaaRating: 'R',
    });
  });

  it.each([
    ['default', null, true, 'demo_trailer_123'],
    ['trailer-replacement', 'existing-youtube-id', true, 'demo_trailer_123'],
    ['trailer-current', 'demo_trailer_123', true, 'demo_trailer_123'],
    ['trailer-unavailable', 'existing-youtube-id', false, null],
  ] as const)(
    'provides a sanitized %s trailer review scenario',
    async (scenario, currentTrailerId, hasTrailer, firstTrailerId) => {
      const screen = screenForHarnessMode('modal', scenario);
      expect(screen.type).toBe('modal');
      if (screen.type !== 'modal') return;

      const movie = await screen.loadMovie(843);
      const trailerComparison = compareMovieFields(screen.currentValues, movie, screen.mappedFields)
        .find((comparison) => comparison.key === 'trailer');

      expect(screen.mappedFields).toContain('trailer');
      expect(movie.trailers[0]?.externalProviderId ?? null).toBe(firstTrailerId);
      expect(movie.trailers[0]?.watchUrl ?? null).toBe(
        firstTrailerId ? `https://www.youtube.com/watch?v=${firstTrailerId}` : null,
      );
      expect(movie.trailers[0]?.thumbnailUrl ?? null).toSatisfy((value: unknown) => (
        firstTrailerId ? typeof value === 'string' && value.startsWith('data:image/svg+xml,') : value === null
      ));
      expect(movie.trailers[0]?.providerVideoId ?? null).toBe(
        firstTrailerId ? `tmdb-${firstTrailerId}` : null,
      );
      if (currentTrailerId) {
        expect(screen.currentValues.trailer).toMatchObject({
          provider: 'youtube',
          provider_uid: currentTrailerId,
        });
      } else {
        expect(screen.currentValues.trailer).toBeNull();
      }
      expect(trailerComparison).toMatchObject({
        available: hasTrailer,
        changed: false,
        selected: false,
      });
    },
  );

  it.each([
    ['trailer-replacement', 'trailer-replacement'],
    ['trailer-current', 'trailer-current'],
    ['trailer-unavailable', 'trailer-unavailable'],
    ['unknown', 'default'],
    [null, 'default'],
  ] as const)('routes scenario=%s to the stable trailer harness scenario', (scenario, expected) => {
    const url = scenario
      ? `http://127.0.0.1:5174/?impeccable=modal&scenario=${scenario}`
      : 'http://127.0.0.1:5174/?impeccable=modal';

    expect(harnessScenario(url)).toBe(expected);
  });

  it('renders a broken trailer thumbnail fallback without removing the offline decision controls', async () => {
    const screen = screenForHarnessMode('modal', 'default');
    expect(screen.type).toBe('modal');
    if (screen.type !== 'modal') return;

    const movie = await screen.loadMovie(843);
    const comparison = compareMovieFields(screen.currentValues, movie, screen.mappedFields)
      .find((candidate) => candidate.key === 'trailer');

    expect(movie.trailers).not.toHaveLength(0);
    expect(comparison).toBeDefined();

    render(React.createElement(TrailerReview, {
      trailers: movie.trailers,
      selectedTrailer: null,
      comparison: comparison!,
      onSelect: vi.fn(),
    }));

    fireEvent.error(document.querySelector('.movie-import-modal__trailer-thumb') as HTMLImageElement);

    expect(testingScreen.getByText('Preview unavailable')).toBeInTheDocument();
    expect(testingScreen.getByRole('link', { name: 'Preview Official Trailer on YouTube' })).toHaveAttribute(
      'href',
      'https://www.youtube.com/watch?v=demo_trailer_123',
    );
    expect(testingScreen.getByRole('radio', { name: 'Keep trailer empty' })).toBeChecked();
  });

  it('keeps the trailer harness offline with no live TMDB or DatoCMS requests', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValue({ ok: true } as Response);

    const screen = screenForHarnessMode('modal', 'trailer-replacement');
    expect(screen.type).toBe('modal');
    if (screen.type !== 'modal') {
      fetchSpy.mockRestore();
      return;
    }

    const progress = vi.fn();
    const movie = await screen.loadMovie(843);
    await screen.searchMovies({ title: 'Harness movie', year: 2000 });
    if (screen.resolvePeople) {
      await screen.resolvePeople(movie.directors);
    }
    const prepared = await screen.prepare(harnessPlan, progress);
    await screen.resolve(prepared.status === 'success' ? prepared.prepared : null as never);

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('keeps light and captured Dato dark themes available for trailer review', () => {
    expect(harnessTheme('http://127.0.0.1:5174/?impeccable=modal&theme=light')).toBe('light');
    expect(harnessTheme('http://127.0.0.1:5174/?impeccable=modal&theme=dato-dark')).toBe('dato-dark');

    const lightTokens = harnessDesignTokens('light');
    const datoDarkTokens = harnessDesignTokens('dato-dark');

    expect(lightTokens['--color--surface']).toBe('#ffffff');
    expect(lightTokens['--color--selected--border']).toBe('#2f80ed');
    expect(datoDarkTokens['--color--surface']).toBe('oklch(0.2028 0.012 288)');
    expect(datoDarkTokens['--color--primary--surface']).toBe('oklch(0.3292 0.1714 288)');
  });

  it.each(['default', 'odyssey-existing'] as const)(
    'offers twelve unique English posters and backdrops in the %s modal scenario',
    async (scenario) => {
    const screen = screenForHarnessMode('modal', scenario);
    expect(screen.type).toBe('modal');
    if (screen.type !== 'modal') return;

    const movie = await screen.loadMovie(scenario === 'default' ? 843 : 1368337);
    const posters = movie.images.filter((image) => image.type === 'poster');
    const backdrops = movie.images.filter((image) => image.type === 'backdrop');
    const identities = movie.images.map((image) => `${image.providerKey}:${image.providerImageId}`);
    const previewUrls = movie.images.map((image) => image.previewUrl);

    expect(posters).toHaveLength(12);
    expect(backdrops).toHaveLength(12);
    expect(movie.images.every((image) => image.language === 'en')).toBe(true);
    expect(new Set(identities).size).toBe(24);
    expect(new Set(previewUrls).size).toBe(24);
    expect(previewUrls.every((url) => url?.startsWith('data:image/svg+xml,'))).toBe(true);
  });

  it('keeps actual default harness images unselected', async () => {
    const screen = screenForHarnessMode('modal');
    expect(screen.type).toBe('modal');
    if (screen.type !== 'modal') return;

    const movie = await screen.loadMovie(843);
    const selection = defaultImageSelection(
      screen.currentValues,
      movie.images,
      { poster: true, heroImage: true, backdrops: true },
    );

    expect(selection.poster).toBeNull();
    expect(selection.heroImage).toBeNull();
    expect(selection.backdrops).toEqual([]);
  });

  it('keeps provider image identities isolated between movie scenarios', async () => {
    const defaultScreen = screenForHarnessMode('modal', 'default');
    const odysseyScreen = screenForHarnessMode('modal', 'odyssey-existing');
    expect(defaultScreen.type).toBe('modal');
    expect(odysseyScreen.type).toBe('modal');
    if (defaultScreen.type !== 'modal' || odysseyScreen.type !== 'modal') return;

    const [defaultMovie, odysseyMovie] = await Promise.all([
      defaultScreen.loadMovie(843),
      odysseyScreen.loadMovie(1368337),
    ]);
    const defaultIdentities = new Set(defaultMovie.images.map(
      (image) => `${image.providerKey}:${image.providerImageId}`,
    ));
    const overlappingIdentities = odysseyMovie.images
      .map((image) => `${image.providerKey}:${image.providerImageId}`)
      .filter((identity) => defaultIdentities.has(identity));

    expect(overlappingIdentities).toEqual([]);
  });
});
