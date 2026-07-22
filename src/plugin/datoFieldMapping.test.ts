import { validateFieldMappings, type DatoSchemaSnapshot } from './datoFieldMapping';
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
        poster: { apiKey: 'poster', fieldType: 'file', localized: false, validators: {} },
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
});
