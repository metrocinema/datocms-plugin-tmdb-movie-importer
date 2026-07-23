import { manualFieldExtensions } from './fieldExtensions';

describe('manualFieldExtensions', () => {
  it('declares the TMDB movie importer as a manually attachable TMDB ID field add-on', () => {
    expect(manualFieldExtensions()).toEqual([
      {
        id: 'tmdbMovieImport',
        name: 'TMDB Movie Importer',
        type: 'addon',
        fieldTypes: ['string', 'integer', 'float'],
        initialHeight: 80,
      },
    ]);
  });
});
