import completeMovie from '../test/fixtures/tmdb/complete-movie.json';
import missingCertification from '../test/fixtures/tmdb/missing-certification.json';
import { normalizeTmdbMovie, selectUsCertification } from './tmdbNormalizer';

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
});
