import { buildImportPlan } from './importPlanning';
import type { FieldComparison } from './fieldComparison';

const fields: FieldComparison[] = [
  { key: 'title', currentValue: '', proposedValue: 'Example Movie', selected: true, available: true, changed: true },
  { key: 'runtime', currentValue: 120, proposedValue: 125, selected: false, available: true, changed: true },
  { key: 'mpaaRating', currentValue: 'R', proposedValue: null, selected: false, available: false, changed: true },
];

describe('buildImportPlan', () => {
  it('includes only selected available field changes', () => {
    const plan = buildImportPlan({
      fieldComparisons: fields,
      directors: [],
      actors: [],
      imageSelection: { poster: null, backdrops: [] },
      personResolutions: [],
    });

    expect(plan.fieldChanges).toEqual([{ key: 'title', value: 'Example Movie' }]);
  });

  it('records person creates and asset uploads before final form values', () => {
    const plan = buildImportPlan({
      fieldComparisons: [],
      directors: [{ tmdbId: 10, name: 'Director Name', order: 0, role: 'director' }],
      actors: [],
      imageSelection: {
        poster: { providerKey: 'tmdb', providerImageId: '/poster.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'poster', originalUrl: 'https://image.tmdb.org/t/p/original/poster.jpg', width: 100, height: 150, language: 'en', rank: 1, attribution: 'TMDB' },
        backdrops: [],
      },
      personResolutions: [{ candidateTmdbId: 10, action: 'create', name: 'Director Name' }],
    });

    expect(plan.peopleToCreate).toEqual([{ candidateTmdbId: 10, name: 'Director Name' }]);
    expect(plan.assetsToUpload).toHaveLength(1);
  });
});
