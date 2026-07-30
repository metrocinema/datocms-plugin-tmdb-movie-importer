import { describe, expect, it } from 'vitest';
import { harnessDesignTokens, harnessProgress, harnessScenario, harnessTheme, isDevHarnessRequest, screenForHarnessMode } from './devHarness';
import type { ImportPlan } from './domain/importPlanning';
import type { NormalizedImageCandidate } from './domain/movie';
import { defaultImageSelection } from './providers/imageProvider';

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
  it('uses an import fixture with five unique default-selected assets', async () => {
    const screen = screenForHarnessMode('modal', 'default', 'import');
    expect(screen.type).toBe('modal');
    if (screen.type !== 'modal') return;
    const movie = await screen.loadMovie(843);
    const selection = defaultImageSelection(screen.currentValues, movie.images, {
      poster: true,
      heroImage: true,
      backdrops: true,
    });
    const selectedAssets = [selection.poster, selection.heroImage, ...selection.backdrops]
      .filter((image): image is NormalizedImageCandidate => image !== null);

    expect(new Set(selectedAssets.map((image) => `${image.providerKey}:${image.providerImageId}`)).size).toBe(5);
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

  it('uses actual default harness values to retain selected examples inside and outside the first batch', async () => {
    const screen = screenForHarnessMode('modal');
    expect(screen.type).toBe('modal');
    if (screen.type !== 'modal') return;

    const movie = await screen.loadMovie(843);
    const posters = movie.images.filter((image) => image.type === 'poster');
    const backdrops = movie.images.filter((image) => image.type === 'backdrop');
    const selection = defaultImageSelection(
      screen.currentValues,
      movie.images,
      { poster: true, heroImage: true, backdrops: true },
    );

    expect(posters.slice(0, 10)).not.toContain(selection.poster);
    expect(backdrops.slice(0, 10)).toContain(selection.backdrops[0]);
    expect(backdrops.slice(0, 10)).not.toContain(selection.heroImage);
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
