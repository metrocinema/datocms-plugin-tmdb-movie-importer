import type { ManualFieldExtension } from 'datocms-plugin-sdk';

export const TMDB_MOVIE_IMPORT_FIELD_EXTENSION_ID = 'tmdbMovieImport';

export function manualFieldExtensions(): ManualFieldExtension[] {
  return [
    {
      id: TMDB_MOVIE_IMPORT_FIELD_EXTENSION_ID,
      name: 'TMDB Movie Importer',
      type: 'addon',
      fieldTypes: ['string', 'integer', 'float'],
      initialHeight: 80,
    },
  ];
}
