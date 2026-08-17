import type { ImportPlan } from '../domain/importPlanning';
import type { MovieFieldKey } from '../domain/movie';
import { isEmptyStructuredText, structuredTextPlainText } from '../domain/structuredText';

export const movieFieldLabels: Record<MovieFieldKey, string> = {
  title: 'Title',
  yearReleased: 'Year released',
  mpaaRating: 'MPAA rating',
  runtime: 'Runtime',
  tmdbId: 'TMDB ID',
  tagline: 'Tagline',
  description: 'Description',
  trailer: 'Trailer',
  poster: 'Poster',
  heroImage: 'Hero image',
  backdrops: 'Other images',
  directors: 'Directors',
  actors: 'Actors',
};

export function formatRuntime(minutes: number | null): string {
  return minutes === null ? 'Not available' : `${minutes} min`;
}

export function formatYear(year: number | null): string {
  return year === null ? 'Unknown year' : String(year);
}

export function formatEmptyValue(value: unknown): string {
  return value === null || value === undefined || value === '' ? 'Empty' : String(value);
}

export function formatReviewValue(key: MovieFieldKey, value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return 'Empty';
  }

  if (key === 'runtime' && typeof value === 'number') {
    return formatRuntime(value);
  }

  if (key === 'yearReleased' && typeof value === 'number') {
    return formatYear(value);
  }

  if (key === 'description') {
    if (isEmptyStructuredText(value)) {
      return 'Empty';
    }

    const structuredText = structuredTextPlainText(value);
    if (structuredText) {
      return structuredText;
    }
  }

  return String(value);
}

export function countConfirmSummary(plan: ImportPlan): {
  fieldChanges: number;
  peopleToCreate: number;
  peopleToReuse: number;
  imagesToUpload: number;
} {
  return {
    fieldChanges: plan.fieldChanges.length,
    peopleToCreate: plan.peopleToCreate.length,
    peopleToReuse: plan.peopleToReuse.length,
    imagesToUpload: plan.assetsToUpload.length,
  };
}
