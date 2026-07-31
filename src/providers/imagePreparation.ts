import type { NormalizedImageCandidate } from '../domain/movie';
import { compareRankResolutionThenIdentity } from './imageOrdering';

function isEnglishPoster(image: NormalizedImageCandidate) {
  return image.type === 'poster' && image.language === 'en';
}

export async function prepareSelectableImages(
  images: NormalizedImageCandidate[],
): Promise<NormalizedImageCandidate[]> {
  const englishPosters = images
    .filter(isEnglishPoster)
    .sort(compareRankResolutionThenIdentity);
  const backdrops = images
    .filter((image) => image.type === 'backdrop')
    .sort(compareRankResolutionThenIdentity);

  return [...englishPosters, ...backdrops];
}
