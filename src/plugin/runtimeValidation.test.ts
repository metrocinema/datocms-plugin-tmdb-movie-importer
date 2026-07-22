import { validateRuntimeConfiguration } from './runtimeValidation';
import { parsePluginParameters } from './parameters';
import type { DatoSchemaSnapshot } from './datoFieldMapping';

const validParameters = parsePluginParameters({
  tmdbReadToken: 'token',
  movieModelApiKey: 'movie',
  movieFields: { title: 'title' },
  personModelApiKey: 'person',
  personNameFieldApiKey: 'name',
});

const schema: DatoSchemaSnapshot = {
  models: {
    movie: { apiKey: 'movie', fields: { title: { apiKey: 'title', fieldType: 'string', localized: false, validators: {} } } },
    person: { apiKey: 'person', fields: { name: { apiKey: 'name', fieldType: 'string', localized: false, validators: {} } } },
  },
};

describe('validateRuntimeConfiguration', () => {
  it('blocks missing required plugin parameters before the importer can run', () => {
    expect(validateRuntimeConfiguration(parsePluginParameters({})).map((issue) => issue.code)).toContain('missing_tmdb_token');
  });

  it('uses available schema metadata to block incompatible mappings', () => {
    const badSchema: DatoSchemaSnapshot = {
      ...schema,
      models: {
        ...schema.models,
        movie: { apiKey: 'movie', fields: { title: { apiKey: 'title', fieldType: 'integer', localized: false, validators: {} } } },
      },
    };

    expect(validateRuntimeConfiguration(validParameters, badSchema).map((issue) => issue.code)).toContain('title_wrong_type');
  });
});
