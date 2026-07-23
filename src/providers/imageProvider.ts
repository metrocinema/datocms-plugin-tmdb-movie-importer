import type { CurrentMovieValues } from '../domain/fieldComparison';
import type { NormalizedImageCandidate } from '../domain/movie';

export type ImageSelection = {
  poster: NormalizedImageCandidate | null;
  heroImage: NormalizedImageCandidate | null;
  backdrops: NormalizedImageCandidate[];
};

export type ImageProvider = {
  key: string;
  findImages(tmdbId: number): Promise<NormalizedImageCandidate[]>;
};

export function isEnglishPoster(image: NormalizedImageCandidate): boolean {
  return image.type === 'poster' && image.language === 'en';
}

function ranked(images: NormalizedImageCandidate[], type: 'poster' | 'backdrop'): NormalizedImageCandidate[] {
  return images.filter((image) => image.type === type).sort((a, b) => a.rank - b.rank);
}

export function defaultImageSelection(current: CurrentMovieValues, images: NormalizedImageCandidate[]): ImageSelection {
  const posterEmpty = current.poster === null || current.poster === undefined || current.poster === '';
  const heroImageEmpty = current.heroImage === null || current.heroImage === undefined || current.heroImage === '';
  const backdropsEmpty = !Array.isArray(current.backdrops) || current.backdrops.length === 0;
  const rankedBackdrops = ranked(images, 'backdrop');

  return {
    poster: posterEmpty ? ranked(images, 'poster').find(isEnglishPoster) ?? null : null,
    heroImage: heroImageEmpty ? rankedBackdrops[0] ?? null : null,
    backdrops: backdropsEmpty ? rankedBackdrops.slice(0, 5) : [],
  };
}
