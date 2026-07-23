import type { ImportExecutorOptions } from '../dato/importExecutor';
import type { CurrentMovieValues } from '../domain/fieldComparison';
import type { MovieFieldKey } from '../domain/movie';

type FieldSnapshot = { attributes: { api_key: string; localized: boolean; field_type?: string } };

export type MappedFieldMetadata = {
  key: MovieFieldKey;
  apiKey: string;
  localized: boolean;
  fieldType: string | null;
};

export function mappedFieldMetadata(movieFields: Partial<Record<MovieFieldKey, string>>, fields: Partial<Record<string, FieldSnapshot>>): MappedFieldMetadata[] {
  return (Object.keys(movieFields) as MovieFieldKey[]).flatMap((key) => {
    const apiKey = movieFields[key];
    if (!apiKey) return [];
    const field = Object.values(fields).find((candidate) => candidate?.attributes.api_key === apiKey);
    return [{ key, apiKey, localized: field?.attributes.localized ?? false, fieldType: field?.attributes.field_type ?? null }];
  });
}

export function valuesForMappedFields(formValues: Record<string, unknown>, targetLocale: string, fields: MappedFieldMetadata[]): CurrentMovieValues {
  return Object.fromEntries(fields.map(({ key, apiKey, localized }) => [key, localized ? localizedValue(formValues[apiKey], targetLocale) : formValues[apiKey]])) as CurrentMovieValues;
}

export function executorOptionsForMappedFields(fields: MappedFieldMetadata[]): ImportExecutorOptions {
  return {
    localizedMovieFields: Object.fromEntries(fields.map(({ key, localized }) => [key, localized])),
    movieFieldTypes: Object.fromEntries(fields.flatMap(({ key, fieldType }) => fieldType ? [[key, fieldType]] : [])),
  };
}

function localizedValue(value: unknown, targetLocale: string): unknown {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>)[targetLocale] : value;
}
