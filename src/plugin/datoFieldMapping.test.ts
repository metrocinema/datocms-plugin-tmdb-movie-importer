import { assetReference, fieldPathForMovieField, itemReference, validateFieldMappings, type DatoSchemaSnapshot } from './datoFieldMapping';
import type { PluginParameters } from './parameters';

const baseParams: PluginParameters = {
  tmdbReadToken: 'token',
  movieModelApiKey: 'movie',
  targetLocale: 'en',
  movieFields: {
    title: 'title',
    poster: 'poster',
    backdrops: 'backdrops',
    directors: 'directors',
    actors: 'actors',
  },
  personModelApiKey: 'person',
  personNameFieldApiKey: 'name',
  personTmdbIdFieldApiKey: null,
  actorLimit: 10,
};

const schema: DatoSchemaSnapshot = {
  models: {
    movie: {
      apiKey: 'movie',
      fields: {
        title: { apiKey: 'title', fieldType: 'string', localized: true, validators: {} },
        description: { apiKey: 'description', fieldType: 'structured_text', localized: false, validators: {} },
        poster: { apiKey: 'poster', fieldType: 'file', localized: false, validators: {} },
        hero_image: { apiKey: 'hero_image', fieldType: 'file', localized: false, validators: {} },
        backdrops: { apiKey: 'backdrops', fieldType: 'gallery', localized: false, validators: {} },
        directors: { apiKey: 'directors', fieldType: 'links', localized: false, validators: { itemItemType: { itemTypes: ['person'] } } },
        actors: { apiKey: 'actors', fieldType: 'links', localized: false, validators: { itemItemType: { itemTypes: ['person'] } } },
      },
    },
    person: {
      apiKey: 'person',
      fields: {
        name: { apiKey: 'name', fieldType: 'string', localized: false, validators: {} },
      },
    },
  },
};

describe('validateFieldMappings', () => {
  it('accepts configured movie and person relationships', () => {
    expect(validateFieldMappings(baseParams, schema)).toEqual([]);
  });

  it('accepts hero image as a single file field', () => {
    expect(validateFieldMappings({ ...baseParams, movieFields: { ...baseParams.movieFields, heroImage: 'hero_image' } }, schema)).toEqual([]);
  });

  it('accepts description as a structured text field', () => {
    expect(validateFieldMappings({ ...baseParams, movieFields: { description: 'description' } }, schema)).toEqual([]);
  });

  it('rejects hero image when it is not a single file field', () => {
    const badSchema: DatoSchemaSnapshot = {
      ...schema,
      models: {
        ...schema.models,
        movie: {
          ...schema.models.movie,
          fields: {
            ...schema.models.movie.fields,
            hero_image: { apiKey: 'hero_image', fieldType: 'gallery', localized: false, validators: {} },
          },
        },
      },
    };

    expect(validateFieldMappings({ ...baseParams, movieFields: { ...baseParams.movieFields, heroImage: 'hero_image' } }, badSchema).map((issue) => issue.code)).toContain('heroImage_wrong_type');
  });

  it('rejects people fields that do not target the shared person model', () => {
    const badSchema: DatoSchemaSnapshot = {
      ...schema,
      models: {
        ...schema.models,
        movie: {
          ...schema.models.movie,
          fields: {
            ...schema.models.movie.fields,
            actors: { apiKey: 'actors', fieldType: 'links', localized: false, validators: { itemItemType: { itemTypes: ['director'] } } },
          },
        },
      },
    };

    expect(validateFieldMappings(baseParams, badSchema).map((issue) => issue.code)).toContain('actors_wrong_target_model');
  });

  it('accepts people fields that target the configured person model ID', () => {
    const schemaWithModelIds: DatoSchemaSnapshot = {
      models: {
        movie: {
          id: 'movie-id',
          apiKey: 'movie',
          fields: {
            directors: { apiKey: 'directors', fieldType: 'links', localized: false, validators: { items_item_type: { item_types: ['person-id'] } } },
            actors: { apiKey: 'actors', fieldType: 'links', localized: false, validators: { items_item_type: { item_types: ['person-id'] } } },
          },
        },
        person: {
          id: 'person-id',
          apiKey: 'person',
          fields: {
            name: { apiKey: 'name', fieldType: 'string', localized: false, validators: {} },
          },
        },
      },
    };

    expect(validateFieldMappings({ ...baseParams, movieFields: { directors: 'directors', actors: 'actors' } }, schemaWithModelIds)).toEqual([]);
  });

  it('accepts a configured scalar TMDB ID field on the person model', () => {
    const schemaWithTmdbId: DatoSchemaSnapshot = {
      ...schema,
      models: {
        ...schema.models,
        person: {
          ...schema.models.person,
          fields: {
            ...schema.models.person.fields,
            tmdbId: { apiKey: 'tmdbId', fieldType: 'integer', localized: false, validators: {} },
          },
        },
      },
    };

    expect(validateFieldMappings({ ...baseParams, personTmdbIdFieldApiKey: 'tmdbId' }, schemaWithTmdbId)).toEqual([]);
  });

  it('rejects a configured TMDB ID field with an incompatible type', () => {
    const schemaWithBadTmdbId: DatoSchemaSnapshot = {
      ...schema,
      models: {
        ...schema.models,
        person: {
          ...schema.models.person,
          fields: {
            ...schema.models.person.fields,
            tmdbId: { apiKey: 'tmdbId', fieldType: 'gallery', localized: false, validators: {} },
          },
        },
      },
    };

    expect(validateFieldMappings({ ...baseParams, personTmdbIdFieldApiKey: 'tmdbId' }, schemaWithBadTmdbId).map((issue) => issue.code)).toContain('person_tmdb_id_field_invalid');
  });

  it('rejects a configured TMDB ID field that does not exist', () => {
    expect(validateFieldMappings({ ...baseParams, personTmdbIdFieldApiKey: 'tmdbId' }, schema).map((issue) => issue.code)).toContain('person_tmdb_id_field_invalid');
  });

  it('rejects a missing configured person model', () => {
    expect(validateFieldMappings({ ...baseParams, personModelApiKey: 'missing' }, schema).map((issue) => issue.code)).toContain('person_model_not_found');
  });

  it('rejects a person name field with an incompatible type', () => {
    const schemaWithBadName: DatoSchemaSnapshot = {
      ...schema,
      models: {
        ...schema.models,
        person: {
          ...schema.models.person,
          fields: {
            ...schema.models.person.fields,
            name: { apiKey: 'name', fieldType: 'integer', localized: false, validators: {} },
          },
        },
      },
    };

    expect(validateFieldMappings(baseParams, schemaWithBadName).map((issue) => issue.code)).toContain('person_name_field_invalid');
  });
});

describe('form value helpers', () => {
  it('targets the active editor locale for localized fields', () => {
    expect(fieldPathForMovieField('title', true, 'en-US')).toBe('title.en-US');
  });

  it('targets raw field path for non-localized fields', () => {
    expect(fieldPathForMovieField('runtime', false, 'en')).toBe('runtime');
  });

  it('builds Dato reference objects', () => {
    expect(itemReference('person-1')).toBe('person-1');
    expect(assetReference('upload-1')).toEqual({
      upload_id: 'upload-1',
      alt: null,
      title: null,
      custom_data: {},
      focal_point: null,
      poster_time: null,
    });
  });
});
