import type { PreparedImport } from '../dato/importExecutor';
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

export function isPreparedImport(value: unknown): value is PreparedImport {
  if (!isRecord(value)) return false;
  const candidate = value;

  if (!(
    Array.isArray(candidate.fieldChanges) &&
    Array.isArray(candidate.directors) &&
    Array.isArray(candidate.actors) &&
    Array.isArray(candidate.people) &&
    Array.isArray(candidate.images) &&
    Array.isArray(candidate.otherImages) &&
    Array.isArray(candidate.createdPeople) &&
    Array.isArray(candidate.uploadedAssets)
  )) {
    return false;
  }

  return (
    candidate.fieldChanges.every(isPreparedFieldChange) &&
    candidate.directors.every((person) => isPreparedPersonCandidate(person, 'director')) &&
    candidate.actors.every((person) => isPreparedPersonCandidate(person, 'actor')) &&
    candidate.people.every(isPreparedPersonReference) &&
    candidate.images.every(isPreparedImageReference) &&
    (candidate.heroImage === null || isPreparedImageIdentity(candidate.heroImage)) &&
    candidate.otherImages.every(isPreparedImageIdentity) &&
    candidate.createdPeople.every((id) => typeof id === 'string') &&
    candidate.uploadedAssets.every((id) => typeof id === 'string')
  );
}

function readModalParameter(parameters: unknown, key: string) {
  if (typeof parameters !== 'object' || parameters === null || Array.isArray(parameters)) {
    return undefined;
  }

  return (parameters as Record<string, unknown>)[key];
}

function isPreparedFieldChange(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.key === 'string' &&
    knownMovieFieldKeys.includes(value.key as MovieFieldKey) &&
    Object.hasOwn(value, 'value')
  );
}

function isPreparedPersonCandidate(
  value: unknown,
  expectedRole: 'director' | 'actor',
) {
  return (
    isRecord(value) &&
    typeof value.tmdbId === 'number' &&
    typeof value.name === 'string' &&
    typeof value.order === 'number' &&
    value.role === expectedRole
  );
}

function isPreparedPersonReference(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.candidateTmdbId === 'number' &&
    (value.candidateRole === 'director' || value.candidateRole === 'actor') &&
    typeof value.recordId === 'string'
  );
}

function isPreparedImageReference(value: unknown) {
  return (
    isRecord(value) &&
    hasExactOwnKeys(value, [
      'providerKey',
      'providerImageId',
      'type',
      'uploadId',
    ]) &&
    typeof value.providerKey === 'string' &&
    typeof value.providerImageId === 'string' &&
    (value.type === 'poster' || value.type === 'backdrop') &&
    typeof value.uploadId === 'string'
  );
}

function isPreparedImageIdentity(value: unknown) {
  return (
    isRecord(value) &&
    hasExactOwnKeys(value, ['providerKey', 'providerImageId']) &&
    typeof value.providerKey === 'string' &&
    typeof value.providerImageId === 'string'
  );
}

function hasExactOwnKeys(
  value: Record<string, unknown>,
  expectedKeys: string[],
) {
  const ownKeys = Reflect.ownKeys(value);

  return (
    ownKeys.length === expectedKeys.length &&
    expectedKeys.every((key) => Object.hasOwn(value, key))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
