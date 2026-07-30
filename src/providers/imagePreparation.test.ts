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

  it('starts poster and backdrop preparation concurrently while capping fingerprint loading at four', async () => {
    const images = [
      ...Array.from({ length: 5 }, (_, index) =>
        candidate(`/poster-${index}.jpg`, 'poster', index, 'en'),
      ),
      ...Array.from({ length: 5 }, (_, index) =>
        candidate(`/backdrop-${index}.jpg`, 'backdrop', index, null),
      ),
    ];
    let active = 0;
    let maximumActive = 0;
    let releaseAll = false;
    const releaseBlockedLoads: (() => void)[] = [];
    const startedTypes: NormalizedImageCandidate['type'][] = [];
    const loadFingerprint: ImageFingerprintLoader = async (image) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      startedTypes.push(image.type);
      if (!releaseAll) {
        await new Promise<void>((resolve) => {
          releaseBlockedLoads.push(resolve);
        });
      }
      active -= 1;
      return { hash: 1n, aspectRatio: 1 };
    };
    const prepared = prepareSelectableImages(images, loadFingerprint);

    try {
      await vi.waitFor(() => {
        expect(releaseBlockedLoads).toHaveLength(4);
      });
      expect(maximumActive).toBe(4);
      releaseBlockedLoads.shift()?.();
      await vi.waitFor(() => {
        expect(startedTypes).toContain('poster');
        expect(startedTypes).toContain('backdrop');
      });
      expect(maximumActive).toBe(4);
    } finally {
      releaseAll = true;
      releaseBlockedLoads.splice(0).forEach((release) => release());
      await prepared;
    }
  });
});
