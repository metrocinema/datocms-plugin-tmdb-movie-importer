import type { NormalizedImageCandidate } from '../domain/movie';
import type { ImageFingerprint, ImageFingerprintLoader } from './imageFingerprint';
import { deduplicateImageCandidates } from './imageDeduplication';
import { defaultImageSelection } from './imageProvider';

function candidate(
  providerImageId: string,
  type: NormalizedImageCandidate['type'],
  rank: number,
  width: number | null = 1920,
  height: number | null = 1080,
  providerKey = 'tmdb',
): NormalizedImageCandidate {
  return {
    providerKey,
    providerImageId,
    movieIdentity: { providerKey: 'tmdb', tmdbId: 1 },
    type,
    originalUrl: `https://images.example${providerImageId}`,
    width,
    height,
    language: null,
    rank,
    attribution: 'Example Images',
  };
}

function fingerprintLoader(
  fingerprints: Record<string, ImageFingerprint>,
): ImageFingerprintLoader {
  return async (image) => {
    const fingerprint = fingerprints[image.providerImageId];
    if (!fingerprint) {
      throw new Error(`Missing fingerprint for ${image.providerImageId}`);
    }
    return fingerprint;
  };
}

describe('deduplicateImageCandidates', () => {
  it('keeps the highest-resolution duplicate at the best group rank', async () => {
    const rankedSmall = candidate('/small.jpg', 'backdrop', 1, 1280, 720);
    const lowerRankedLarge = candidate('/large.jpg', 'backdrop', 9, 3840, 2160);
    const distinct = candidate('/distinct.jpg', 'backdrop', 2, 1920, 1080);

    const result = await deduplicateImageCandidates(
      [rankedSmall, distinct, lowerRankedLarge],
      fingerprintLoader({
        '/small.jpg': { hash: 0b1010n, aspectRatio: 16 / 9 },
        '/large.jpg': { hash: 0b1010n, aspectRatio: 16 / 9 },
        '/distinct.jpg': { hash: 0b11110000n, aspectRatio: 16 / 9 },
      }),
    );

    expect(result.map((image) => image.providerImageId))
      .toEqual(['/large.jpg', '/distinct.jpg']);
    expect(result[0]?.rank).toBe(1);

    const selection = defaultImageSelection(
      { heroImage: null, backdrops: [] },
      result,
      { poster: false, heroImage: true, backdrops: true },
    );
    expect(selection.heroImage?.providerImageId).toBe('/large.jpg');
  });

  it('never groups posters with backdrops', async () => {
    const result = await deduplicateImageCandidates(
      [candidate('/poster.jpg', 'poster', 1), candidate('/backdrop.jpg', 'backdrop', 2)],
      fingerprintLoader({
        '/poster.jpg': { hash: 0b1010n, aspectRatio: 16 / 9 },
        '/backdrop.jpg': { hash: 0b1010n, aspectRatio: 16 / 9 },
      }),
    );

    expect(result.map((image) => image.providerImageId)).toEqual(['/poster.jpg', '/backdrop.jpg']);
  });

  it('keeps images whose aspect ratios differ by more than one percent', async () => {
    const result = await deduplicateImageCandidates(
      [candidate('/wide.jpg', 'backdrop', 1), candidate('/taller.jpg', 'backdrop', 2)],
      fingerprintLoader({
        '/wide.jpg': { hash: 0b1010n, aspectRatio: 1 },
        '/taller.jpg': { hash: 0b1010n, aspectRatio: 1.011 },
      }),
    );

    expect(result.map((image) => image.providerImageId)).toEqual(['/wide.jpg', '/taller.jpg']);
  });

  it('groups a Hamming distance of two but not three', async () => {
    const result = await deduplicateImageCandidates(
      [
        candidate('/anchor.jpg', 'backdrop', 1),
        candidate('/near.jpg', 'backdrop', 2),
        candidate('/far.jpg', 'backdrop', 3),
      ],
      fingerprintLoader({
        '/anchor.jpg': { hash: 0b0000n, aspectRatio: 16 / 9 },
        '/near.jpg': { hash: 0b0011n, aspectRatio: 16 / 9 },
        '/far.jpg': { hash: 0b0111n, aspectRatio: 16 / 9 },
      }),
    );

    expect(result.map((image) => image.providerImageId)).toEqual(['/anchor.jpg', '/far.jpg']);
  });

  it('breaks equal-area duplicate ties by rank then provider identity', async () => {
    const result = await deduplicateImageCandidates(
      [
        candidate('/zeta.jpg', 'backdrop', 1, 100, 100, 'zeta'),
        candidate('/alpha.jpg', 'backdrop', 1, 100, 100, 'alpha'),
        candidate('/lower-rank.jpg', 'backdrop', 2, 100, 100, 'tmdb'),
      ],
      fingerprintLoader({
        '/zeta.jpg': { hash: 0b1010n, aspectRatio: 1 },
        '/alpha.jpg': { hash: 0b1010n, aspectRatio: 1 },
        '/lower-rank.jpg': { hash: 0b1010n, aspectRatio: 1 },
      }),
    );

    expect(result.map((image) => `${image.providerKey}:${image.providerImageId}`))
      .toEqual(['alpha:/alpha.jpg']);
  });

  it('keeps candidates whose fingerprints cannot be loaded', async () => {
    const result = await deduplicateImageCandidates(
      [candidate('/working.jpg', 'backdrop', 1), candidate('/unavailable.jpg', 'backdrop', 2)],
      fingerprintLoader({
        '/working.jpg': { hash: 0b1010n, aspectRatio: 16 / 9 },
      }),
    );

    expect(result.map((image) => image.providerImageId))
      .toEqual(['/working.jpg', '/unavailable.jpg']);
  });

  it('runs no more than four fingerprint loads at once', async () => {
    const images = Array.from({ length: 5 }, (_, index) =>
      candidate(`/image-${index}.jpg`, 'backdrop', index + 1),
    );
    let active = 0;
    let maximumActive = 0;
    let releaseLoad: (() => void) | undefined;
    const allLoadsReleased = new Promise<void>((resolve) => {
      releaseLoad = resolve;
    });

    const resultPromise = deduplicateImageCandidates(images, async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await allLoadsReleased;
      active -= 1;
      return { hash: 0b1010n, aspectRatio: 16 / 9 };
    });

    await Promise.resolve();
    expect(maximumActive).toBe(4);
    releaseLoad?.();
    await resultPromise;
  });

  it('caps caller-provided fingerprint concurrency at four', async () => {
    const images = Array.from({ length: 6 }, (_, index) =>
      candidate(`/override-${index}.jpg`, 'backdrop', index + 1),
    );
    let active = 0;
    let maximumActive = 0;
    let releaseLoad: (() => void) | undefined;
    const allLoadsReleased = new Promise<void>((resolve) => {
      releaseLoad = resolve;
    });

    const resultPromise = deduplicateImageCandidates(images, async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await allLoadsReleased;
      active -= 1;
      return { hash: 0b1010n, aspectRatio: 16 / 9 };
    }, 5);

    await Promise.resolve();
    expect(maximumActive).toBe(4);
    releaseLoad?.();
    await resultPromise;
  });

  it('orders groups deterministically when input order changes', async () => {
    const first = candidate('/first.jpg', 'backdrop', 1);
    const second = candidate('/second.jpg', 'backdrop', 2);
    const duplicateOfFirst = candidate('/first-duplicate.jpg', 'backdrop', 3, 3840, 2160);
    const loadFingerprint = fingerprintLoader({
      '/first.jpg': { hash: 0b1010n, aspectRatio: 16 / 9 },
      '/second.jpg': { hash: 0b11110000n, aspectRatio: 16 / 9 },
      '/first-duplicate.jpg': { hash: 0b1010n, aspectRatio: 16 / 9 },
    });

    const ordered = await deduplicateImageCandidates(
      [first, second, duplicateOfFirst],
      loadFingerprint,
    );
    const shuffled = await deduplicateImageCandidates(
      [duplicateOfFirst, second, first],
      loadFingerprint,
    );

    expect(shuffled.map((image) => image.providerImageId))
      .toEqual(ordered.map((image) => image.providerImageId));
  });
});
