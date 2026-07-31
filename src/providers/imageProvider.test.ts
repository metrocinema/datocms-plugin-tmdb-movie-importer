import {
  defaultImageSelection,
  selectHeroImage,
  toggleOtherImage,
} from './imageProvider';
import type { NormalizedImageCandidate } from '../domain/movie';

const images: NormalizedImageCandidate[] = [
  { providerKey: 'tmdb', providerImageId: '/poster.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'poster', originalUrl: 'https://image.tmdb.org/t/p/original/poster.jpg', width: 100, height: 150, language: 'en', rank: 1, attribution: 'TMDB' },
  { providerKey: 'tmdb', providerImageId: '/textless-poster.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'poster', originalUrl: 'https://image.tmdb.org/t/p/original/textless-poster.jpg', width: 100, height: 150, language: null, rank: 2, attribution: 'TMDB' },
  { providerKey: 'tmdb', providerImageId: '/backdrop-1.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'backdrop', originalUrl: 'https://image.tmdb.org/t/p/original/backdrop-1.jpg', width: 300, height: 150, language: null, rank: 1, attribution: 'TMDB' },
  { providerKey: 'tmdb', providerImageId: '/backdrop-2.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'backdrop', originalUrl: 'https://image.tmdb.org/t/p/original/backdrop-2.jpg', width: 300, height: 150, language: null, rank: 2, attribution: 'TMDB' },
  { providerKey: 'tmdb', providerImageId: '/backdrop-3.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'backdrop', originalUrl: 'https://image.tmdb.org/t/p/original/backdrop-3.jpg', width: 300, height: 150, language: null, rank: 3, attribution: 'TMDB' },
  { providerKey: 'tmdb', providerImageId: '/backdrop-4.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'backdrop', originalUrl: 'https://image.tmdb.org/t/p/original/backdrop-4.jpg', width: 300, height: 150, language: null, rank: 4, attribution: 'TMDB' },
  { providerKey: 'tmdb', providerImageId: '/backdrop-5.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'backdrop', originalUrl: 'https://image.tmdb.org/t/p/original/backdrop-5.jpg', width: 300, height: 150, language: null, rank: 5, attribution: 'TMDB' },
  { providerKey: 'tmdb', providerImageId: '/backdrop-6.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'backdrop', originalUrl: 'https://image.tmdb.org/t/p/original/backdrop-6.jpg', width: 300, height: 150, language: null, rank: 6, attribution: 'TMDB' },
  { providerKey: 'tmdb', providerImageId: '/backdrop-7.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'backdrop', originalUrl: 'https://image.tmdb.org/t/p/original/backdrop-7.jpg', width: 300, height: 150, language: null, rank: 7, attribution: 'TMDB' },
];

const allDestinationsAvailable = { poster: true, heroImage: true, backdrops: true };

describe('defaultImageSelection', () => {
  it('preselects poster and top backdrops when destinations are empty', () => {
    const selection = defaultImageSelection(
      { poster: null, backdrops: [] },
      images,
      allDestinationsAvailable,
    );

    expect(selection.poster?.providerImageId).toBe('/poster.jpg');
    expect(selection.heroImage?.providerImageId).toBe('/backdrop-1.jpg');
    expect(selection.backdrops.map((image) => image.providerImageId)).toEqual([
      '/backdrop-2.jpg',
      '/backdrop-3.jpg',
      '/backdrop-4.jpg',
      '/backdrop-5.jpg',
      '/backdrop-6.jpg',
    ]);
  });

  it('does not preselect replacements when destinations are populated', () => {
    const selection = defaultImageSelection(
      { poster: 'asset-1', heroImage: 'asset-hero', backdrops: ['asset-2'] },
      images,
      allDestinationsAvailable,
    );

    expect(selection.poster).toBeNull();
    expect(selection.heroImage).toBeNull();
    expect(selection.backdrops).toEqual([]);
  });

  it('only preselects English-language posters', () => {
    const selection = defaultImageSelection({ poster: null }, [
      { providerKey: 'tmdb', providerImageId: '/textless-poster.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'poster', originalUrl: 'https://image.tmdb.org/t/p/original/textless-poster.jpg', width: 100, height: 150, language: null, rank: 1, attribution: 'TMDB' },
      { providerKey: 'tmdb', providerImageId: '/english-poster.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'poster', originalUrl: 'https://image.tmdb.org/t/p/original/english-poster.jpg', width: 100, height: 150, language: 'en', rank: 2, attribution: 'TMDB' },
    ], allDestinationsAvailable);

    expect(selection.poster?.providerImageId).toBe('/english-poster.jpg');
  });

  it('preselects at most the five highest-ranked backdrops', () => {
    const backdrops: NormalizedImageCandidate[] = Array.from({ length: 7 }, (_, index) => ({
      providerKey: 'tmdb',
      providerImageId: `/backdrop-${index + 1}.jpg`,
      movieIdentity: { providerKey: 'tmdb', tmdbId: 1 },
      type: 'backdrop',
      originalUrl: `https://image.tmdb.org/t/p/original/backdrop-${index + 1}.jpg`,
      width: 300,
      height: 150,
      language: null,
      rank: index + 1,
      attribution: 'TMDB',
    }));

    const selection = defaultImageSelection({ backdrops: [] }, backdrops, allDestinationsAvailable);

    expect(selection.backdrops.map((image) => image.providerImageId)).toEqual([
      '/backdrop-2.jpg',
      '/backdrop-3.jpg',
      '/backdrop-4.jpg',
      '/backdrop-5.jpg',
      '/backdrop-6.jpg',
    ]);
  });

  it('uses higher resolution and stable identity as default-selection tie-breakers when rank matches', () => {
    const equalRankImages: NormalizedImageCandidate[] = [
      { providerKey: 'tmdb', providerImageId: '/poster-small.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'poster', originalUrl: 'https://image.tmdb.org/t/p/original/poster-small.jpg', width: 100, height: 150, language: 'en', rank: 1, attribution: 'TMDB' },
      { providerKey: 'tmdb', providerImageId: '/poster-large.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'poster', originalUrl: 'https://image.tmdb.org/t/p/original/poster-large.jpg', width: 200, height: 300, language: 'en', rank: 1, attribution: 'TMDB' },
      { providerKey: 'tmdb', providerImageId: '/backdrop-z.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'backdrop', originalUrl: 'https://image.tmdb.org/t/p/original/backdrop-z.jpg', width: 1920, height: 1080, language: null, rank: 1, attribution: 'TMDB' },
      { providerKey: 'tmdb', providerImageId: '/backdrop-y.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'backdrop', originalUrl: 'https://image.tmdb.org/t/p/original/backdrop-y.jpg', width: 1920, height: 1080, language: null, rank: 1, attribution: 'TMDB' },
      { providerKey: 'tmdb', providerImageId: '/backdrop-large.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'backdrop', originalUrl: 'https://image.tmdb.org/t/p/original/backdrop-large.jpg', width: 3840, height: 2160, language: null, rank: 1, attribution: 'TMDB' },
    ];

    const selection = defaultImageSelection(
      { poster: null, heroImage: null, backdrops: [] },
      equalRankImages,
      allDestinationsAvailable,
    );

    expect(selection.poster?.providerImageId).toBe('/poster-large.jpg');
    expect(selection.heroImage?.providerImageId).toBe('/backdrop-large.jpg');
    expect(selection.backdrops.map((image) => image.providerImageId)).toEqual([
      '/backdrop-y.jpg',
      '/backdrop-z.jpg',
    ]);
  });

  it('only defaults destinations that are available and unmapped', () => {
    const selection = defaultImageSelection(
      { poster: null, heroImage: null, backdrops: [] },
      images,
      { poster: false, heroImage: false, backdrops: true },
    );

    expect(selection.poster).toBeNull();
    expect(selection.heroImage).toBeNull();
    expect(selection.backdrops[0]?.providerImageId).toBe('/backdrop-1.jpg');
  });
});

describe('image selection transitions', () => {
  const first = images[2]!;
  const second = images[3]!;

  it('assigning Hero removes that image from Other Images', () => {
    const heroResult = selectHeroImage(
      { poster: null, heroImage: null, backdrops: [first, second] },
      first,
    );

    expect(heroResult).toEqual({
      poster: null,
      heroImage: first,
      backdrops: [second],
    });
  });

  it('moving Hero preserves unrelated Other Images', () => {
    const result = selectHeroImage(
      { poster: null, heroImage: first, backdrops: [second] },
      images[4]!,
    );

    expect(result.backdrops).toEqual([second]);
  });

  it('adding the current Hero to Other Images clears Hero', () => {
    const otherResult = toggleOtherImage(
      { poster: null, heroImage: first, backdrops: [] },
      first,
    );

    expect(otherResult).toEqual({
      poster: null,
      heroImage: null,
      backdrops: [first],
    });
  });

  it('unchecking Other Images does not affect Hero', () => {
    const result = toggleOtherImage(
      { poster: null, heroImage: first, backdrops: [second] },
      second,
    );

    expect(result).toEqual({ poster: null, heroImage: first, backdrops: [] });
  });

  it('clearing Hero preserves Other Images', () => {
    const result = selectHeroImage(
      { poster: null, heroImage: first, backdrops: [second] },
      null,
    );

    expect(result).toEqual({ poster: null, heroImage: null, backdrops: [second] });
  });

  it('uses provider key and provider image ID as image identity', () => {
    const matchingIdFromAnotherProvider = {
      ...first,
      providerKey: 'other-provider',
    };

    const result = selectHeroImage(
      { poster: null, heroImage: null, backdrops: [first, matchingIdFromAnotherProvider] },
      first,
    );

    expect(result.backdrops).toEqual([matchingIdFromAnotherProvider]);
  });
});
