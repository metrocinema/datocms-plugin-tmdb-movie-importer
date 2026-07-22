import type { MovieFieldKey, NormalizedMovie } from './movie';

export type CurrentMovieValues = Partial<Record<MovieFieldKey, unknown>>;

export type FieldComparison = {
  key: MovieFieldKey;
  currentValue: unknown;
  proposedValue: unknown;
  selected: boolean;
  available: boolean;
  changed: boolean;
};

const SCALAR_KEYS: MovieFieldKey[] = ['title', 'yearReleased', 'mpaaRating', 'runtime', 'tmdbId', 'tagline', 'description'];

function proposedValue(movie: NormalizedMovie, key: MovieFieldKey): unknown {
  if (key === 'tmdbId') {
    return movie.tmdbId;
  }

  return movie[key as keyof NormalizedMovie];
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

function valuesMatch(key: MovieFieldKey, currentValue: unknown, nextValue: unknown): boolean {
  if (key === 'tmdbId') {
    return String(currentValue ?? '') === String(nextValue ?? '');
  }

  return JSON.stringify(currentValue ?? null) === JSON.stringify(nextValue ?? null);
}

export function compareMovieFields(current: CurrentMovieValues, movie: NormalizedMovie, mappedFields: MovieFieldKey[]): FieldComparison[] {
  return mappedFields
    .filter((key) => SCALAR_KEYS.includes(key))
    .map((key) => {
      const currentValue = current[key];
      const nextValue = proposedValue(movie, key);
      const available = !isEmpty(nextValue);
      const changed = !valuesMatch(key, currentValue, nextValue);

      return {
        key,
        currentValue,
        proposedValue: nextValue,
        selected: available && changed && isEmpty(currentValue),
        available,
        changed,
      };
    });
}
