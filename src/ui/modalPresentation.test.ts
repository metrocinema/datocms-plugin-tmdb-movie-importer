import type { ImportPlan } from '../domain/importPlanning';
import {
  countConfirmSummary,
  formatEmptyValue,
  formatRuntime,
  formatYear,
  movieFieldLabels,
} from './modalPresentation';

const plan: ImportPlan = {
  fieldChanges: [
    { key: 'title', value: 'Example Movie' },
    { key: 'runtime', value: 125 },
  ],
  directors: [],
  actors: [],
  peopleToCreate: [{ candidateTmdbId: 10, candidateRole: 'director', name: 'Director Name', source: 'auto' }],
  peopleToReuse: [{ candidateTmdbId: 20, candidateRole: 'actor', recordId: 'person-20', name: 'Actor Name', source: 'tmdb-id' }],
  heroImageToUpload: null,
  otherImagesToUpload: [],
  assetsToUpload: [
    {
      providerKey: 'tmdb', providerImageId: '/poster.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'poster', originalUrl: 'https://image.tmdb.org/t/p/original/poster.jpg', width: 100, height: 150, language: 'en', rank: 1, attribution: 'TMDB',
    },
    {
      providerKey: 'tmdb', providerImageId: '/backdrop.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'backdrop', originalUrl: 'https://image.tmdb.org/t/p/original/backdrop.jpg', width: 1920, height: 1080, language: 'en', rank: 2, attribution: 'TMDB',
    },
  ],
};

describe('modal presentation helpers', () => {
  it('provides human-friendly labels for movie fields', () => {
    expect(movieFieldLabels.yearReleased).toBe('Year released');
    expect(movieFieldLabels.mpaaRating).toBe('MPAA rating');
    expect(movieFieldLabels.tmdbId).toBe('TMDB ID');
    expect(movieFieldLabels.poster).toBe('Poster');
    expect(movieFieldLabels.heroImage).toBe('Hero image');
    expect(movieFieldLabels.backdrops).toBe('Other images');
  });

  it('formats runtime and release year fallbacks', () => {
    expect(formatRuntime(125)).toBe('125 min');
    expect(formatRuntime(null)).toBe('Not available');
    expect(formatYear(2024)).toBe('2024');
    expect(formatYear(null)).toBe('Unknown year');
  });

  it('formats empty values plainly', () => {
    expect(formatEmptyValue(null)).toBe('Empty');
    expect(formatEmptyValue('')).toBe('Empty');
    expect(formatEmptyValue('A useful tagline')).toBe('A useful tagline');
  });

  it('counts the items shown in the confirmation summary', () => {
    expect(countConfirmSummary(plan)).toEqual({
      fieldChanges: 2,
      peopleToCreate: 1,
      peopleToReuse: 1,
      imagesToUpload: 2,
    });
  });
});
