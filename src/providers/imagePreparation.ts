import type { NormalizedImageCandidate } from '../domain/movie';
import { loadBrowserImageFingerprint } from './browserImageFingerprint';
import { deduplicateImageCandidates } from './imageDeduplication';
import type { ImageFingerprintLoader } from './imageFingerprint';

const MAX_ACTIVE_FINGERPRINT_LOADS = 4;

function isEnglishPoster(image: NormalizedImageCandidate) {
  return image.type === 'poster' && image.language === 'en';
}

function limitFingerprintLoading(
  loadFingerprint: ImageFingerprintLoader,
): ImageFingerprintLoader {
  let availableSlots = MAX_ACTIVE_FINGERPRINT_LOADS;
  const waiters: (() => void)[] = [];

  async function acquireSlot() {
    if (availableSlots > 0) {
      availableSlots -= 1;
      return;
    }

    await new Promise<void>((resolve) => {
      waiters.push(resolve);
    });
  }

  function releaseSlot() {
    const nextWaiter = waiters.shift();
    if (nextWaiter) {
      nextWaiter();
    } else {
      availableSlots += 1;
    }
  }

  return async (image) => {
    await acquireSlot();
    try {
      return await loadFingerprint(image);
    } finally {
      releaseSlot();
    }
  };
}

export async function prepareSelectableImages(
  images: NormalizedImageCandidate[],
  loadFingerprint: ImageFingerprintLoader = loadBrowserImageFingerprint,
): Promise<NormalizedImageCandidate[]> {
  const englishPosters = images.filter(isEnglishPoster);
  const backdrops = images.filter((image) => image.type === 'backdrop');
  const limitedLoadFingerprint = limitFingerprintLoading(loadFingerprint);
  const [uniquePosters, uniqueBackdrops] = await Promise.all([
    deduplicateImageCandidates(englishPosters, limitedLoadFingerprint),
    deduplicateImageCandidates(backdrops, limitedLoadFingerprint),
  ]);

  return [...uniquePosters, ...uniqueBackdrops];
}
