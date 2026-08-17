import { compareMovieFields } from './fieldComparison';
import type { NormalizedMovie } from './movie';
import { datoExternalVideoValue } from './trailer';

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
  trailer: null,
};

const movieWithTrailer: NormalizedMovie = {
  ...movie,
  trailer: {
    providerKey: 'tmdb',
    providerVideoId: 'tmdb-video-123',
    movieIdentity: { providerKey: 'tmdb', tmdbId: 123 },
    externalProvider: 'youtube',
    externalProviderId: 'youtube-video-123',
    title: 'Official Trailer',
    watchUrl: 'https://www.youtube.com/watch?v=youtube-video-123',
    thumbnailUrl: 'https://img.youtube.com/vi/youtube-video-123/maxresdefault.jpg',
    width: 1920,
    height: 1080,
    language: 'en',
    country: 'US',
    resolution: 1080,
    publishedAt: '2024-02-01T00:00:00.000Z',
    official: true,
    attribution: 'TMDB',
  },
};

const existingDifferentVideo = {
  provider: 'youtube',
  provider_uid: 'different-video-456',
  url: 'https://www.youtube.com/watch?v=different-video-456',
  width: 1280,
  height: 720,
  thumbnail_url: 'https://img.youtube.com/vi/different-video-456/hqdefault.jpg',
  title: 'Editorial Trailer',
};

const emptyStructuredDescription = {
  schema: 'dast',
  document: {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [],
      },
    ],
  },
};

const slateStructuredDescription = [
  {
    type: 'paragraph',
    children: [{ text: 'Overview text' }],
  },
];

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

  it('treats empty structured text descriptions as empty current values', () => {
    const [description] = compareMovieFields({ description: emptyStructuredDescription }, movie, ['description']);

    expect(description.changed).toBe(true);
    expect(description.selected).toBe(true);
  });

  it('matches populated Slate structured text descriptions by their text', () => {
    const [description] = compareMovieFields({ description: slateStructuredDescription }, movie, ['description']);

    expect(description.changed).toBe(false);
    expect(description.selected).toBe(false);
  });

  it('preselects a trailer only when the current video field is empty', () => {
    const [trailer] = compareMovieFields({ trailer: null }, movieWithTrailer, ['trailer']);

    expect(trailer).toMatchObject({ available: true, changed: true, selected: true });
    expect(trailer.proposedValue).toEqual(datoExternalVideoValue(movieWithTrailer.trailer!));
  });

  it('leaves a replacement trailer unselected', () => {
    const [trailer] = compareMovieFields({ trailer: existingDifferentVideo }, movieWithTrailer, ['trailer']);

    expect(trailer).toMatchObject({ available: true, changed: true, selected: false });
  });

  it('matches videos by provider and provider ID only', () => {
    const [trailer] = compareMovieFields({
      trailer: { ...datoExternalVideoValue(movieWithTrailer.trailer!), title: 'Editorial title', width: 1, height: 1 },
    }, movieWithTrailer, ['trailer']);

    expect(trailer).toMatchObject({ changed: false, selected: false });
  });

  it('never proposes clearing an existing trailer when TMDB has no candidate', () => {
    const [trailer] = compareMovieFields({ trailer: existingDifferentVideo }, { ...movie, trailer: null }, ['trailer']);

    expect(trailer).toMatchObject({ available: false, selected: false });
  });
});
