import type { NormalizedImageCandidate } from '../domain/movie';
import { prepareSelectableImages } from './imagePreparation';

function candidate(
  providerImageId: string,
  type: NormalizedImageCandidate['type'],
  rank: number,
  language: string | null,
  width = 100,
  height = 150,
): NormalizedImageCandidate {
  return {
    providerKey: 'tmdb',
    providerImageId,
    movieIdentity: { providerKey: 'tmdb', tmdbId: 1 },
    type,
    originalUrl: `https://images.example${providerImageId}`,
    width,
    height,
    language,
    rank,
    attribution: 'TMDB',
  };
}

describe('prepareSelectableImages', () => {
  it('filters non-English posters and keeps posters TMDB-ranked first', async () => {
    const images = [
      candidate('/poster-top-ranked.jpg', 'poster', 1, 'en', 100, 150),
      candidate('/poster-largest.jpg', 'poster', 40, 'en', 200, 300),
      candidate('/poster-medium.jpg', 'poster', 20, 'en', 150, 225),
      candidate('/poster-french-largest.jpg', 'poster', 1, 'fr', 300, 450),
      candidate('/backdrop-top-ranked.jpg', 'backdrop', 1, null, 1000, 600),
      candidate('/backdrop-largest.jpg', 'backdrop', 30, null, 2000, 1200),
      candidate('/backdrop-medium.jpg', 'backdrop', 2, null, 1500, 900),
    ];
    const result = await prepareSelectableImages(images);

    expect(result.map((image) => image.providerImageId)).toEqual([
      '/poster-top-ranked.jpg',
      '/poster-medium.jpg',
      '/poster-largest.jpg',
      '/backdrop-top-ranked.jpg',
      '/backdrop-medium.jpg',
      '/backdrop-largest.jpg',
    ]);
  });

  it('prioritizes 3840x2160 backdrops before TMDB rank', async () => {
    const images = [
      candidate('/poster-top-ranked.jpg', 'poster', 1, 'en', 100, 150),
      candidate('/backdrop-ranked-first.jpg', 'backdrop', 1, null, 1920, 1080),
      candidate('/backdrop-4k-later-rank.jpg', 'backdrop', 30, null, 3840, 2160),
      candidate('/backdrop-4k-better-rank.jpg', 'backdrop', 2, null, 3840, 2160),
      candidate('/backdrop-non-4k-next-rank.jpg', 'backdrop', 3, null, 2000, 1200),
    ];
    const result = await prepareSelectableImages(images);

    expect(result.map((image) => image.providerImageId)).toEqual([
      '/poster-top-ranked.jpg',
      '/backdrop-4k-better-rank.jpg',
      '/backdrop-4k-later-rank.jpg',
      '/backdrop-ranked-first.jpg',
      '/backdrop-non-4k-next-rank.jpg',
    ]);
  });

  it('uses higher resolution and stable identity as tie-breakers when TMDB rank matches', async () => {
    const images = [
      candidate('/poster-small.jpg', 'poster', 1, 'en', 100, 150),
      candidate('/poster-large.jpg', 'poster', 1, 'en', 200, 300),
      candidate('/backdrop-z.jpg', 'backdrop', 4, null, 1920, 1080),
      candidate('/backdrop-y.jpg', 'backdrop', 4, null, 1920, 1080),
      candidate('/backdrop-large.jpg', 'backdrop', 4, null, 3840, 2160),
    ];
    const result = await prepareSelectableImages(images);

    expect(result.map((image) => image.providerImageId)).toEqual([
      '/poster-large.jpg',
      '/poster-small.jpg',
      '/backdrop-large.jpg',
      '/backdrop-y.jpg',
      '/backdrop-z.jpg',
    ]);
  });
});
