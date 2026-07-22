import { compareMovieFields } from './fieldComparison';
import type { NormalizedMovie } from './movie';

const movie: NormalizedMovie = {
  tmdbId: 123,
  title: 'Example Movie',
  primaryReleaseDate: '2024-03-01',
  yearReleased: 2024,
  mpaaRating: null,
  runtime: 125,
  tagline: 'A useful tagline',
  description: 'Overview text',
  directors: [],
  actors: [],
  images: [],
};

describe('compareMovieFields', () => {
  it('selects empty destination fields by default', () => {
    const [title] = compareMovieFields({ title: '' }, movie, ['title']);

    expect(title.selected).toBe(true);
    expect(title.proposedValue).toBe('Example Movie');
  });

  it('does not select populated fields by default', () => {
    const [title] = compareMovieFields({ title: 'Editorial Title' }, movie, ['title']);

    expect(title.selected).toBe(false);
  });

  it('treats equivalent TMDB IDs as unchanged across string and number fields', () => {
    const [tmdbId] = compareMovieFields({ tmdbId: '123' }, movie, ['tmdbId']);

    expect(tmdbId.changed).toBe(false);
    expect(tmdbId.selected).toBe(false);
  });

  it('marks missing TMDB values as unavailable and never selected', () => {
    const [rating] = compareMovieFields({ mpaaRating: 'R' }, movie, ['mpaaRating']);

    expect(rating.available).toBe(false);
    expect(rating.selected).toBe(false);
  });
});
