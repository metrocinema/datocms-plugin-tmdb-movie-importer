import type { CurrentMovieValues } from '../domain/fieldComparison';
import type { MovieFieldKey } from '../domain/movie';

const knownMovieFieldKeys: MovieFieldKey[] = ['title', 'yearReleased', 'mpaaRating', 'runtime', 'tmdbId', 'tagline', 'description', 'poster', 'heroImage', 'backdrops', 'directors', 'actors'];

export function modalMappedFields(parameters: unknown): MovieFieldKey[] {
  const value = readModalParameter(parameters, 'mappedFields');

  return Array.isArray(value) ? value.filter((key): key is MovieFieldKey => typeof key === 'string' && knownMovieFieldKeys.includes(key as MovieFieldKey)) : [];
}

export function modalCurrentValues(parameters: unknown): CurrentMovieValues {
  const value = readModalParameter(parameters, 'currentValues');

  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as CurrentMovieValues : {};
}

export function modalInitialTitle(parameters: unknown) {
  const value = readModalParameter(parameters, 'initialTitle');

  return typeof value === 'string' ? value : '';
}

export function modalInitialYear(parameters: unknown) {
  const value = readModalParameter(parameters, 'initialYear');

  return typeof value === 'number' ? value : null;
}

export function modalInitialTmdbId(parameters: unknown) {
  const value = readModalParameter(parameters, 'initialTmdbId');

  return typeof value === 'number' ? value : null;
}

function readModalParameter(parameters: unknown, key: string) {
  if (typeof parameters !== 'object' || parameters === null || Array.isArray(parameters)) {
    return undefined;
  }

  return (parameters as Record<string, unknown>)[key];
}
