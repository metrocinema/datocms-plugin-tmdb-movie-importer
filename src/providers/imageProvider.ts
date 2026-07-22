import type { CurrentMovieValues } from '../domain/fieldComparison';
import type { NormalizedImageCandidate } from '../domain/movie';

export type ImageSelection = {
  poster: NormalizedImageCandidate | null;
  backdrops: NormalizedImageCandidate[];
};

export type ImageProvider = {
  key: string;
  findImages(tmdbId: number): Promise<NormalizedImageCandidate[]>;
};

function ranked(images: NormalizedImageCandidate[], type: 'poster' | 'backdrop'): NormalizedImageCandidate[] {
  return images.filter((image) => image.type === type).sort((a, b) => a.rank - b.rank);
}

export function defaultImageSelection(current: CurrentMovieValues, images: NormalizedImageCandidate[]): ImageSelection {
  const posterEmpty = current.poster === null || current.poster === undefined || current.poster === '';
  const backdropsEmpty = !Array.isArray(current.backdrops) || current.backdrops.length === 0;

  return {
    poster: posterEmpty ? ranked(images, 'poster')[0] ?? null : null,
    backdrops: backdropsEmpty ? ranked(images, 'backdrop').slice(0, 5) : [],
  };
}
