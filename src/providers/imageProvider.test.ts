import { defaultImageSelection } from './imageProvider';
import type { NormalizedImageCandidate } from '../domain/movie';

const images: NormalizedImageCandidate[] = [
  { providerKey: 'tmdb', providerImageId: '/poster.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'poster', originalUrl: 'https://image.tmdb.org/t/p/original/poster.jpg', width: 100, height: 150, language: 'en', rank: 1, attribution: 'TMDB' },
  { providerKey: 'tmdb', providerImageId: '/backdrop-1.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'backdrop', originalUrl: 'https://image.tmdb.org/t/p/original/backdrop-1.jpg', width: 300, height: 150, language: null, rank: 1, attribution: 'TMDB' },
  { providerKey: 'tmdb', providerImageId: '/backdrop-2.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'backdrop', originalUrl: 'https://image.tmdb.org/t/p/original/backdrop-2.jpg', width: 300, height: 150, language: null, rank: 2, attribution: 'TMDB' },
];

describe('defaultImageSelection', () => {
  it('preselects poster and top backdrops when destinations are empty', () => {
    const selection = defaultImageSelection({ poster: null, backdrops: [] }, images);

    expect(selection.poster?.providerImageId).toBe('/poster.jpg');
    expect(selection.backdrops.map((image) => image.providerImageId)).toEqual(['/backdrop-1.jpg', '/backdrop-2.jpg']);
  });

  it('does not preselect replacements when destinations are populated', () => {
    const selection = defaultImageSelection({ poster: 'asset-1', backdrops: ['asset-2'] }, images);

    expect(selection.poster).toBeNull();
    expect(selection.backdrops).toEqual([]);
  });

  it('preselects at most the five highest-ranked backdrops', () => {
    const backdrops: NormalizedImageCandidate[] = Array.from({ length: 6 }, (_, index) => ({
      providerKey: 'tmdb',
      providerImageId: `/backdrop-${index + 1}.jpg`,
      movieIdentity: { providerKey: 'tmdb', tmdbId: 1 },
      type: 'backdrop',
      originalUrl: `https://image.tmdb.org/t/p/original/backdrop-${index + 1}.jpg`,
      width: 300,
      height: 150,
      language: null,
      rank: index + 1,
      attribution: 'TMDB',
    }));

    const selection = defaultImageSelection({ backdrops: [] }, backdrops);

    expect(selection.backdrops.map((image) => image.providerImageId)).toEqual([
      '/backdrop-1.jpg',
      '/backdrop-2.jpg',
      '/backdrop-3.jpg',
      '/backdrop-4.jpg',
      '/backdrop-5.jpg',
    ]);
  });
});
