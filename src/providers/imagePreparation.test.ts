import type { NormalizedImageCandidate } from '../domain/movie';
import type { ImageFingerprintLoader } from './imageFingerprint';
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
  it('filters non-English posters before loading, deduplicates each image type, and returns posters first', async () => {
    const images = [
      candidate('/poster-small.jpg', 'poster', 10, 'en', 100, 150),
      candidate('/poster-large.jpg', 'poster', 40, 'en', 200, 300),
      candidate('/poster-distinct.jpg', 'poster', 20, 'en'),
      candidate('/poster-french.jpg', 'poster', 1, 'fr', 300, 450),
      candidate('/backdrop-small.jpg', 'backdrop', 1, null, 1000, 600),
      candidate('/backdrop-large.jpg', 'backdrop', 3, null, 2000, 1200),
      candidate('/backdrop-distinct.jpg', 'backdrop', 2, null, 1000, 600),
    ];
    const loaded: string[] = [];
    const fingerprints: Record<string, bigint> = {
      '/poster-small.jpg': 1n,
      '/poster-large.jpg': 1n,
      '/poster-distinct.jpg': 15n,
      '/backdrop-small.jpg': 2n,
      '/backdrop-large.jpg': 2n,
      '/backdrop-distinct.jpg': 15n,
    };
    const loadFingerprint: ImageFingerprintLoader = async (image) => {
      loaded.push(image.providerImageId);
      return {
        hash: fingerprints[image.providerImageId],
        aspectRatio: image.type === 'poster' ? 2 / 3 : 5 / 3,
      };
    };

    const result = await prepareSelectableImages(images, loadFingerprint);

    expect(loaded.sort()).toEqual([
      '/backdrop-distinct.jpg',
      '/backdrop-large.jpg',
      '/backdrop-small.jpg',
      '/poster-distinct.jpg',
      '/poster-large.jpg',
      '/poster-small.jpg',
    ]);
    expect(result.map((image) => image.providerImageId)).toEqual([
      '/poster-large.jpg',
      '/poster-distinct.jpg',
      '/backdrop-large.jpg',
      '/backdrop-distinct.jpg',
    ]);
  });
});
