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
      imageSelection: { poster: null, heroImage: null, backdrops: [] },
      personResolutions: [],
      mappedFields: ['title'],
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
        heroImage: null,
        backdrops: [],
      },
      personResolutions: [{ candidateTmdbId: 10, candidateRole: 'director', action: 'create', name: 'Director Name', source: 'auto' }],
      mappedFields: ['directors', 'poster'],
    });

    expect(plan.peopleToCreate).toEqual([{ candidateTmdbId: 10, candidateRole: 'director', name: 'Director Name', source: 'auto' }]);
    expect(plan.assetsToUpload).toHaveLength(1);
  });

  it('removes the hero image from other images while uploading each selected asset once', () => {
    const hero = { providerKey: 'tmdb', providerImageId: '/hero.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'backdrop', originalUrl: 'https://image.tmdb.org/t/p/original/hero.jpg', width: 200, height: 100, language: null, rank: 1, attribution: 'TMDB' } as const;
    const other = { ...hero, providerImageId: '/other.jpg', originalUrl: 'https://image.tmdb.org/t/p/original/other.jpg', rank: 2 };

    const plan = buildImportPlan({
      fieldComparisons: [],
      directors: [],
      actors: [],
      imageSelection: { poster: null, heroImage: hero, backdrops: [hero, other] },
      personResolutions: [],
      mappedFields: ['heroImage', 'backdrops'],
    });

    expect(plan.heroImageToUpload).toBe(hero);
    expect(plan.otherImagesToUpload).toEqual([other]);
    expect(plan.assetsToUpload.map((image) => image.providerImageId)).toEqual(['/hero.jpg', '/other.jpg']);
  });

  it('keeps the same provider image ID from a different provider in other images', () => {
    const hero = { providerKey: 'tmdb', providerImageId: '/shared.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'backdrop', originalUrl: 'https://image.tmdb.org/t/p/original/shared.jpg', width: 200, height: 100, language: null, rank: 1, attribution: 'TMDB' } as const;
    const otherProviderImage = { ...hero, providerKey: 'future', originalUrl: 'https://future.example/shared.jpg', attribution: 'Future Provider' } as const;

    const plan = buildImportPlan({
      fieldComparisons: [],
      directors: [],
      actors: [],
      imageSelection: { poster: null, heroImage: hero, backdrops: [otherProviderImage] },
      personResolutions: [],
      mappedFields: ['heroImage', 'backdrops'],
    });

    expect(plan.heroImageToUpload).toBe(hero);
    expect(plan.otherImagesToUpload).toEqual([otherProviderImage]);
    expect(plan.assetsToUpload).toEqual([hero, otherProviderImage]);
  });

  it('excludes people and images whose destination fields are unmapped', () => {
    const poster = { providerKey: 'tmdb', providerImageId: '/poster.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'poster', originalUrl: 'https://image.tmdb.org/t/p/original/poster.jpg', width: 100, height: 150, language: 'en', rank: 1, attribution: 'TMDB' } as const;
    const hero = { providerKey: 'tmdb', providerImageId: '/hero.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'backdrop', originalUrl: 'https://image.tmdb.org/t/p/original/hero.jpg', width: 200, height: 100, language: null, rank: 1, attribution: 'TMDB' } as const;

    const plan = buildImportPlan({
      fieldComparisons: fields,
      directors: [{ tmdbId: 10, name: 'Director Name', order: 0, role: 'director' }],
      actors: [{ tmdbId: 20, name: 'Actor Name', order: 0, role: 'actor' }],
      imageSelection: { poster, heroImage: hero, backdrops: [hero] },
      personResolutions: [
        { candidateTmdbId: 10, candidateRole: 'director', action: 'create', name: 'Director Name', source: 'auto' },
        { candidateTmdbId: 20, candidateRole: 'actor', action: 'create', name: 'Actor Name', source: 'auto' },
      ],
      mappedFields: ['title'],
    });

    expect(plan).toMatchObject({
      directors: [],
      actors: [],
      peopleToCreate: [],
      peopleToReuse: [],
      heroImageToUpload: null,
      otherImagesToUpload: [],
      assetsToUpload: [],
    });
  });
});
