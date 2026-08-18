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
  trailers: number;
  peopleToCreate: number;
  peopleToReuse: number;
  imagesToUpload: number;
} {
  const trailers = plan.fieldChanges.some((change) => change.key === 'trailer') ? 1 : 0;

  return {
    fieldChanges: plan.fieldChanges.filter((change) => change.key !== 'trailer').length,
    trailers,
    peopleToCreate: uniquePeopleToCreate(plan.peopleToCreate).length,
    peopleToReuse: plan.peopleToReuse.length,
    imagesToUpload: plan.assetsToUpload.length,
  };
}

export function uniquePeopleToCreate<T extends { candidateTmdbId: number; source: 'auto' | 'manual' }>(people: T[]): T[] {
  const automaticTmdbIds = new Set<number>();

  return people.filter((person) => {
    if (person.source === 'manual') return true;
    if (automaticTmdbIds.has(person.candidateTmdbId)) return false;

    automaticTmdbIds.add(person.candidateTmdbId);
    return true;
  });
}

export function formatImpactSegments(summary: {
  fieldChanges: number;
  trailers: number;
  peopleToCreate: number;
  peopleToReuse: number;
  imagesToUpload: number;
}) {
  return [
    `${summary.fieldChanges} ${pluralize(summary.fieldChanges, 'field')}`,
    summary.trailers > 0
      ? `${summary.trailers} ${pluralize(summary.trailers, 'trailer replacement')}`
      : null,
    `${summary.imagesToUpload} ${pluralize(summary.imagesToUpload, 'image')}`,
    `${summary.peopleToCreate} new ${pluralize(summary.peopleToCreate, 'person', 'people')}`,
    `${summary.peopleToReuse} reused ${pluralize(summary.peopleToReuse, 'person', 'people')}`,
  ].filter((segment): segment is string => segment !== null);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}
