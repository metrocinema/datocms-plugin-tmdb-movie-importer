import type { ValidationIssue } from '../domain/movie';
import type { PluginParameters } from './parameters';

export type DatoFieldSnapshot = {
  apiKey: string;
  fieldType: string;
  localized: boolean;
  validators: Record<string, unknown>;
};

export type DatoModelSnapshot = {
  id?: string;
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
  description: ['text', 'string', 'structured_text'],
  poster: ['file'],
  heroImage: ['file'],
  backdrops: ['gallery'],
  directors: ['links'],
  actors: ['links'],
};

function linkedItemTypes(field: DatoFieldSnapshot): string[] {
  const itemItemType = (field.validators.itemItemType ?? field.validators.items_item_type) as { itemTypes?: unknown; item_types?: unknown } | undefined;
  const itemTypes = itemItemType?.itemTypes ?? itemItemType?.item_types;
  return Array.isArray(itemTypes) ? itemTypes.filter((value): value is string => typeof value === 'string') : [];
}

export function validateFieldMappings(params: PluginParameters, schema: DatoSchemaSnapshot): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const movieModel = schema.models[params.movieModelApiKey];
  const personModel = schema.models[params.personModelApiKey];
  const personModelTargets = [params.personModelApiKey, personModel?.id].filter((value): value is string => Boolean(value));

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

    if ((fieldKey === 'directors' || fieldKey === 'actors') && !linkedItemTypes(field).some((itemType) => personModelTargets.includes(itemType))) {
      issues.push({ code: `${fieldKey}_wrong_target_model`, message: `${fieldApiKey} must link to the configured person model.`, severity: 'error' });
    }
  }

  const nameField = personModel?.fields[params.personNameFieldApiKey];

  if (!personModel) {
    issues.push({ code: 'person_model_not_found', message: 'Configured person model was not found.', severity: 'error' });
  } else if (!nameField || !['string', 'text'].includes(nameField.fieldType)) {
    issues.push({ code: 'person_name_field_invalid', message: 'Person name field must be a string or text field.', severity: 'error' });
  }

  const tmdbIdField = params.personTmdbIdFieldApiKey ? personModel?.fields[params.personTmdbIdFieldApiKey] : null;
  if (params.personTmdbIdFieldApiKey && (!tmdbIdField || !['integer', 'float', 'string'].includes(tmdbIdField.fieldType))) {
    issues.push({ code: 'person_tmdb_id_field_invalid', message: 'Person TMDB ID field must be an integer, float, or string field.', severity: 'error' });
  }

  return issues;
}

export function fieldPathForMovieField(fieldApiKey: string, localized: boolean, locale: string): string {
  return localized ? `${fieldApiKey}.${locale}` : fieldApiKey;
}

export function itemReference(id: string): string {
  return id;
}

export function assetReference(id: string): { upload_id: string; alt: null; title: null; custom_data: Record<string, never>; focal_point: null; poster_time: null } {
  return {
    upload_id: id,
    alt: null,
    title: null,
    custom_data: {},
    focal_point: null,
    poster_time: null,
  };
}
