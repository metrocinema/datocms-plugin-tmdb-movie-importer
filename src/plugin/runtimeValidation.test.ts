import { loadSchemaForRuntimeValidation, validateRuntimeConfiguration } from './runtimeValidation';
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

  it('does not treat a partial field cache as an invalid mapping when field loading is unavailable', async () => {
    const schema = await loadSchemaForRuntimeValidation(validParameters, partialSchemaContext());

    expect(schema).toBeUndefined();
    expect(validateRuntimeConfiguration(validParameters, schema)).toEqual([]);
  });

  it('falls back to parameter validation when field loading fails', async () => {
    const schema = await loadSchemaForRuntimeValidation(validParameters, {
      ...partialSchemaContext(),
      loadItemTypeFields: async () => {
        throw new Error('DatoCMS schema request failed');
      },
    });

    expect(schema).toBeUndefined();
    expect(validateRuntimeConfiguration(validParameters, schema)).toEqual([]);
  });

  it('validates loaded fields instead of a partial field cache', async () => {
    const schema = await loadSchemaForRuntimeValidation(validParameters, {
      ...partialSchemaContext(),
      loadItemTypeFields: async (itemTypeId: string) => itemTypeId === 'movie-id'
        ? [field('title-id', 'movie-id', 'title', 'integer')]
        : [field('name-id', 'person-id', 'name', 'string')],
    });

    expect(validateRuntimeConfiguration(validParameters, schema).map((issue) => issue.code)).toContain('title_wrong_type');
  });

  it('uses the item type relationship on loaded Dato field records', async () => {
    const schema = await loadSchemaForRuntimeValidation(validParameters, {
      ...partialSchemaContext(),
      loadItemTypeFields: async (itemTypeId: string) => itemTypeId === 'movie-id'
        ? [relationshipField('title-id', 'movie-id', 'title', 'string')]
        : [relationshipField('name-id', 'person-id', 'name', 'string')],
    });

    expect(validateRuntimeConfiguration(validParameters, schema)).toEqual([]);
  });
});

function partialSchemaContext() {
  return {
    itemTypes: {
      'movie-id': itemType('movie-id', 'movie'),
      'person-id': itemType('person-id', 'person'),
    },
    fields: {},
  };
}

function itemType(id: string, apiKey: string) {
  return { id, attributes: { api_key: apiKey } };
}

function field(id: string, itemTypeId: string, apiKey: string, fieldType: string) {
  return {
    id,
    attributes: {
      api_key: apiKey,
      item_type: itemTypeId,
      field_type: fieldType,
      localized: false,
      validators: {},
    },
  };
}

function relationshipField(id: string, itemTypeId: string, apiKey: string, fieldType: string) {
  return {
    id,
    attributes: {
      api_key: apiKey,
      field_type: fieldType,
      localized: false,
      validators: {},
    },
    relationships: {
      item_type: {
        data: {
          id: itemTypeId,
        },
      },
    },
  };
}
