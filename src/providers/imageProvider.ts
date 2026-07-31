import type { CurrentMovieValues } from '../domain/fieldComparison';
import type { NormalizedImageCandidate } from '../domain/movie';
import { compareRankResolutionThenIdentity } from './imageOrdering';

export type ImageSelection = {
  poster: NormalizedImageCandidate | null;
  heroImage: NormalizedImageCandidate | null;
  backdrops: NormalizedImageCandidate[];
};

export type ImageDestinationAvailability = {
  poster: boolean;
  heroImage: boolean;
  backdrops: boolean;
};

export type ImageProvider = {
  key: string;
  findImages(tmdbId: number): Promise<NormalizedImageCandidate[]>;
};

export function isEnglishPoster(image: NormalizedImageCandidate): boolean {
  return image.type === 'poster' && image.language === 'en';
}

function ranked(images: NormalizedImageCandidate[], type: 'poster' | 'backdrop'): NormalizedImageCandidate[] {
  return images
    .filter((image) => image.type === type)
    .sort(compareRankResolutionThenIdentity);
}

export function sameImage(
  first: NormalizedImageCandidate,
  second: NormalizedImageCandidate,
): boolean {
  return first.providerKey === second.providerKey
    && first.providerImageId === second.providerImageId;
}

export function defaultImageSelection(
  current: CurrentMovieValues,
  images: NormalizedImageCandidate[],
  availability: ImageDestinationAvailability,
): ImageSelection {
  const posterEmpty = current.poster === null || current.poster === undefined || current.poster === '';
  const heroImageEmpty = current.heroImage === null || current.heroImage === undefined || current.heroImage === '';
  const backdropsEmpty = !Array.isArray(current.backdrops) || current.backdrops.length === 0;
  const rankedBackdrops = ranked(images, 'backdrop');
  const heroImage = availability.heroImage && heroImageEmpty
    ? rankedBackdrops[0] ?? null
    : null;
  const otherCandidates = heroImage
    ? rankedBackdrops.filter((candidate) => !sameImage(candidate, heroImage))
    : rankedBackdrops;

  return {
    poster: availability.poster && posterEmpty
      ? ranked(images, 'poster').find(isEnglishPoster) ?? null
      : null,
    heroImage,
    backdrops: availability.backdrops && backdropsEmpty ? otherCandidates.slice(0, 5) : [],
  };
}

export function selectHeroImage(
  selection: ImageSelection,
  image: NormalizedImageCandidate | null,
): ImageSelection {
  return {
    ...selection,
    heroImage: image,
    backdrops: image
      ? selection.backdrops.filter((candidate) => !sameImage(candidate, image))
      : [...selection.backdrops],
  };
}

export function toggleOtherImage(
  selection: ImageSelection,
  image: NormalizedImageCandidate,
): ImageSelection {
  const alreadySelected = selection.backdrops.some((candidate) =>
    sameImage(candidate, image),
  );

  return {
    ...selection,
    heroImage: !alreadySelected && selection.heroImage
      && sameImage(selection.heroImage, image)
      ? null
      : selection.heroImage,
    backdrops: alreadySelected
      ? selection.backdrops.filter((candidate) => !sameImage(candidate, image))
      : [...selection.backdrops, image],
  };
}
