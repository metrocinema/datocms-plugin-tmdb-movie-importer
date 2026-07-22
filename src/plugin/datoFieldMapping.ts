import type { ValidationIssue } from '../domain/movie';
import type { PluginParameters } from './parameters';

export type DatoFieldSnapshot = {
  apiKey: string;
  fieldType: string;
  localized: boolean;
  validators: Record<string, unknown>;
};

export type DatoModelSnapshot = {
  apiKey: string;
  fields: Record<string, DatoFieldSnapshot>;
};

export type DatoSchemaSnapshot = {
  models: Record<string, DatoModelSnapshot>;
};

const FIELD_TYPES: Record<string, string[]> = {
  title: ['string'],
  yearReleased: ['integer', 'float'],
  mpaaRating: ['string'],
  runtime: ['integer', 'float'],
  tmdbId: ['integer', 'float', 'string'],
  tagline: ['string', 'text'],
  description: ['text', 'string'],
  poster: ['file'],
  backdrops: ['gallery'],
  directors: ['links'],
  actors: ['links'],
};

function linkedItemTypes(field: DatoFieldSnapshot): string[] {
  const itemItemType = field.validators.itemItemType as { itemTypes?: unknown } | undefined;
  return Array.isArray(itemItemType?.itemTypes) ? itemItemType.itemTypes.filter((value): value is string => typeof value === 'string') : [];
}

export function validateFieldMappings(params: PluginParameters, schema: DatoSchemaSnapshot): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const movieModel = schema.models[params.movieModelApiKey];

  if (!movieModel) {
    return [{ code: 'movie_model_not_found', message: 'Configured movie model was not found.', severity: 'error' }];
  }

  for (const [fieldKey, fieldApiKey] of Object.entries(params.movieFields)) {
    if (!fieldApiKey) {
      continue;
    }

    const field = movieModel.fields[fieldApiKey];
    if (!field) {
      issues.push({ code: `${fieldKey}_field_not_found`, message: `Movie field ${fieldApiKey} was not found.`, severity: 'error' });
      continue;
    }

    if (!FIELD_TYPES[fieldKey]?.includes(field.fieldType)) {
      issues.push({ code: `${fieldKey}_wrong_type`, message: `${fieldApiKey} has incompatible type ${field.fieldType}.`, severity: 'error' });
    }

    if ((fieldKey === 'directors' || fieldKey === 'actors') && !linkedItemTypes(field).includes(params.personModelApiKey)) {
      issues.push({ code: `${fieldKey}_wrong_target_model`, message: `${fieldApiKey} must link to the configured person model.`, severity: 'error' });
    }
  }

  const personModel = schema.models[params.personModelApiKey];
  const nameField = personModel?.fields[params.personNameFieldApiKey];

  if (!personModel) {
    issues.push({ code: 'person_model_not_found', message: 'Configured person model was not found.', severity: 'error' });
  } else if (!nameField || !['string', 'text'].includes(nameField.fieldType)) {
    issues.push({ code: 'person_name_field_invalid', message: 'Person name field must be a string or text field.', severity: 'error' });
  }

  return issues;
}
