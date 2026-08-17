import completeMovie from '../test/fixtures/tmdb/complete-movie.json';
import missingCertification from '../test/fixtures/tmdb/missing-certification.json';
import type { TmdbMoviePackage } from './tmdbTypes';
import { normalizeTmdbMovie, selectUsCertification } from './tmdbNormalizer';

const validVideo = {
  id: 'valid-video',
  iso_639_1: 'en',
  iso_3166_1: 'US',
  key: 'valid_key-123',
  name: 'Official Trailer',
  official: true,
  published_at: '2025-01-01T00:00:00.000Z',
  site: 'YouTube',
  size: 1080,
  type: 'Trailer',
};

describe('normalizeTmdbMovie', () => {
  it('normalizes scalar movie fields and derives release year', () => {
    const movie = normalizeTmdbMovie(completeMovie, 10);

    expect(movie.tmdbId).toBe(completeMovie.id);
    expect(movie.title).toBe(completeMovie.title);
    expect(movie.yearReleased).toBe(Number(completeMovie.release_date.slice(0, 4)));
    expect(movie.runtime).toBe(completeMovie.runtime);
    expect(movie.tagline).toBe(completeMovie.tagline);
    expect(movie.description).toBe(completeMovie.overview);
  });

  it('selects the preferred US certification and returns null when missing', () => {
    expect(selectUsCertification(completeMovie.release_dates)).toBe('PG-13');
    expect(selectUsCertification(missingCertification.release_dates)).toBeNull();
  });

  it('keeps director order and truncates actors to the configured limit', () => {
    const movie = normalizeTmdbMovie(completeMovie, 2);

    expect(movie.directors.every((person) => person.role === 'director')).toBe(true);
    expect(movie.actors).toHaveLength(2);
    expect(movie.actors.map((actor) => actor.order)).toEqual([0, 1]);
  });

  it('normalizes ranked poster and backdrop candidates', () => {
    const movie = normalizeTmdbMovie(completeMovie, 10);
    const poster = movie.images.find((image) => image.type === 'poster');
    const backdrop = movie.images.find((image) => image.type === 'backdrop');

    expect(poster).toMatchObject({
      providerKey: 'tmdb',
      providerImageId: completeMovie.images.posters[0].file_path,
      originalUrl: `https://image.tmdb.org/t/p/original${completeMovie.images.posters[0].file_path}`,
      previewUrl: `https://image.tmdb.org/t/p/w342${completeMovie.images.posters[0].file_path}`,
      language: 'en',
      attribution: 'TMDB',
    });
    expect(backdrop).toMatchObject({
      providerKey: 'tmdb',
      providerImageId: completeMovie.images.backdrops[0].file_path,
      originalUrl: `https://image.tmdb.org/t/p/original${completeMovie.images.backdrops[0].file_path}`,
      previewUrl: `https://image.tmdb.org/t/p/w300${completeMovie.images.backdrops[0].file_path}`,
      language: null,
      attribution: 'TMDB',
    });
    expect(movie.images.map((image) => image.rank)).toEqual([...movie.images.map((image) => image.rank)].sort((a, b) => a - b));
  });

  it('selects the highest-resolution official English YouTube trailer', () => {
    const movie = normalizeTmdbMovie({
      ...completeMovie,
      videos: {
        results: [
          { id: 'older-1080', iso_639_1: 'en', iso_3166_1: 'US', key: 'older_1080', name: 'Official Trailer', official: true, published_at: '2025-01-01T00:00:00.000Z', site: 'YouTube', size: 1080, type: 'Trailer' },
          { id: 'newer-1080', iso_639_1: 'en', iso_3166_1: 'GB', key: 'newer-1080', name: 'Official Trailer 2', official: true, published_at: '2025-02-01T00:00:00.000Z', site: 'YouTube', size: 1080, type: 'Trailer' },
          { id: 'larger-2160', iso_639_1: 'en', iso_3166_1: 'CA', key: 'larger2160', name: '4K Official Trailer', official: true, published_at: '2024-01-01T00:00:00.000Z', site: 'YouTube', size: 2160, type: 'Trailer' },
        ],
      },
    }, 10);

    expect(movie.trailer).toMatchObject({
      providerKey: 'tmdb',
      providerVideoId: 'larger-2160',
      externalProvider: 'youtube',
      externalProviderId: 'larger2160',
      title: '4K Official Trailer',
      resolution: 2160,
      official: true,
    });
  });

  it('breaks equal-resolution ties by newest valid publish date, then lexical TMDB video id', () => {
    const movie = normalizeTmdbMovie({
      ...completeMovie,
      videos: {
        results: [
          { ...validVideo, id: 'video-z', key: 'video_z', published_at: 'not-a-date' },
          { ...validVideo, id: 'video-c', key: 'video_c', published_at: '2025-01-01T00:00:00.000Z' },
          { ...validVideo, id: 'video-b', key: 'video_b', published_at: '2025-02-01T00:00:00.000Z' },
          { ...validVideo, id: 'video-a', key: 'video_a', published_at: '2025-02-01T00:00:00.000Z' },
        ],
      },
    }, 10);

    expect(movie.trailer).toMatchObject({
      providerVideoId: 'video-a',
      externalProviderId: 'video_a',
      publishedAt: '2025-02-01T00:00:00.000Z',
    });
  });

  it.each([
    [{ official: false }, 'unofficial'],
    [{ iso_639_1: 'fr' }, 'non-English'],
    [{ site: 'Vimeo' }, 'non-YouTube'],
    [{ type: 'Teaser' }, 'non-trailer'],
    [{ key: 'bad/key' }, 'malformed key'],
    [{ size: 0 }, 'invalid size'],
  ])('ignores %s candidates', (override, _label) => {
    const movie = normalizeTmdbMovie({
      ...completeMovie,
      videos: { results: [{ ...validVideo, ...override }] },
    }, 10);

    expect(movie.trailer).toBeNull();
  });

  it.each([
    {},
    { videos: undefined },
    { videos: {} },
    { videos: { results: 'invalid' } },
  ])('treats a missing or malformed videos response as no trailer', (override) => {
    expect(normalizeTmdbMovie({ ...completeMovie, ...override } as TmdbMoviePackage, 10).trailer).toBeNull();
  });
});
