import type { CurrentMovieValues } from '../domain/fieldComparison';
import type { NormalizedImageCandidate } from '../domain/movie';

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

export function sameImage(
  first: NormalizedImageCandidate,
  second: NormalizedImageCandidate,
): boolean {
  return first.providerKey === second.providerKey
    && first.providerImageId === second.providerImageId;
}

export function defaultImageSelection(
  _current: CurrentMovieValues,
  _images: NormalizedImageCandidate[],
  _availability: ImageDestinationAvailability,
): ImageSelection {
  return {
    poster: null,
    heroImage: null,
    backdrops: [],
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
