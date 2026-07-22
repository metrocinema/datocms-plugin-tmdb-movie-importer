import type { MovieFieldKey, ValidationIssue } from '../domain/movie';

export type MovieFieldMappings = Partial<Record<MovieFieldKey, string>>;

export type PluginParameters = {
  tmdbReadToken: string;
  movieModelApiKey: string;
  targetLocale: 'en';
  movieFields: MovieFieldMappings;
  personModelApiKey: string;
  personNameFieldApiKey: string;
  personTmdbIdFieldApiKey: string | null;
  actorLimit: number;
};

const DEFAULT_PARAMETERS: PluginParameters = {
  tmdbReadToken: '',
  movieModelApiKey: '',
  targetLocale: 'en',
  movieFields: {},
  personModelApiKey: '',
  personNameFieldApiKey: '',
  personTmdbIdFieldApiKey: null,
  actorLimit: 10,
};

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalStringValue(value: unknown): string | null {
  const parsed = stringValue(value);
  return parsed.length > 0 ? parsed : null;
}

function actorLimitValue(value: unknown): number {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : 10;
}

export function parsePluginParameters(input: unknown): PluginParameters {
  const source = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const rawFields = typeof source.movieFields === 'object' && source.movieFields !== null ? source.movieFields : {};

  return {
    ...DEFAULT_PARAMETERS,
    tmdbReadToken: stringValue(source.tmdbReadToken),
    movieModelApiKey: stringValue(source.movieModelApiKey),
    targetLocale: 'en',
    movieFields: rawFields as MovieFieldMappings,
    personModelApiKey: stringValue(source.personModelApiKey),
    personNameFieldApiKey: stringValue(source.personNameFieldApiKey),
    personTmdbIdFieldApiKey: optionalStringValue(source.personTmdbIdFieldApiKey),
    actorLimit: actorLimitValue(source.actorLimit),
  };
}

export function validatePluginParameters(params: PluginParameters): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!params.tmdbReadToken) {
    issues.push({ code: 'missing_tmdb_token', message: 'TMDB read token is required.', severity: 'error' });
  }

  if (!params.movieModelApiKey) {
    issues.push({ code: 'missing_movie_model', message: 'Movie model is required.', severity: 'error' });
  }

  if (!params.personModelApiKey) {
    issues.push({ code: 'missing_person_model', message: 'Person model is required.', severity: 'error' });
  }

  if (!params.personNameFieldApiKey) {
    issues.push({ code: 'missing_person_name_field', message: 'Person name field is required.', severity: 'error' });
  }

  return issues;
}
