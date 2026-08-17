import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportModal } from './ImportModal';
import type { NormalizedMovie } from '../domain/movie';
import type { ImportProgressEvent, PrepareImportResult } from '../dato/importExecutor';
import type { ImportPlan } from '../domain/importPlanning';
import { TmdbError } from '../providers/tmdbClient';
import { ImportConfigurationError } from '../plugin/runtimeValidation';
import { datoExternalVideoValue } from '../domain/trailer';

vi.mock('../providers/imagePreparation', () => ({
  prepareSelectableImages: async (images: NormalizedMovie['images']) => images,
}));

const pendingLifecycle = {
  prepare: () => new Promise<PrepareImportResult>(() => undefined),
  resolve: async () => undefined,
};

function capturePreparedPlan(recordPlan: (plan: ImportPlan) => unknown) {
  return (plan: ImportPlan) => {
    recordPlan(plan);
    return new Promise<PrepareImportResult>(() => undefined);
  };
}

const movie: NormalizedMovie = {
  tmdbId: 123,
  title: 'Example Movie',
  primaryReleaseDate: '2024-03-01',
  yearReleased: 2024,
  mpaaRating: 'PG-13',
  runtime: 125,
  tagline: 'A useful tagline',
  description: 'Overview text',
  directors: [{ tmdbId: 10, name: 'Director Name', order: 0, role: 'director' }],
  actors: [{ tmdbId: 20, name: 'Actor Name', order: 0, role: 'actor' }],
  images: [{ providerKey: 'tmdb', providerImageId: '/poster.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 123 }, type: 'poster', originalUrl: 'https://image.tmdb.org/t/p/original/poster.jpg', width: 100, height: 150, language: 'en', rank: 1, attribution: 'TMDB' }],
  trailer: null,
};

const movieWithBackdrops: NormalizedMovie = {
  ...movie,
  images: [
    ...movie.images,
    { providerKey: 'tmdb', providerImageId: '/backdrop-1.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 123 }, type: 'backdrop', originalUrl: 'https://image.tmdb.org/t/p/original/backdrop-1.jpg', width: 1920, height: 1080, language: 'en', rank: 2, attribution: 'TMDB' },
    { providerKey: 'tmdb', providerImageId: '/backdrop-2.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 123 }, type: 'backdrop', originalUrl: 'https://image.tmdb.org/t/p/original/backdrop-2.jpg', width: 1920, height: 1080, language: 'en', rank: 3, attribution: 'TMDB' },
  ],
};

const movieWithTrailer: NormalizedMovie = {
  ...movie,
  trailer: {
    providerKey: 'tmdb',
    providerVideoId: 'tmdb-video-1',
    movieIdentity: { providerKey: 'tmdb', tmdbId: 123 },
    externalProvider: 'youtube',
    externalProviderId: 'youtube-video-1',
    title: 'Official Trailer',
    watchUrl: 'https://www.youtube.com/watch?v=youtube-video-1',
    thumbnailUrl: 'https://img.youtube.com/vi/youtube-video-1/maxresdefault.jpg',
    width: 1920,
    height: 1080,
    language: 'en',
    country: 'US',
    resolution: 1080,
    publishedAt: '2024-01-01T00:00:00.000Z',
    official: true,
    attribution: 'TMDB',
  },
};

const movieWithNonEnglishPosters: NormalizedMovie = {
  ...movie,
  images: [
    { providerKey: 'tmdb', providerImageId: '/textless-poster.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 123 }, type: 'poster', originalUrl: 'https://image.tmdb.org/t/p/original/textless-poster.jpg', width: 100, height: 150, language: null, rank: 1, attribution: 'TMDB' },
    { providerKey: 'tmdb', providerImageId: '/english-poster.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 123 }, type: 'poster', originalUrl: 'https://image.tmdb.org/t/p/original/english-poster.jpg', width: 100, height: 150, language: 'en', rank: 2, attribution: 'TMDB' },
    { providerKey: 'tmdb', providerImageId: '/spanish-poster.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 123 }, type: 'poster', originalUrl: 'https://image.tmdb.org/t/p/original/spanish-poster.jpg', width: 100, height: 150, language: 'es', rank: 3, attribution: 'TMDB' },
  ],
};

const movieWithoutEnglishPosters: NormalizedMovie = {
  ...movie,
  images: [
    { providerKey: 'tmdb', providerImageId: '/textless-poster.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 123 }, type: 'poster', originalUrl: 'https://image.tmdb.org/t/p/original/textless-poster.jpg', width: 100, height: 150, language: null, rank: 1, attribution: 'TMDB' },
    { providerKey: 'tmdb', providerImageId: '/spanish-poster.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 123 }, type: 'poster', originalUrl: 'https://image.tmdb.org/t/p/original/spanish-poster.jpg', width: 100, height: 150, language: 'es', rank: 2, attribution: 'TMDB' },
  ],
};

const movieWithSamePersonInTwoRoles: NormalizedMovie = {
  ...movie,
  directors: [{ tmdbId: 99, name: 'Multi-Hyphenate Person', order: 0, role: 'director' }],
  actors: [{ tmdbId: 99, name: 'Multi-Hyphenate Person', order: 0, role: 'actor' }],
  images: [],
};

const movieWithProviderCollisionImages: NormalizedMovie = {
  ...movie,
  images: [
    ...movie.images,
    { providerKey: 'tmdb', providerImageId: '/shared-backdrop.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 123 }, type: 'backdrop', originalUrl: 'https://image.tmdb.org/t/p/original/shared-backdrop.jpg', previewUrl: 'https://image.tmdb.org/t/p/w780/shared-backdrop.jpg', width: 1920, height: 1080, language: 'en', rank: 2, attribution: 'TMDB' },
    { providerKey: 'future', providerImageId: '/shared-backdrop.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 123 }, type: 'backdrop', originalUrl: 'https://future.example/images/shared-backdrop-original.jpg', previewUrl: 'https://future.example/images/shared-backdrop-preview.jpg', width: 1920, height: 1080, language: 'en', rank: 3, attribution: 'Future Provider' },
  ],
};

const movieWithManyImages: NormalizedMovie = {
  ...movie,
  images: [
    ...Array.from({ length: 12 }, (_, index): NormalizedMovie['images'][number] => ({
      providerKey: 'tmdb',
      providerImageId: `/poster-${index + 1}.jpg`,
      movieIdentity: { providerKey: 'tmdb', tmdbId: 123 },
      type: 'poster',
      originalUrl: `https://image.tmdb.org/t/p/original/poster-${index + 1}.jpg`,
      width: 100,
      height: 150,
      language: 'en',
      rank: index + 1,
      attribution: 'TMDB',
    })),
    ...Array.from({ length: 12 }, (_, index): NormalizedMovie['images'][number] => ({
      providerKey: 'tmdb',
      providerImageId: `/backdrop-${index + 1}.jpg`,
      movieIdentity: { providerKey: 'tmdb', tmdbId: 123 },
      type: 'backdrop',
      originalUrl: `https://image.tmdb.org/t/p/original/backdrop-${index + 1}.jpg`,
      width: 1920,
      height: 1080,
      language: 'en',
      rank: index + 13,
      attribution: 'TMDB',
    })),
  ],
};

describe('ImportModal', () => {
  it('presents the find movie workflow and detailed search results', async () => {
    render(
      <ImportModal
        initialTitle="Example"
        initialYear={2024}
        currentValues={{ title: '' }}
        mappedFields={['title']}
        searchMovies={async () => [
          { id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: 'Overview text', posterPath: null, posterUrl: 'https://image.tmdb.org/t/p/w154/poster.jpg' },
          { id: 456, title: 'Example Movie', releaseDate: '2023-10-12', overview: null, posterPath: null, posterUrl: null },
        ]}
        loadMovie={async () => movie}
        {...pendingLifecycle}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Find movie' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Find movie' }).closest('.movie-import-modal__scroll-body')).toBeInTheDocument();
    expect(screen.getByText('Search by title and year').closest('.movie-import-modal__scroll-body')).toBeInTheDocument();
    expect(screen.getByText('Search TMDB and choose the record that matches this DatoCMS movie.').closest('.movie-import-modal__scroll-body')).toBeInTheDocument();
    expect(screen.getByText('Review changes')).toBeInTheDocument();
    expect(screen.getByText('Confirm import')).toBeInTheDocument();
    expect(screen.getByText('Search by title and year')).toBeInTheDocument();
    expect(screen.getByText('Lookup by TMDB ID')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Search by title and year' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Lookup by TMDB ID' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(screen.getAllByText('Example Movie')).toHaveLength(2);
    expect(screen.getByText('2024')).toBeInTheDocument();
    expect(screen.getByText('Overview text')).toBeInTheDocument();
    expect(screen.getByText('TMDB ID 123')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Example Movie poster' })).toHaveAttribute('src', 'https://image.tmdb.org/t/p/w154/poster.jpg');
    expect(screen.getByRole('img', { name: 'Example Movie poster' })).toHaveAttribute('loading', 'lazy');
    expect(screen.getByRole('img', { name: 'Example Movie poster' })).toHaveAttribute('width', '64');
    expect(screen.getByRole('img', { name: 'Example Movie poster' })).toHaveAttribute('height', '96');
    const firstAction = screen.getByRole('button', { name: 'Use this for Example Movie, TMDB ID 123' });
    const secondAction = screen.getByRole('button', { name: 'Use this for Example Movie, TMDB ID 456' });
    expect(firstAction.childNodes[0]).toHaveTextContent('Use this');
    expect(secondAction.childNodes[0]).toHaveTextContent('Use this');
  });

  it('disables search controls while searching', async () => {
    let finishSearch: ((value: []) => void) | undefined;
    render(
      <ImportModal
        initialTitle="Example"
        initialYear={2024}
        currentValues={{ title: '' }}
        mappedFields={['title']}
        searchMovies={() => new Promise((resolve) => {
          finishSearch = resolve;
        })}
        loadMovie={async () => movie}
        {...pendingLifecycle}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(screen.getByRole('button', { name: 'Searching TMDB' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Load movie by ID' })).toBeDisabled();
    finishSearch?.([]);
  });

  it('shows TMDB search progress and clears stale results while a new search is pending', async () => {
    let resolveSecondSearch: ((value: []) => void) | undefined;
    const searchMovies = vi.fn()
      .mockResolvedValueOnce([
        { id: 456, title: 'Previous result', releaseDate: '2023-10-12', overview: null, posterPath: null, posterUrl: null },
      ])
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveSecondSearch = resolve;
      }));

    render(
      <ImportModal
        initialTitle="Example"
        initialYear={2024}
        currentValues={{ title: '' }}
        mappedFields={['title']}
        searchMovies={searchMovies}
        loadMovie={async () => movie}
        {...pendingLifecycle}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('Previous result')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(screen.getByRole('status')).toHaveTextContent('Searching TMDB for “Example”…');
    expect(screen.queryByText('Previous result')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Searching TMDB' })).toBeDisabled();

    resolveSecondSearch?.([]);
  });

  it('prepares artwork while Person matching runs after loading a selected result', async () => {
    let resolveMovie: ((value: NormalizedMovie) => void) | undefined;
    let resolveArtwork: ((value: NormalizedMovie['images']) => void) | undefined;
    let resolvePeople: ((value: []) => void) | undefined;
    const processedImages = [movieWithBackdrops.images[2]!];
    const prepareImages = vi.fn(() => new Promise<NormalizedMovie['images']>((resolve) => {
      resolveArtwork = resolve;
    }));
    const matchPeople = vi.fn(() => new Promise<[]>((resolve) => {
      resolvePeople = resolve;
    }));

    render(
      <ImportModal
        initialTitle="Example"
        initialYear={2024}
        currentValues={{ title: '' }}
        mappedFields={['title', 'directors', 'actors', 'heroImage']}
        searchMovies={async () => [
          { id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null },
        ]}
        loadMovie={() => new Promise((resolve) => {
          resolveMovie = resolve;
        })}
        prepareImages={prepareImages}
        resolvePeople={matchPeople}
        {...pendingLifecycle}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Use this for Example Movie, TMDB ID 123' }));

    expect(screen.getByRole('status')).toHaveTextContent('Loading movie details…');

    resolveMovie?.(movieWithBackdrops);

    await waitFor(() => expect(prepareImages).toHaveBeenCalledWith(movieWithBackdrops.images));
    expect(matchPeople).toHaveBeenCalledWith([
      movieWithBackdrops.directors[0],
      movieWithBackdrops.actors[0],
    ]);
    expect(screen.getByRole('status')).toHaveTextContent('Checking artwork…');

    resolveArtwork?.(processedImages);

    expect(await screen.findByRole('status')).toHaveTextContent('Matching directors and actors…');

    resolvePeople?.([]);

    expect(await screen.findByRole('heading', { name: 'Review changes' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Backdrop option 1' })).toHaveAttribute('src', processedImages[0]!.originalUrl);
    expect(screen.queryByRole('img', { name: 'Backdrop option 2' })).not.toBeInTheDocument();
  });

  it('does not show Person matching after it finishes before slower artwork', async () => {
    let resolveArtwork: ((value: NormalizedMovie['images']) => void) | undefined;
    const matchingPhaseVisible = vi.fn();
    const observer = new MutationObserver(() => {
      if (document.body.textContent?.includes('Matching directors and actors…')) {
        matchingPhaseVisible();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    try {
      render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '' }} mappedFields={['title', 'directors']} searchMovies={async () => []} loadMovie={async () => movie} prepareImages={() => new Promise((resolve) => {
        resolveArtwork = resolve;
      })} resolvePeople={async () => []} {...pendingLifecycle} />);

      await userEvent.type(screen.getByLabelText('TMDB ID'), '123');
      await userEvent.click(screen.getByRole('button', { name: 'Load movie by ID' }));
      expect(await screen.findByRole('status')).toHaveTextContent('Checking artwork…');

      await act(async () => {
        resolveArtwork?.(movie.images);
      });

      expect(await screen.findByRole('heading', { name: 'Review changes' })).toBeInTheDocument();
      expect(matchingPhaseVisible).not.toHaveBeenCalled();
    } finally {
      observer.disconnect();
    }
  });

  it('waits for artwork before surfacing a fast Person-matching rejection', async () => {
    let resolveArtwork: ((value: NormalizedMovie['images']) => void) | undefined;
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const unhandledRejection = vi.fn();
    window.addEventListener('unhandledrejection', unhandledRejection);

    try {
      render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '' }} mappedFields={['title', 'directors']} searchMovies={async () => []} loadMovie={async () => movie} prepareImages={() => new Promise((resolve) => {
        resolveArtwork = resolve;
      })} resolvePeople={async () => {
        throw new Error('Person list permission is unavailable.');
      }} {...pendingLifecycle} />);

      await userEvent.type(screen.getByLabelText('TMDB ID'), '123');
      await userEvent.click(screen.getByRole('button', { name: 'Load movie by ID' }));
      expect(await screen.findByRole('status')).toHaveTextContent('Checking artwork…');

      await act(async () => undefined);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(consoleError).not.toHaveBeenCalledWith(
        'TMDB Movie Importer person matching failed',
        expect.anything(),
      );
      expect(unhandledRejection).not.toHaveBeenCalled();

      await act(async () => {
        resolveArtwork?.(movie.images);
      });

      expect(await screen.findByRole('alert')).toHaveTextContent('The TMDB movie loaded, but Person matching failed.');
      expect(screen.getByRole('heading', { name: 'Find movie' })).toBeInTheDocument();
    } finally {
      window.removeEventListener('unhandledrejection', unhandledRejection);
      consoleError.mockRestore();
    }
  });

  it('shows a useful empty state when TMDB search has no matches', async () => {
    render(
      <ImportModal
        initialTitle="Hard to Find"
        initialYear={2024}
        currentValues={{ title: '' }}
        mappedFields={['title']}
        searchMovies={async () => []}
        loadMovie={async () => movie}
        {...pendingLifecycle}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(screen.getByRole('status')).toHaveTextContent('No TMDB matches found.');
    expect(screen.getByRole('status')).toHaveTextContent('Try a different title, remove the year, or load a known TMDB ID.');
  });

  it('does not search TMDB without a title', async () => {
    const searchMovies = vi.fn(async () => []);
    render(
      <ImportModal
        initialTitle="   "
        initialYear={2024}
        currentValues={{ title: '' }}
        mappedFields={['title']}
        searchMovies={searchMovies}
        loadMovie={async () => movie}
        {...pendingLifecycle}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(searchMovies).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a movie title before searching, or load a known TMDB ID.');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('does not search TMDB with an invalid year', async () => {
    const searchMovies = vi.fn(async () => []);
    render(
      <ImportModal
        initialTitle="Example"
        initialYear={-1}
        currentValues={{ title: '' }}
        mappedFields={['title']}
        searchMovies={searchMovies}
        loadMovie={async () => movie}
        {...pendingLifecycle}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(searchMovies).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a positive whole-number year, or leave Year blank.');
  });

  it('does not load a malformed TMDB ID', async () => {
    const loadMovie = vi.fn(async () => movie);
    render(
      <ImportModal
        initialTitle="Example"
        initialYear={2024}
        currentValues={{ title: '' }}
        mappedFields={['title']}
        searchMovies={async () => []}
        loadMovie={loadMovie}
        {...pendingLifecycle}
      />,
    );

    await userEvent.type(screen.getByLabelText('TMDB ID'), '1e3');
    await userEvent.click(screen.getByRole('button', { name: 'Load movie by ID' }));

    expect(loadMovie).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a positive whole-number TMDB ID.');
  });

  it('searches, shows review, and reaches confirmation without writing early', async () => {
    const execute = vi.fn();
    render(
      <ImportModal
        initialTitle="Example"
        initialYear={2024}
        currentValues={{ title: '' }}
        mappedFields={['title', 'runtime', 'tmdbId', 'directors', 'actors', 'poster']}
        searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: 'Overview text', posterPath: null, posterUrl: null }]}
        loadMovie={async () => movie}
        prepare={capturePreparedPlan(execute)} resolve={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    await userEvent.click(screen.getByRole('button', { name: /Example Movie/i }));

    expect(screen.getByRole('heading', { name: 'Review changes' })).toBeInTheDocument();
    expect(screen.getByText('TMDB Movie Importer')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Review changes' }).closest('.movie-import-modal__scroll-body')).toBeInTheDocument();
    expect(screen.getByText('Choose which TMDB values to prepare. Nothing is saved or published until you save the DatoCMS movie.').closest('.movie-import-modal__scroll-body')).toBeInTheDocument();
    expect(screen.getByText('Field changes').closest('.movie-import-modal__scroll-body')).toBeInTheDocument();
    expect(execute).not.toHaveBeenCalled();

    document.documentElement.scrollTop = 240;
    document.body.scrollTop = 240;
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    const confirmHeading = screen.getByRole('heading', { name: 'Confirm import' });
    expect(confirmHeading).toBeInTheDocument();
    expect(confirmHeading.closest('.movie-import-modal__scroll-body')).toBeInTheDocument();
    expect(screen.getByText('Start the reviewed TMDB import for this movie form. DatoCMS will run the selected creates, uploads, and form updates after this modal closes.').closest('.movie-import-modal__scroll-body')).toBeInTheDocument();
    expect(screen.getByText('Import summary').closest('.movie-import-modal__scroll-body')).toBeInTheDocument();
    await waitFor(() => expect(confirmHeading).toHaveFocus());
    await waitFor(() => expect(document.documentElement.scrollTop).toBe(0));
    expect(document.body.scrollTop).toBe(0);
    expect(screen.getByText('Movie form')).toBeInTheDocument();
    expect(screen.getByText('Example Movie')).toBeInTheDocument();
    expect(screen.getByText('TMDB ID 123')).toBeInTheDocument();
    expect(screen.getByText('Import summary')).toBeInTheDocument();
    expect(screen.getByText('3 fields to update')).toBeInTheDocument();
    expect(screen.getByText('Title, Runtime, and TMDB ID')).toBeInTheDocument();
    expect(screen.getByText('2 draft Person records to create')).toBeInTheDocument();
    expect(screen.getByText('Director Name and Actor Name')).toBeInTheDocument();
    expect(screen.getByText('0 existing Person records to link')).toBeInTheDocument();
    expect(screen.getByText('No existing Person records')).toBeInTheDocument();
    expect(screen.getByText('0 unique images to upload')).toBeInTheDocument();
    expect(screen.getByText('No images selected')).toBeInTheDocument();
    expect(screen.getByText('What happens after you start')).toBeInTheDocument();
    expect(screen.getByText('Create selected draft Person records in DatoCMS.')).toBeInTheDocument();
    expect(screen.getByText('Upload selected poster and backdrop images.')).toBeInTheDocument();
    expect(screen.getByText('Apply selected TMDB values to the unsaved movie form.')).toBeInTheDocument();
    expect(screen.getByText('The movie record will remain unsaved until you save it in DatoCMS.')).toBeInTheDocument();
    expect(screen.getByText('If something fails after people or images are created, those drafts or uploads may remain in DatoCMS.')).toBeInTheDocument();
    const confirmActions = document.querySelector('.movie-import-modal__actions--confirm')!;
    expect(within(confirmActions as HTMLElement).getByText('3 fields selected')).toBeInTheDocument();
    expect(within(confirmActions as HTMLElement).getByText('0 images selected')).toBeInTheDocument();
    expect(within(confirmActions as HTMLElement).getByText('2 new people')).toBeInTheDocument();
    expect(within(confirmActions as HTMLElement).getByText('0 reused people')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start import' })).toBeInTheDocument();
  });

  it('shows preparation progress after starting an import', async () => {
    let reportProgress: ((event: ImportProgressEvent) => void) | undefined;
    let finishPreparation: ((result: PrepareImportResult) => void) | undefined;
    const resolve = vi.fn();
    const prepared = {
      fieldChanges: [],
      directors: [],
      actors: [],
      people: [],
      images: [],
      heroImage: null,
      otherImages: [],
      createdPeople: [],
      uploadedAssets: [],
    };
    const prepare = vi.fn(
      (_plan, onProgress) => new Promise<PrepareImportResult>((finish) => {
        reportProgress = onProgress;
        finishPreparation = finish;
      }),
    );

    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '' }} mappedFields={['title', 'poster']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movie} resolvePeople={async () => []} prepare={prepare} resolve={resolve} />);

    await reachReview();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start import' }));

    const heading = screen.getByRole('heading', { name: 'Importing movie' });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByRole('status')).toHaveTextContent('Preparing your TMDB import');
    expect(screen.queryByRole('button', { name: 'Back to review' })).not.toBeInTheDocument();

    await act(async () => {
      reportProgress?.({ phase: 'images', state: 'active', completed: 3, total: 5 });
    });

    expect(await screen.findByText('3 of 5 images uploaded')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Uploading images: 3 of 5 images uploaded.'));
    expect(screen.getByText('1 field selected')).toBeInTheDocument();
    expect(resolve).not.toHaveBeenCalled();

    finishPreparation?.({ status: 'success', prepared });

    await waitFor(() => expect(resolve).toHaveBeenCalledWith(prepared));
  });

  it('keeps the failed preparation visible and closes without applying it', async () => {
    const resolve = vi.fn();
    const prepare = vi.fn(async (): Promise<PrepareImportResult> => ({
      status: 'dependency_failed',
      failedPhase: 'images',
      message: 'The import could not finish while creating people or uploading images.',
      sideEffectsPossible: true,
      createdPeople: ['person-1'],
      uploadedAssets: ['upload-1'],
    }));

    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '' }} mappedFields={['title', 'poster']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movie} resolvePeople={async () => []} prepare={prepare} resolve={resolve} />);

    await reachReview();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start import' }));

    expect(await screen.findByText('Preparation failed')).toBeInTheDocument();
    expect(screen.getByText('The import could not finish while creating people or uploading images.')).toBeInTheDocument();
    expect(screen.getByText('Uploading images').closest('li')).toHaveClass('movie-import-modal__progress-phase--failed');
    expect(screen.getByText(/draft people or uploaded images may already exist/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(resolve).toHaveBeenCalledWith(null);
  });

  it('does not warn about cleanup after a lookup-only failure', async () => {
    const prepare = vi.fn(async (): Promise<PrepareImportResult> => ({
      status: 'dependency_failed',
      failedPhase: 'people_lookup',
      message: 'Person lookup failed.',
      sideEffectsPossible: false,
      createdPeople: [],
      uploadedAssets: [],
    }));

    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '' }} mappedFields={['title']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movie} resolvePeople={async () => []} prepare={prepare} resolve={vi.fn()} />);

    await reachReview();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start import' }));

    expect(await screen.findByText('Preparation failed')).toBeInTheDocument();
    expect(screen.getByText('Person lookup failed.')).toBeInTheDocument();
    expect(screen.queryByText(/draft people or uploaded images may already exist/i)).not.toBeInTheDocument();
  });

  it('shows active person and image preparation phases together', async () => {
    let reportProgress: ((event: ImportProgressEvent) => void) | undefined;
    const prepare = vi.fn(
      (_plan, onProgress) => new Promise<PrepareImportResult>(() => {
        reportProgress = onProgress;
      }),
    );

    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '' }} mappedFields={['title', 'poster']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movie} resolvePeople={async () => []} prepare={prepare} resolve={vi.fn()} />);

    await reachReview();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start import' }));

    await act(async () => {
      reportProgress?.({ phase: 'people_create', state: 'active', completed: 1, total: 2 });
      reportProgress?.({ phase: 'images', state: 'active', completed: 3, total: 5 });
    });

    expect(await screen.findByText('1 of 2 complete')).toBeInTheDocument();
    expect(screen.getByText('3 of 5 images uploaded')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Creating draft people: 1 of 2 complete.'));
    expect(screen.getByRole('status')).toHaveTextContent('Uploading images: 3 of 5 images uploaded.');
    expect(screen.getByText('Creating draft people').closest('li')).toHaveClass('movie-import-modal__progress-phase--active');
    expect(screen.getByText('Uploading images').closest('li')).toHaveClass('movie-import-modal__progress-phase--active');
  });

  it('frames the selected movie review with field, image, and people sections', async () => {
    render(
      <ImportModal
        initialTitle="Example"
        initialYear={2024}
        currentValues={{ title: '' }}
        mappedFields={['title', 'directors', 'actors', 'poster', 'heroImage', 'backdrops']}
        searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: 'Overview text', posterPath: null, posterUrl: null }]}
        loadMovie={async () => movie}
        {...pendingLifecycle}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    await userEvent.click(screen.getByRole('button', { name: /Use this for Example Movie/i }));

    expect(screen.getAllByText('Selected movie').length).toBeGreaterThan(0);
    expect(screen.getByText('Example Movie (2024)')).toBeInTheDocument();
    const selectedMovie = screen.getByRole('article', { name: 'Selected movie' });
    expect(within(selectedMovie).getByText('Selected movie')).toBeInTheDocument();
    expect(within(selectedMovie).getByText('Example Movie')).toBeInTheDocument();
    expect(within(selectedMovie).getByText('Selected movie').closest('.movie-import-modal__summary-heading')).toContainElement(within(selectedMovie).getByRole('heading', { name: 'Example Movie' }));
    expect(within(selectedMovie).getByRole('img', { name: 'Example Movie poster' })).toHaveAttribute('src', 'https://image.tmdb.org/t/p/original/poster.jpg');
    expect(screen.getByText('PG-13')).toBeInTheDocument();
    expect(screen.getByText('125 min')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Field changes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Images' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'People' })).toBeInTheDocument();
    expect(screen.getByText('1 field selected')).toBeInTheDocument();
    expect(screen.getByText('0 images selected')).toBeInTheDocument();
    expect(screen.getByText('2 new people')).toBeInTheDocument();
    expect(screen.getByText('0 reused people')).toBeInTheDocument();
    expect(screen.getByText('1 field available · 1 selected')).toBeInTheDocument();
    expect(screen.getByText('No current values will be overwritten · 1 empty field will be filled')).toBeInTheDocument();
    const fieldChangesSection = screen.getByRole('heading', { name: 'Field changes' }).closest('section')!;
    expect(within(fieldChangesSection).getByRole('table', { name: 'Field changes' })).toBeInTheDocument();
    expect(within(fieldChangesSection).getByRole('columnheader', { name: 'Field' })).toBeInTheDocument();
    expect(within(fieldChangesSection).getByRole('columnheader', { name: 'Current' })).toBeInTheDocument();
    expect(within(fieldChangesSection).getByRole('columnheader', { name: 'Proposed' })).toBeInTheDocument();
    expect(screen.queryByText('Fills empty field')).not.toBeInTheDocument();
    expect(screen.getAllByText('Title').length).toBeGreaterThan(0);
    expect(screen.getByText('Poster')).toBeInTheDocument();
    expect(screen.getByText('Backdrop images')).toBeInTheDocument();
    const imageStatus = screen.getByRole('status', { name: 'Image import impact' });
    expect(imageStatus).toHaveTextContent('No image destinations selected.');
    expect(imageStatus).toHaveAttribute('aria-live', 'polite');
    expect(imageStatus).toHaveAttribute('aria-atomic', 'true');
    expect(screen.getByRole('radio', { name: 'Do not import a Poster' })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Use as Poster/i })).not.toBeChecked();
    expect(screen.getByText('Assign each backdrop to Hero Image, Other Images, or neither. One image cannot be used for both destinations.')).toBeInTheDocument();
    expect(screen.getByText('Directors')).toBeInTheDocument();
    expect(screen.getByText('Actors')).toBeInTheDocument();
    expect(screen.getByText('2 draft Person records will be prepared after confirmation.')).toBeInTheDocument();
    expect(screen.getAllByText('Will create draft')).toHaveLength(2);
    expect(screen.getAllByText('A new draft Person record will be created after confirmation.')).toHaveLength(2);
  });
});

async function reachReview() {
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));
  await userEvent.click(screen.getByRole('button', { name: /Example Movie/i }));
}

describe('ImportModal data flow', () => {
  it('keeps shared backdrop destinations exclusive through the import plan', async () => {
    const execute = vi.fn();
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', poster: null, backdrops: [] }} mappedFields={['title', 'poster', 'heroImage', 'backdrops']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movieWithBackdrops} resolvePeople={async () => []} prepare={capturePreparedPlan(execute)} resolve={vi.fn()} />);

    await reachReview();
    expect(screen.getByText('Choose exactly which TMDB artwork destinations to import.')).toBeInTheDocument();
    expect(screen.getByText('Assign each backdrop to Hero Image, Other Images, or neither. One image cannot be used for both destinations.')).toBeInTheDocument();
    expect(screen.getByText('No image destinations selected.')).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /Backdrop option/i })).toHaveLength(2);
    const candidateImages = screen.getAllByRole('img', { name: /option \d+/i });
    expect(candidateImages.length).toBeGreaterThan(0);
    candidateImages.forEach((image) => {
      expect(image.parentElement).toHaveClass('movie-import-modal__image-canvas');
    });
    expect(screen.getByRole('radio', { name: 'Do not import a Poster' })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Use as Poster/i })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Do not import a Hero Image' })).toBeChecked();
    const heroOptions = screen.getAllByRole('radio', { name: /Use as Hero Image/i });
    const otherImageOptions = screen.getAllByRole('checkbox', { name: /Add to Other Images/i });
    expect(heroOptions[0]).not.toBeChecked();
    expect(heroOptions[1]).not.toBeChecked();
    expect(otherImageOptions[0]).not.toBeChecked();
    expect(otherImageOptions[1]).not.toBeChecked();
    expect(screen.getAllByText('Other Images').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('radio', { name: /Use as Poster/i }));
    await userEvent.click(heroOptions[0]);
    await userEvent.click(otherImageOptions[1]);
    expect(screen.getByText('1 poster, 1 Hero Image, and 1 Other Image selected for upload after confirmation.')).toBeInTheDocument();

    await userEvent.click(otherImageOptions[0]);
    expect(otherImageOptions[0]).toBeChecked();
    expect(heroOptions[0]).not.toBeChecked();

    await userEvent.click(heroOptions[1]);
    expect(heroOptions[1]).toBeChecked();
    expect(otherImageOptions[1]).not.toBeChecked();

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start import' }));

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls[0][0].heroImageToUpload.providerImageId).toBe('/backdrop-2.jpg');
    expect(execute.mock.calls[0][0].otherImagesToUpload.map((image: NormalizedMovie['images'][number]) => image.providerImageId)).toEqual(['/backdrop-1.jpg']);
    expect(execute.mock.calls[0][0].assetsToUpload.filter((image: NormalizedMovie['images'][number]) => image.type === 'backdrop').map((image: NormalizedMovie['images'][number]) => image.providerImageId)).toEqual(['/backdrop-2.jpg', '/backdrop-1.jpg']);
  });

  it('keeps an explicitly selected Hero Image out of Other Images in the import plan', async () => {
    const execute = vi.fn();
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', poster: null, backdrops: [] }} mappedFields={['title', 'poster', 'heroImage', 'backdrops']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movieWithBackdrops} resolvePeople={async () => []} prepare={capturePreparedPlan(execute)} resolve={vi.fn()} />);

    await reachReview();
    await userEvent.click(screen.getAllByRole('radio', { name: /Use as Hero Image/i })[0]);
    await userEvent.click(screen.getAllByRole('checkbox', { name: /Add to Other Images/i })[1]);
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start import' }));

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls[0][0].heroImageToUpload.providerImageId).toBe('/backdrop-1.jpg');
    expect(execute.mock.calls[0][0].otherImagesToUpload.map((image: NormalizedMovie['images'][number]) => image.providerImageId)).toEqual(['/backdrop-2.jpg']);
  });

  it('shows only the first 10 poster candidates and first 10 backdrop candidates', async () => {
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', poster: null, backdrops: [] }} mappedFields={['title', 'poster', 'heroImage', 'backdrops']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movieWithManyImages} resolvePeople={async () => []} {...pendingLifecycle} />);

    await reachReview();
    expect(screen.getAllByRole('img', { name: /Poster option/i })).toHaveLength(10);
    expect(screen.queryByRole('img', { name: 'Poster option 11' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('radio', { name: /Use as Hero Image/i })).toHaveLength(10);
    expect(screen.getAllByRole('checkbox', { name: /Add to Other Images/i })).toHaveLength(10);
    expect(screen.queryByRole('img', { name: 'Backdrop option 11' })).not.toBeInTheDocument();
  });

  it('labels missing image language metadata as NA', async () => {
    const movieWithMissingBackdropLanguage: NormalizedMovie = {
      ...movieWithBackdrops,
      images: movieWithBackdrops.images.map((image, index) => (
        index === 1 ? { ...image, language: null } : image
      )),
    };

    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', heroImage: null, backdrops: [] }} mappedFields={['title', 'heroImage', 'backdrops']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movieWithMissingBackdropLanguage} resolvePeople={async () => []} {...pendingLifecycle} />);

    await reachReview();

    expect(screen.getByText('TMDB · 1920 × 1080 · NA')).toBeInTheDocument();
    expect(screen.queryByText(/No language metadata/i)).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Use as Hero Image: backdrop option 1, tmdb:\/backdrop-1\.jpg, TMDB, 1920 × 1080, No language metadata/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Add to Other Images: backdrop option 1, tmdb:\/backdrop-1\.jpg, TMDB, 1920 × 1080, No language metadata/i })).toBeInTheDocument();
  });

  it('allows editors to skip importing a hero image while keeping other image choices', async () => {
    const execute = vi.fn();
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', poster: null, backdrops: [] }} mappedFields={['title', 'poster', 'heroImage', 'backdrops']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movieWithBackdrops} resolvePeople={async () => []} prepare={capturePreparedPlan(execute)} resolve={vi.fn()} />);

    await reachReview();
    await userEvent.click(screen.getByRole('radio', { name: /Use as Poster/i }));
    await userEvent.click(screen.getAllByRole('checkbox', { name: /Add to Other Images/i })[1]);
    await userEvent.click(screen.getByRole('radio', { name: 'Do not import a Hero Image' }));
    expect(screen.getByText('1 poster and 1 Other Image selected for upload after confirmation.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start import' }));

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls[0][0].heroImageToUpload).toBeNull();
    expect(execute.mock.calls[0][0].otherImagesToUpload.map((image: NormalizedMovie['images'][number]) => image.providerImageId)).toEqual(['/backdrop-2.jpg']);
  });

  it('shows only Hero Image controls when only the hero image field is mapped', async () => {
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', heroImage: null }} mappedFields={['title', 'heroImage']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movieWithBackdrops} resolvePeople={async () => []} {...pendingLifecycle} />);

    await reachReview();
    expect(screen.getByText('Assign each backdrop to Hero Image, Other Images, or neither. One image cannot be used for both destinations.')).toBeInTheDocument();
    expect(screen.getAllByRole('radio', { name: /Use as Hero Image/i })).toHaveLength(2);
    expect(screen.queryByRole('checkbox', { name: /Add to Other Images/i })).not.toBeInTheDocument();
  });

  it('shows only Other Images controls when only the other images field is mapped', async () => {
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', backdrops: [] }} mappedFields={['title', 'backdrops']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movieWithBackdrops} resolvePeople={async () => []} {...pendingLifecycle} />);

    await reachReview();
    expect(screen.getByText('Assign each backdrop to Hero Image, Other Images, or neither. One image cannot be used for both destinations.')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Use as Hero Image/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('checkbox', { name: /Add to Other Images/i })).toHaveLength(2);
  });

  it('keeps an existing hero image untouched when only other images are selected', async () => {
    const execute = vi.fn();
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', heroImage: { upload_id: 'existing-hero' }, backdrops: [] }} mappedFields={['title', 'heroImage', 'backdrops']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movieWithBackdrops} resolvePeople={async () => []} prepare={capturePreparedPlan(execute)} resolve={vi.fn()} />);

    await reachReview();
    const otherImageOptions = screen.getAllByRole('checkbox', { name: /Add to Other Images/i });
    await userEvent.click(otherImageOptions[0]);
    await userEvent.click(otherImageOptions[1]);
    expect(screen.getByText('2 Other Images selected for upload after confirmation.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start import' }));

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls[0][0].heroImageToUpload).toBeNull();
    expect(execute.mock.calls[0][0].otherImagesToUpload.map((image: NormalizedMovie['images'][number]) => image.providerImageId)).toEqual(['/backdrop-1.jpg', '/backdrop-2.jpg']);
  });

  it('keeps image provider identity when selecting candidates with the same provider image ID', async () => {
    const execute = vi.fn();
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', poster: null, backdrops: [] }} mappedFields={['title', 'poster', 'heroImage', 'backdrops']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movieWithProviderCollisionImages} resolvePeople={async () => []} prepare={capturePreparedPlan(execute)} resolve={vi.fn()} />);

    await reachReview();
    const heroOptions = screen.getAllByRole('radio', { name: /Use as Hero Image/i });
    await userEvent.click(heroOptions[1]);
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start import' }));

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls[0][0].heroImageToUpload).toMatchObject({ providerKey: 'future', providerImageId: '/shared-backdrop.jpg' });
  });

  it('creates resolutions for imported directors and actors before confirming', async () => {
    const execute = vi.fn();
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', poster: null }} mappedFields={['title', 'directors', 'actors', 'poster']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movie} resolvePeople={async () => []} prepare={capturePreparedPlan(execute)} resolve={vi.fn()} />);

    await reachReview();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start import' }));

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls[0][0]).toMatchObject({
      directors: movie.directors,
      actors: movie.actors,
      peopleToCreate: [
        { candidateTmdbId: 10, candidateRole: 'director', name: 'Director Name', source: 'auto' },
        { candidateTmdbId: 20, candidateRole: 'actor', name: 'Actor Name', source: 'auto' },
      ],
      assetsToUpload: [],
    });
  });

  it('excludes unmapped people and image destinations from the review plan', async () => {
    const execute = vi.fn();
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', poster: null }} mappedFields={['title']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movieWithBackdrops} resolvePeople={async () => []} prepare={capturePreparedPlan(execute)} resolve={vi.fn()} />);

    await reachReview();
    expect(screen.queryByRole('heading', { name: 'Images' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'People' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start import' }));

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls[0][0]).toMatchObject({
      directors: [],
      actors: [],
      peopleToCreate: [],
      peopleToReuse: [],
      heroImageToUpload: null,
      otherImagesToUpload: [],
      assetsToUpload: [],
    });
  });

  it('blocks confirmation for an ambiguous person until the editor resolves it', async () => {
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '' }} mappedFields={['title', 'directors']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movie} resolvePeople={async () => [{ id: 'person-a', name: 'Director Name', tmdbId: null }, { id: 'person-b', name: 'Director Name', tmdbId: null }]} {...pendingLifecycle} />);

    await reachReview();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Resolve 1 person before continuing.');
    const resolutionControl = screen.getByLabelText('Resolve director: Director Name');
    expect(resolutionControl.closest('[data-dato-component="SelectField"]')).not.toBeNull();
    expect(within(resolutionControl.closest('.movie-import-modal__person-row')!).getByText('Choose whether to reuse a match or create a new draft before continuing.')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Resolve director: Director Name'), 'create');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('resolves only the selected role when one TMDB person appears in multiple people rows', async () => {
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '' }} mappedFields={['title', 'directors', 'actors']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movieWithSamePersonInTwoRoles} resolvePeople={async () => [{ id: 'person-a', name: 'Multi-Hyphenate Person', tmdbId: null }, { id: 'person-b', name: 'Multi-Hyphenate Person', tmdbId: null }]} {...pendingLifecycle} />);

    await reachReview();
    const directorResolutionControl = screen.getByLabelText('Resolve director: Multi-Hyphenate Person');
    const actorResolutionControl = screen.getByLabelText('Resolve actor: Multi-Hyphenate Person');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

    await userEvent.selectOptions(directorResolutionControl, 'create');

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(within(actorResolutionControl.closest('.movie-import-modal__person-row')!).getByText('Choose whether to reuse a match or create a new draft before continuing.')).toBeInTheDocument();
  });

  it('keeps mixed manual create and reuse decisions separate for the same TMDB person in different roles', async () => {
    const execute = vi.fn();
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '' }} mappedFields={['title', 'directors', 'actors']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movieWithSamePersonInTwoRoles} resolvePeople={async () => [{ id: 'person-a', name: 'Multi-Hyphenate Person', tmdbId: null }, { id: 'person-b', name: 'Multi-Hyphenate Person', tmdbId: null }]} prepare={capturePreparedPlan(execute)} resolve={vi.fn()} />);

    await reachReview();
    const directorResolutionControl = screen.getByLabelText('Resolve director: Multi-Hyphenate Person');
    const actorResolutionControl = screen.getByLabelText('Resolve actor: Multi-Hyphenate Person');
    const directorRow = directorResolutionControl.closest('.movie-import-modal__person-row') as HTMLElement;
    const actorRow = actorResolutionControl.closest('.movie-import-modal__person-row') as HTMLElement;

    await userEvent.selectOptions(directorResolutionControl, 'create');
    await userEvent.selectOptions(actorResolutionControl, 'reuse:person-b');

    expect(within(directorRow).getByText('You chose to create a new draft Person after confirmation.')).toBeInTheDocument();
    expect(within(actorRow).getByText('You chose to reuse an existing Person record.')).toBeInTheDocument();
    expect(within(actorRow).queryByText('Matched by TMDB ID.')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start import' }));

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls[0][0].peopleToCreate).toContainEqual({ candidateTmdbId: 99, candidateRole: 'director', name: 'Multi-Hyphenate Person', source: 'manual' });
    expect(execute.mock.calls[0][0].peopleToReuse).toContainEqual({ candidateTmdbId: 99, candidateRole: 'actor', recordId: 'person-b', name: 'Multi-Hyphenate Person', source: 'manual' });
  });

  it('summarizes overwrite risk and lets editors clear selected field changes in one action', async () => {
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: 'Existing title', runtime: null }} mappedFields={['title', 'runtime']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movie} resolvePeople={async () => []} {...pendingLifecycle} />);

    await reachReview();
    expect(screen.getByText('No current values will be overwritten · 1 empty field will be filled')).toBeInTheDocument();
    expect(screen.queryByText('Overwrites value')).not.toBeInTheDocument();
    expect(screen.queryByText('Fills empty field')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Use proposed Title' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Use proposed Runtime' })).toBeChecked();
    const runtimeRow = screen.getByRole('checkbox', { name: 'Use proposed Runtime' }).closest('tr') as HTMLElement;
    expect(within(runtimeRow).getByText('Empty')).toHaveClass('movie-import-modal__field-placeholder');

    await userEvent.click(screen.getByRole('button', { name: 'Select all' }));
    expect(screen.getByRole('checkbox', { name: 'Use proposed Title' })).toBeChecked();
    expect(screen.getByText('1 current value will be overwritten · 1 empty field will be filled')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));

    expect(screen.getByRole('checkbox', { name: 'Use proposed Title' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Use proposed Runtime' })).not.toBeChecked();
    expect(screen.getByText('2 fields available · 0 selected')).toBeInTheDocument();
    expect(screen.getByText('No current values will be overwritten · no empty fields will be filled')).toBeInTheDocument();
  });

  it('renders Trailer between Field changes and Images when the trailer field is mapped', async () => {
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', trailer: null, poster: null }} mappedFields={['title', 'trailer', 'poster']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movieWithTrailer} resolvePeople={async () => []} {...pendingLifecycle} />);

    await reachReview();

    const fieldChangesSection = document.getElementById('field-changes');
    const trailerSection = document.getElementById('trailer');
    const imagesSection = document.getElementById('images');

    expect(screen.getByRole('heading', { name: 'Trailer' })).toBeInTheDocument();
    expect(fieldChangesSection).not.toBeNull();
    expect(trailerSection).not.toBeNull();
    expect(imagesSection).not.toBeNull();
    expect(fieldChangesSection!.compareDocumentPosition(trailerSection!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(trailerSection!.compareDocumentPosition(imagesSection!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('keeps Trailer out of review when the trailer field is not mapped', async () => {
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', poster: null }} mappedFields={['title', 'poster']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movieWithTrailer} resolvePeople={async () => []} {...pendingLifecycle} />);

    await reachReview();

    expect(screen.queryByRole('heading', { name: 'Trailer' })).not.toBeInTheDocument();
    expect(document.getElementById('trailer')).toBeNull();
  });

  it('starts trailer selected for an empty current field and keeps scalar bulk actions independent', async () => {
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: 'Existing title', runtime: null, trailer: null }} mappedFields={['title', 'runtime', 'trailer']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movieWithTrailer} resolvePeople={async () => []} {...pendingLifecycle} />);

    await reachReview();

    const trailerToggle = screen.getByRole('checkbox', { name: 'Import Official Trailer' });
    const reviewActions = document.querySelector('.movie-import-modal__actions--sticky');

    expect(trailerToggle).toBeChecked();
    expect(screen.getByText('Published Jan 1, 2024')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Use proposed Title' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Use proposed Runtime' })).toBeChecked();
    expect(within(reviewActions as HTMLElement).getByText('1 field selected')).toBeInTheDocument();
    expect(within(reviewActions as HTMLElement).getByText('0 images selected')).toBeInTheDocument();
    expect(within(reviewActions as HTMLElement).getByText('0 new people')).toBeInTheDocument();
    expect(within(reviewActions as HTMLElement).getByText('0 reused people')).toBeInTheDocument();
    expect(reviewActions).toHaveTextContent('1 field selected');
    expect(reviewActions).not.toHaveTextContent('Trailer selected');
    expect(reviewActions).not.toHaveTextContent('Trailer unchanged');
    expect(screen.getByLabelText('1 field selected, 0 images selected, 0 new people, 0 reused people')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.getByRole('checkbox', { name: 'Use proposed Runtime' })).not.toBeChecked();
    expect(trailerToggle).toBeChecked();

    await userEvent.click(screen.getByRole('button', { name: 'Select all' }));
    expect(screen.getByRole('checkbox', { name: 'Use proposed Title' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Use proposed Runtime' })).toBeChecked();
    expect(trailerToggle).toBeChecked();
  });

  it('starts trailer unselected for a replacement current value', async () => {
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', trailer: { provider: 'youtube', provider_uid: 'existing-youtube-id', title: 'Editorial trailer', width: 1280, height: 720, thumbnail_url: 'https://img.youtube.com/vi/existing/hqdefault.jpg', url: 'https://www.youtube.com/watch?v=existing-youtube-id' } }} mappedFields={['title', 'trailer']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movieWithTrailer} resolvePeople={async () => []} {...pendingLifecycle} />);

    await reachReview();
    expect(screen.getByRole('checkbox', { name: 'Import Official Trailer' })).not.toBeChecked();
  });

  it('disables trailer review when the current provider and id already match', async () => {
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', trailer: datoExternalVideoValue(movieWithTrailer.trailer!) }} mappedFields={['title', 'trailer']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movieWithTrailer} resolvePeople={async () => []} {...pendingLifecycle} />);

    await reachReview();
    expect(screen.getByText('Already current trailer')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Import Official Trailer' })).toBeDisabled();
  });

  it('shows the no-result trailer copy when TMDB has no candidate', async () => {
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', trailer: { provider: 'youtube', provider_uid: 'existing-youtube-id', title: 'Editorial trailer', width: 1280, height: 720, thumbnail_url: 'https://img.youtube.com/vi/existing/hqdefault.jpg', url: 'https://www.youtube.com/watch?v=existing-youtube-id' } }} mappedFields={['title', 'trailer']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movie} resolvePeople={async () => []} {...pendingLifecycle} />);

    await reachReview();

    expect(screen.getByText('No official English YouTube trailer found.')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Import Official Trailer' })).not.toBeInTheDocument();
  });

  it('renders a structured-text current description as readable text', async () => {
    render(
      <ImportModal
        initialTitle="Example"
        initialYear={2024}
        currentValues={{
          description: [
            { type: 'paragraph', children: [{ type: 'span', value: 'Existing overview.' }] },
            { type: 'paragraph', children: [{ type: 'span', value: 'Second paragraph.' }] },
          ],
        }}
        mappedFields={['description']}
        searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]}
        loadMovie={async () => movie}
        resolvePeople={async () => []}
        {...pendingLifecycle}
      />,
    );

    await reachReview();
    const descriptionRow = screen.getByRole('checkbox', { name: 'Use proposed Description' }).closest('tr') as HTMLElement;
    expect(within(descriptionRow).getByText('Existing overview. Second paragraph.')).toBeInTheDocument();
    expect(within(descriptionRow).queryByText('[object Object],[object Object]')).not.toBeInTheDocument();
  });

  it('renders a Slate current description from DatoCMS form values as readable text', async () => {
    render(
      <ImportModal
        initialTitle="Example"
        initialYear={2024}
        currentValues={{
          description: [
            { type: 'paragraph', children: [{ text: 'Existing Slate overview.' }] },
            { type: 'paragraph', children: [{ text: 'Second Slate paragraph.' }] },
          ],
        }}
        mappedFields={['description']}
        searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]}
        loadMovie={async () => movie}
        resolvePeople={async () => []}
        {...pendingLifecycle}
      />,
    );

    await reachReview();
    const descriptionRow = screen.getByRole('checkbox', { name: 'Use proposed Description' }).closest('tr') as HTMLElement;
    expect(within(descriptionRow).getByText('Existing Slate overview. Second Slate paragraph.')).toBeInTheDocument();
    expect(within(descriptionRow).queryByText('Empty')).not.toBeInTheDocument();
  });

  it('treats an empty structured-text current description as empty in review', async () => {
    render(
      <ImportModal
        initialTitle="Example"
        initialYear={2024}
        currentValues={{
          description: {
            schema: 'dast',
            document: {
              type: 'root',
              children: [{ type: 'paragraph', children: [] }],
            },
          },
        }}
        mappedFields={['description']}
        searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]}
        loadMovie={async () => movie}
        resolvePeople={async () => []}
        {...pendingLifecycle}
      />,
    );

    await reachReview();
    const descriptionCheckbox = screen.getByRole('checkbox', { name: 'Use proposed Description' });
    const descriptionRow = descriptionCheckbox.closest('tr') as HTMLElement;
    expect(descriptionCheckbox).toBeChecked();
    expect(within(descriptionRow).getByText('Empty')).toHaveClass('movie-import-modal__field-placeholder');
    expect(within(descriptionRow).queryByText('[object Object]')).not.toBeInTheDocument();
  });

  it('lets editors select a field change from the proposed value cell', async () => {
    render(
      <ImportModal
        initialTitle="Example"
        initialYear={2024}
        currentValues={{ title: 'Existing title', runtime: null }}
        mappedFields={['title', 'runtime']}
        searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]}
        loadMovie={async () => movie}
        resolvePeople={async () => []}
        {...pendingLifecycle}
      />,
    );

    await reachReview();

    const titleCheckbox = screen.getByRole('checkbox', { name: 'Use proposed Title' });
    expect(titleCheckbox).not.toBeChecked();
    expect(screen.queryByRole('button', { name: 'Apply proposed Title value' })).not.toBeInTheDocument();

    const titleRow = titleCheckbox.closest('tr') as HTMLElement;
    const proposedChoice = within(titleRow).getByText('Example Movie').closest('.movie-import-modal__field-table-choice') as HTMLElement;
    await userEvent.click(proposedChoice);

    expect(titleCheckbox).toBeChecked();
  });

  it('lets keyboard users toggle a proposed field change from the checkbox', async () => {
    render(
      <ImportModal
        initialTitle="Example"
        initialYear={2024}
        currentValues={{ title: 'Existing title' }}
        mappedFields={['title']}
        searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]}
        loadMovie={async () => movie}
        resolvePeople={async () => []}
        {...pendingLifecycle}
      />,
    );

    await reachReview();

    const titleCheckbox = screen.getByRole('checkbox', { name: 'Use proposed Title' });
    titleCheckbox.focus();
    expect(titleCheckbox).toHaveFocus();
    expect(titleCheckbox).not.toBeChecked();

    await userEvent.keyboard('[Space]');

    expect(titleCheckbox).toBeChecked();
  });


  it('does not expose a clickable proposed cell for unavailable TMDB values', async () => {
    render(
      <ImportModal
        initialTitle="Example"
        initialYear={2024}
        currentValues={{ tagline: 'Existing tagline' }}
        mappedFields={['tagline']}
        searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]}
        loadMovie={async () => ({ ...movie, tagline: null })}
        resolvePeople={async () => []}
        {...pendingLifecycle}
      />,
    );

    await reachReview();

    expect(screen.getByText('TMDB did not provide a value')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Use proposed Tagline' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Apply proposed Tagline value' })).not.toBeInTheDocument();
  });

  it('includes selected images and excludes images deselected in review', async () => {
    const execute = vi.fn();
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', poster: null }} mappedFields={['title', 'poster']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movie} resolvePeople={async () => []} prepare={capturePreparedPlan(execute)} resolve={vi.fn()} />);

    await reachReview();
    expect(screen.getByRole('radio', { name: 'Do not import a Poster' })).toBeChecked();
    const posterOption = screen.getByRole('radio', { name: /Use as Poster/i });
    expect(posterOption).not.toBeChecked();
    expect(screen.getByRole('img', { name: 'Poster option 1' })).toHaveAttribute('loading', 'lazy');
    expect(screen.getByRole('img', { name: 'Poster option 1' })).toHaveAttribute('width', '120');
    expect(screen.getByRole('img', { name: 'Poster option 1' })).toHaveAttribute('height', '180');
    await userEvent.click(posterOption);
    expect(posterOption).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: 'Do not import a Poster' }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start import' }));

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls[0][0].assetsToUpload).toEqual([]);
  });

  it('only displays English-language posters without preselecting one', async () => {
    const execute = vi.fn();
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', poster: null }} mappedFields={['title', 'poster']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movieWithNonEnglishPosters} resolvePeople={async () => []} prepare={capturePreparedPlan(execute)} resolve={vi.fn()} />);

    await reachReview();

    expect(screen.getByRole('img', { name: 'Example Movie poster' })).toHaveAttribute('src', 'https://image.tmdb.org/t/p/original/english-poster.jpg');
    expect(screen.getByRole('radio', { name: 'Do not import a Poster' })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Use as Poster/i })).not.toBeChecked();
    expect(screen.getByRole('img', { name: 'Poster option 1' })).toHaveAttribute('src', 'https://image.tmdb.org/t/p/original/english-poster.jpg');
    expect(screen.queryByText('textless-poster.jpg')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start import' }));

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls[0][0].assetsToUpload).toEqual([]);
  });

  it('loads the existing TMDB ID directly for refresh mode', async () => {
    const loadMovie = vi.fn(async () => movie);
    render(<ImportModal initialTitle="Example" initialYear={2024} initialTmdbId={123} currentValues={{ title: '' }} mappedFields={['title']} searchMovies={async () => []} loadMovie={loadMovie} resolvePeople={async () => []} {...pendingLifecycle} />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Review changes' })).toBeInTheDocument());
    expect(loadMovie).toHaveBeenCalledWith(123);
  });

  it('loads a movie from a TMDB ID entered in find mode', async () => {
    const loadMovie = vi.fn(async () => movie);
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '' }} mappedFields={['title']} searchMovies={async () => []} loadMovie={loadMovie} resolvePeople={async () => []} {...pendingLifecycle} />);

    await userEvent.type(screen.getByLabelText('TMDB ID'), '123');
    await userEvent.click(screen.getByRole('button', { name: 'Load movie by ID' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Review changes' })).toBeInTheDocument());
    expect(loadMovie).toHaveBeenCalledWith(123);
  });

  it('shows an auth-specific message when TMDB rejects the read token while loading by ID', async () => {
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '' }} mappedFields={['title']} searchMovies={async () => []} loadMovie={async () => {
      throw new TmdbError('TMDB read token is invalid or not allowed.', 'auth');
    }} resolvePeople={async () => []} {...pendingLifecycle} />);

    await userEvent.type(screen.getByLabelText('TMDB ID'), '123');
    await userEvent.click(screen.getByRole('button', { name: 'Load movie by ID' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('TMDB read token is invalid or not allowed.');
  });

  it('distinguishes person matching failures from TMDB ID loading failures', async () => {
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '' }} mappedFields={['title', 'directors']} searchMovies={async () => []} loadMovie={async () => movie} prepareImages={async (images) => images} resolvePeople={async () => {
      throw new Error('DatoCMS item list permission is unavailable.');
    }} {...pendingLifecycle} />);

    await userEvent.type(screen.getByLabelText('TMDB ID'), '123');
    await userEvent.click(screen.getByRole('button', { name: 'Load movie by ID' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The TMDB movie loaded, but Person matching failed.');
    expect(screen.getByRole('heading', { name: 'Find movie' })).toBeInTheDocument();
  });

  it('falls back to raw artwork and logs safe diagnostics when artwork preparation fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const artworkFailure = {
      message: 'Fingerprint request failed',
      imageUrl: 'https://image.tmdb.org/t/p/original/secret-image.jpg',
      request: {
        headers: {
          authorization: 'Bearer secret-artwork-token',
        },
      },
    };

    try {
      render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', poster: null, heroImage: null, backdrops: [] }} mappedFields={['title', 'poster', 'heroImage', 'backdrops']} searchMovies={async () => []} loadMovie={async () => movieWithBackdrops} prepareImages={async () => {
        throw artworkFailure;
      }} resolvePeople={async () => []} {...pendingLifecycle} />);

      await userEvent.type(screen.getByLabelText('TMDB ID'), '123');
      await userEvent.click(screen.getByRole('button', { name: 'Load movie by ID' }));

      expect(await screen.findByRole('heading', { name: 'Review changes' })).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'Example Movie poster' })).toHaveAttribute('src', movieWithBackdrops.images[0]!.originalUrl);
      expect(screen.getAllByRole('img', { name: 'Backdrop option 1' })).toHaveLength(1);
      expect(screen.getAllByRole('img', { name: 'Backdrop option 1' })[0]).toHaveAttribute('src', movieWithBackdrops.images[1]!.originalUrl);
      expect(screen.getAllByRole('img', { name: 'Backdrop option 2' })).toHaveLength(1);
      expect(screen.getAllByRole('img', { name: 'Backdrop option 2' })[0]).toHaveAttribute('src', movieWithBackdrops.images[2]!.originalUrl);
      await waitFor(() => expect(consoleError).toHaveBeenCalledWith(
        'TMDB Movie Importer artwork preparation failed',
        { message: '[object Object]' },
      ));
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain('secret-image.jpg');
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain('secret-artwork-token');
    } finally {
      consoleError.mockRestore();
    }
  });

  it('logs token-safe details when person matching fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const richError = {
      name: 'DatoCmsClientError',
      message: 'Person list failed',
      request: {
        headers: {
          authorization: 'Bearer secret-current-user-token',
        },
      },
    };

    try {
      render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '' }} mappedFields={['title', 'directors']} searchMovies={async () => []} loadMovie={async () => movie} resolvePeople={async () => {
        throw richError;
      }} {...pendingLifecycle} />);

      await userEvent.type(screen.getByLabelText('TMDB ID'), '123');
      await userEvent.click(screen.getByRole('button', { name: 'Load movie by ID' }));

      await waitFor(() => expect(consoleError).toHaveBeenCalledWith(
        'TMDB Movie Importer person matching failed',
        { message: '[object Object]' },
      ));
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain('secret-current-user-token');
    } finally {
      consoleError.mockRestore();
    }
  });

  it('disables direct TMDB ID loading while loading a movie', async () => {
    let finishLoad: ((value: NormalizedMovie) => void) | undefined;
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '' }} mappedFields={['title']} searchMovies={async () => []} loadMovie={() => new Promise((resolve) => {
      finishLoad = resolve;
    })} resolvePeople={async () => []} {...pendingLifecycle} />);

    await userEvent.type(screen.getByLabelText('TMDB ID'), '123');
    await userEvent.click(screen.getByRole('button', { name: 'Load movie by ID' }));

    expect(screen.getByRole('button', { name: 'Loading movie' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
    finishLoad?.(movie);
  });

  it('shows preparation progress while the import plan is being prepared', async () => {
    let finishPreparation: (() => void) | undefined;
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '' }} mappedFields={['title']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movie} resolvePeople={async () => []} prepare={() => new Promise<PrepareImportResult>((resolve) => {
      finishPreparation = () => resolve({ status: 'dependency_failed', failedPhase: 'images', message: 'Image upload failed.', sideEffectsPossible: true, createdPeople: [], uploadedAssets: [] });
    })} resolve={vi.fn()} />);

    await reachReview();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start import' }));

    expect(screen.getByRole('heading', { name: 'Importing movie' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Preparing your TMDB import');
    finishPreparation?.();
  });

  it('uses safe copy if import preparation throws', async () => {
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '' }} mappedFields={['title']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movie} resolvePeople={async () => []} prepare={async () => {
      throw new Error('ctx.resolve failed');
    }} resolve={vi.fn()} />);

    await reachReview();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start import' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The import could not finish while creating people or uploading images.');
  });

  it('preserves a safe configuration error if import preparation throws', async () => {
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '' }} mappedFields={['title']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movie} resolvePeople={async () => []} prepare={async () => {
      throw new ImportConfigurationError([{
        code: 'movie_field_missing',
        message: 'Movie field title was not found.',
        severity: 'error',
      }]);
    }} resolve={vi.fn()} />);

    await reachReview();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start import' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Import did not run because the configuration is incomplete: Movie field title was not found.');
  });

  it('keeps custom review controls at accessible touch-target sizes', async () => {
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', poster: null }} mappedFields={['title', 'poster']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movie} resolvePeople={async () => []} {...pendingLifecycle} />);

    await reachReview();

    const fieldToggle = screen.getByRole('checkbox', { name: 'Use proposed Title' });
    const imageToggle = screen.getByRole('radio', { name: /Use as Poster/i });
    expect(fieldToggle.closest('.movie-import-modal__field-table-choice')).toHaveStyle({ minHeight: '44px' });
    expect(imageToggle.closest('.movie-import-modal__image-option')).toHaveStyle({ minHeight: '44px' });
  });

  it('keeps image choices understandable when a preview fails to load', async () => {
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', poster: null }} mappedFields={['title', 'poster']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movie} resolvePeople={async () => []} {...pendingLifecycle} />);

    await reachReview();
    fireEvent.error(screen.getByRole('img', { name: 'Poster option 1' }));

    expect(screen.getByRole('img', { name: 'poster preview unavailable' })).toBeInTheDocument();
    expect(screen.getByText('Preview unavailable')).toBeInTheDocument();
    expect(screen.getByText('TMDB · 100 × 150 · EN')).toBeInTheDocument();
  });

  it('reuses a different-name record when the TMDB ID matches', async () => {
    const execute = vi.fn();
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '' }} mappedFields={['title', 'directors']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movie} resolvePeople={async () => [{ id: 'director-10', name: 'Stored Name', tmdbId: 10 }]} prepare={capturePreparedPlan(execute)} resolve={vi.fn()} />);

    await reachReview();
    expect(screen.getByText('Matched by TMDB ID.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start import' }));

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls[0][0].peopleToReuse).toContainEqual({ candidateTmdbId: 10, candidateRole: 'director', recordId: 'director-10', name: 'Director Name', source: 'tmdb-id' });
  });

  it('does not use TMDB ID matching when the person ID field is not configured', async () => {
    const execute = vi.fn();
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '' }} mappedFields={['title', 'directors']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movie} resolvePeople={async () => [{ id: 'director-10', name: 'Stored Name', tmdbId: 10 }]} tmdbIdFieldConfigured={false} prepare={capturePreparedPlan(execute)} resolve={vi.fn()} />);

    await reachReview();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start import' }));

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls[0][0].peopleToCreate).toContainEqual({ candidateTmdbId: 10, candidateRole: 'director', name: 'Director Name', source: 'auto' });
  });

  it('uses plain-language copy when reusing a person by exact name', async () => {
    const execute = vi.fn();
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '' }} mappedFields={['title', 'directors']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movie} resolvePeople={async () => [{ id: 'director-10', name: 'Director Name', tmdbId: null }]} prepare={capturePreparedPlan(execute)} resolve={vi.fn()} />);

    await reachReview();

    expect(screen.getByText('Matched by exact name.')).toBeInTheDocument();
    expect(screen.queryByText('Matched by exact normalized name because no TMDB person ID match was available.')).not.toBeInTheDocument();
  });

  it('keeps the selected Poster opt-out visible when no English posters are available', async () => {
    const execute = vi.fn();
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', poster: null }} mappedFields={['title', 'poster']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movieWithoutEnglishPosters} resolvePeople={async () => []} prepare={capturePreparedPlan(execute)} resolve={vi.fn()} />);

    await reachReview();

    expect(screen.getByRole('radio', { name: 'Do not import a Poster' })).toBeChecked();
    expect(screen.getByText('TMDB did not return any English-language poster candidates.')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Use as Poster/i })).not.toBeInTheDocument();
  });
});
