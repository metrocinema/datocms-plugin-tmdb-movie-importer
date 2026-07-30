import type { NormalizedImageCandidate } from '../domain/movie';
import { loadBrowserImageFingerprint } from './browserImageFingerprint';
import { deduplicateImageCandidates } from './imageDeduplication';
import type { ImageFingerprintLoader } from './imageFingerprint';

function isEnglishPoster(image: NormalizedImageCandidate) {
  return image.type === 'poster' && image.language === 'en';
}

export async function prepareSelectableImages(
  images: NormalizedImageCandidate[],
  loadFingerprint: ImageFingerprintLoader = loadBrowserImageFingerprint,
): Promise<NormalizedImageCandidate[]> {
  const englishPosters = images.filter(isEnglishPoster);
  const backdrops = images.filter((image) => image.type === 'backdrop');
  const [uniquePosters, uniqueBackdrops] = await Promise.all([
    deduplicateImageCandidates(englishPosters, loadFingerprint),
    deduplicateImageCandidates(backdrops, loadFingerprint),
  ]);

  return [...uniquePosters, ...uniqueBackdrops];
}
