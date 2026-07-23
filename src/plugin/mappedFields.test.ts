import { executorOptionsForMappedFields, mappedFieldMetadata, valuesForMappedFields } from './mappedFields';

describe('mapped field metadata', () => {
  const movieFields = { title: 'title', runtime: 'runtime' };
  const fields = {
    title: { attributes: { api_key: 'title', localized: true, field_type: 'string' } },
    runtime: { attributes: { api_key: 'runtime', localized: false, field_type: 'integer' } },
  };

  it('reads localized current values from the configured target locale', () => {
    const metadata = mappedFieldMetadata(movieFields, fields);

    expect(valuesForMappedFields({ title: { en: 'English title', fr: 'French title' }, runtime: 120 }, 'en', metadata)).toEqual({ title: 'English title', runtime: 120 });
  });

  it('passes localization metadata to the executor', () => {
    expect(executorOptionsForMappedFields(mappedFieldMetadata(movieFields, fields))).toEqual({
      localizedMovieFields: { title: true, runtime: false },
      movieFieldTypes: { title: 'string', runtime: 'integer' },
    });
  });
});
