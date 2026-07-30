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

  it('rejects unexpected top-level payload fields', () => {
    expect(isPreparedImport({
      ...validPreparedImport(),
      originalPlan: { secret: 'should not cross the modal boundary' },
    })).toBe(false);
  });

  it.each([
    {
      name: 'a director without a prepared Person reference',
      change: { people: [{ candidateTmdbId: 20, candidateRole: 'actor', recordId: 'person-2' }], createdPeople: ['person-2'] },
    },
    {
      name: 'a created Person ID without a prepared Person reference',
      change: { createdPeople: ['person-missing'] },
    },
    {
      name: 'an image without a recorded upload',
      change: { uploadedAssets: ['upload-2', 'upload-3'] },
    },
    {
      name: 'an uploaded asset without a prepared image',
      change: { uploadedAssets: ['upload-1', 'upload-2', 'upload-3', 'upload-extra'] },
    },
    {
      name: 'a Hero image without a prepared backdrop',
      change: { heroImage: { providerKey: 'tmdb', providerImageId: 'backdrop-missing' } },
    },
    {
      name: 'an Other image without a prepared backdrop',
      change: { otherImages: [{ providerKey: 'tmdb', providerImageId: 'backdrop-missing' }] },
    },
  ])('rejects $name', ({ change }) => {
    expect(isPreparedImport({
      ...validPreparedImport(),
      ...change,
    })).toBe(false);
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

  it.each([
    { key: 'title', value: 123 },
    { key: 'title', value: '   ' },
    { key: 'yearReleased', value: '2024' },
    { key: 'runtime', value: Number.NaN },
    { key: 'tmdbId', value: 0 },
    { key: 'description', value: { schema: 'dast' } },
    { key: 'poster', value: 'upload-1' },
  ])('rejects an invalid $key field-change value', (fieldChange) => {
    expect(isPreparedImport({
      ...validPreparedImport(),
      fieldChanges: [fieldChange],
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
    images: [
      {
        providerKey: 'tmdb',
        providerImageId: 'poster-1',
        type: 'poster',
        uploadId: 'upload-1',
      },
      {
        providerKey: 'tmdb',
        providerImageId: 'backdrop-1',
        type: 'backdrop',
        uploadId: 'upload-2',
      },
      {
        providerKey: 'tmdb',
        providerImageId: 'backdrop-2',
        type: 'backdrop',
        uploadId: 'upload-3',
      },
    ],
    heroImage: {
      providerKey: 'tmdb',
      providerImageId: 'backdrop-1',
    },
    otherImages: [{
      providerKey: 'tmdb',
      providerImageId: 'backdrop-2',
    }],
    createdPeople: ['person-1', 'person-2'],
    uploadedAssets: ['upload-1', 'upload-2', 'upload-3'],
  };
}
