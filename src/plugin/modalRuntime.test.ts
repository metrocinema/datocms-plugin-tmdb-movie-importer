import { describe, expect, it } from 'vitest';
import type { PreparedImport } from '../dato/importExecutor';
import { isPreparedImport, modalCurrentValues, modalInitialTmdbId, modalMappedFields } from './modalRuntime';

describe('modalRuntime', () => {
  it('treats missing modal parameters as safe empty values', () => {
    expect(modalMappedFields(undefined)).toEqual([]);
    expect(modalCurrentValues(undefined)).toEqual({});
    expect(modalInitialTmdbId(undefined)).toBeNull();
  });

  it('accepts a complete sanitized prepared import', () => {
    expect(isPreparedImport(validPreparedImport())).toBe(true);
    expect(isPreparedImport({
      ...validPreparedImport(),
      heroImage: null,
    })).toBe(true);
  });

  it.each([
    'originalUrl',
    'previewUrl',
    'sourceUrl',
    'token',
    'credentials',
    'unexpected',
  ])('rejects prepared image references with an unexpected %s key', (key) => {
    const prepared = validPreparedImport();

    expect(isPreparedImport({
      ...prepared,
      images: [{
        ...prepared.images[0],
        [key]: 'sensitive value',
      }],
    })).toBe(false);
  });

  it('rejects non-enumerable unexpected image reference keys', () => {
    const prepared = validPreparedImport();
    const image = { ...prepared.images[0] };
    Object.defineProperty(image, 'token', {
      value: 'sensitive value',
      enumerable: false,
    });

    expect(isPreparedImport({
      ...prepared,
      images: [image],
    })).toBe(false);
  });

  it.each([
    {
      name: 'an image reference missing its upload ID',
      change: (prepared: PreparedImport) => ({
        ...prepared,
        images: [{
          providerKey: 'tmdb',
          providerImageId: 'poster-1',
          type: 'poster',
        }],
      }),
    },
    {
      name: 'an image reference with an unsupported type',
      change: (prepared: PreparedImport) => ({
        ...prepared,
        images: [{
          ...prepared.images[0],
          type: 'profile',
        }],
      }),
    },
    {
      name: 'a hero identity with a source URL',
      change: (prepared: PreparedImport) => ({
        ...prepared,
        heroImage: {
          ...prepared.heroImage,
          sourceUrl: 'https://example.com/private',
        },
      }),
    },
    {
      name: 'an other-image identity with credentials',
      change: (prepared: PreparedImport) => ({
        ...prepared,
        otherImages: [{
          ...prepared.otherImages[0],
          credentials: 'secret',
        }],
      }),
    },
  ])('rejects $name', ({ change }) => {
    expect(isPreparedImport(change(validPreparedImport()))).toBe(false);
  });

  it.each([
    {
      name: 'field changes without a valid movie key',
      change: { fieldChanges: [{ key: 'not-a-movie-field', value: 'Movie' }] },
    },
    {
      name: 'malformed directors',
      change: { directors: [{ tmdbId: 10, role: 'director' }] },
    },
    {
      name: 'malformed actors',
      change: { actors: [{ tmdbId: 20, name: 'Actor', order: 0, role: 'writer' }] },
    },
    {
      name: 'malformed prepared people',
      change: { people: [{ candidateTmdbId: 10, candidateRole: 'director' }] },
    },
    {
      name: 'a missing hero identity',
      change: { heroImage: undefined },
    },
    {
      name: 'malformed created Person IDs',
      change: { createdPeople: ['person-1', 2] },
    },
    {
      name: 'malformed uploaded asset IDs',
      change: { uploadedAssets: null },
    },
  ])('rejects $name', ({ change }) => {
    expect(isPreparedImport({
      ...validPreparedImport(),
      ...change,
    })).toBe(false);
  });
});

function validPreparedImport(): PreparedImport {
  return {
    fieldChanges: [{ key: 'title', value: 'Movie' }],
    directors: [{
      tmdbId: 10,
      name: 'Director',
      order: 0,
      role: 'director',
    }],
    actors: [{
      tmdbId: 20,
      name: 'Actor',
      order: 0,
      role: 'actor',
    }],
    people: [
      {
        candidateTmdbId: 10,
        candidateRole: 'director',
        recordId: 'person-1',
      },
      {
        candidateTmdbId: 20,
        candidateRole: 'actor',
        recordId: 'person-2',
      },
    ],
    images: [{
      providerKey: 'tmdb',
      providerImageId: 'poster-1',
      type: 'poster',
      uploadId: 'upload-1',
    }],
    heroImage: {
      providerKey: 'tmdb',
      providerImageId: 'backdrop-1',
    },
    otherImages: [{
      providerKey: 'tmdb',
      providerImageId: 'backdrop-2',
    }],
    createdPeople: ['person-1', 'person-2'],
    uploadedAssets: ['upload-1'],
  };
}
