import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportModal } from './ImportModal';
import type { NormalizedMovie } from '../domain/movie';
import type { ImportProgressEvent, PrepareImportResult } from '../dato/importExecutor';
import type { ImportPlan } from '../domain/importPlanning';
import { TmdbError } from '../providers/tmdbClient';
import { ImportConfigurationError } from '../plugin/runtimeValidation';

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
};

const movieWithBackdrops: NormalizedMovie = {
  ...movie,
  images: [
    ...movie.images,
    { providerKey: 'tmdb', providerImageId: '/backdrop-1.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 123 }, type: 'backdrop', originalUrl: 'https://image.tmdb.org/t/p/original/backdrop-1.jpg', width: 1920, height: 1080, language: 'en', rank: 2, attribution: 'TMDB' },
    { providerKey: 'tmdb', providerImageId: '/backdrop-2.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 123 }, type: 'backdrop', originalUrl: 'https://image.tmdb.org/t/p/original/backdrop-2.jpg', width: 1920, height: 1080, language: 'en', rank: 3, attribution: 'TMDB' },
  ],
};

const movieWithNonEnglishPosters: NormalizedMovie = {
  ...movie,
  images: [
    { providerKey: 'tmdb', providerImageId: '/textless-poster.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 123 }, type: 'poster', originalUrl: 'https://image.tmdb.org/t/p/original/textless-poster.jpg', width: 100, height: 150, language: null, rank: 1, attribution: 'TMDB' },
    { providerKey: 'tmdb', providerImageId: '/english-poster.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 123 }, type: 'poster', originalUrl: 'https://image.tmdb.org/t/p/original/english-poster.jpg', width: 100, height: 150, language: 'en', rank: 2, attribution: 'TMDB' },
    { providerKey: 'tmdb', providerImageId: '/spanish-poster.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 123 }, type: 'poster', originalUrl: 'https://image.tmdb.org/t/p/original/spanish-poster.jpg', width: 100, height: 150, language: 'es', rank: 3, attribution: 'TMDB' },
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

  it('shows movie loading and person matching progress while preparing a selected result', async () => {
    let resolveMovie: ((value: NormalizedMovie) => void) | undefined;
    let resolvePeople: ((value: []) => void) | undefined;

    render(
      <ImportModal
        initialTitle="Example"
        initialYear={2024}
        currentValues={{ title: '' }}
        mappedFields={['title', 'directors', 'actors']}
        searchMovies={async () => [
          { id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null },
        ]}
        loadMovie={() => new Promise((resolve) => {
          resolveMovie = resolve;
        })}
        resolvePeople={() => new Promise((resolve) => {
          resolvePeople = resolve;
        })}
        {...pendingLifecycle}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Use this for Example Movie, TMDB ID 123' }));

    expect(screen.getByRole('status')).toHaveTextContent('Loading movie details…');

    resolveMovie?.(movie);

    expect(await screen.findByRole('status')).toHaveTextContent('Matching directors and actors…');

    resolvePeople?.([]);

    expect(await screen.findByRole('heading', { name: 'Review changes' })).toBeInTheDocument();
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
    expect(screen.getByText('1 unique image to upload')).toBeInTheDocument();
    expect(screen.getByText('1 poster')).toBeInTheDocument();
    expect(screen.getByText('What happens after you start')).toBeInTheDocument();
    expect(screen.getByText('Create selected draft Person records in DatoCMS.')).toBeInTheDocument();
    expect(screen.getByText('Upload selected poster and backdrop images.')).toBeInTheDocument();
    expect(screen.getByText('Apply selected TMDB values to the unsaved movie form.')).toBeInTheDocument();
    expect(screen.getByText('The movie record will remain unsaved until you save it in DatoCMS.')).toBeInTheDocument();
    expect(screen.getByText('If something fails after people or images are created, those drafts or uploads may remain in DatoCMS.')).toBeInTheDocument();
    const confirmActions = document.querySelector('.movie-import-modal__actions--confirm')!;
    expect(within(confirmActions as HTMLElement).getByText('3 fields selected')).toBeInTheDocument();
    expect(within(confirmActions as HTMLElement).getByText('1 image selected')).toBeInTheDocument();
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
    expect(screen.getByText('1 image selected')).toBeInTheDocument();
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
    expect(screen.getByText('1 poster selected for import.')).toBeInTheDocument();
    expect(screen.getByText('Choose a single Hero Image and any backdrops to add to Other Images. The same backdrop can be used in both places.')).toBeInTheDocument();
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
  it('uses an explicit hero selector and keeps other image choices separate', async () => {
    const execute = vi.fn();
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', poster: null, backdrops: [] }} mappedFields={['title', 'poster', 'heroImage', 'backdrops']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movieWithBackdrops} resolvePeople={async () => []} prepare={capturePreparedPlan(execute)} resolve={vi.fn()} />);

    await reachReview();
    expect(screen.getByText('Choose exactly which TMDB artwork destinations to import.')).toBeInTheDocument();
    expect(screen.getByText('Choose a single Hero Image and any backdrops to add to Other Images. The same backdrop can be used in both places.')).toBeInTheDocument();
    expect(screen.getByText('1 poster, 1 Hero Image, and 2 Other Images selected for import.')).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /Backdrop option/i })).toHaveLength(4);
    expect(screen.getByRole('radio', { name: 'Do not import a Hero Image' })).not.toBeChecked();
    const heroOptions = screen.getAllByRole('radio', { name: /Use as Hero Image/i });
    const otherImageOptions = screen.getAllByRole('checkbox', { name: /Add to Other Images/i });
    expect(heroOptions[0]).toBeChecked();
    expect(heroOptions[1]).not.toBeChecked();
    expect(otherImageOptions[0]).toBeChecked();
    expect(otherImageOptions[1]).toBeChecked();
    expect(heroOptions[0]).toHaveAccessibleName(/selected for Hero Image; also selected for Other Images/i);
    expect(otherImageOptions[0]).toHaveAccessibleName(/selected for Other Images; also selected as Hero Image/i);
    expect(screen.getAllByText('Other Images').length).toBeGreaterThan(0);

    await userEvent.click(heroOptions[1]);
    expect(heroOptions[1]).toBeChecked();

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start import' }));

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls[0][0].heroImageToUpload.providerImageId).toBe('/backdrop-2.jpg');
    expect(execute.mock.calls[0][0].otherImagesToUpload.map((image: NormalizedMovie['images'][number]) => image.providerImageId)).toEqual(['/backdrop-1.jpg', '/backdrop-2.jpg']);
    expect(execute.mock.calls[0][0].assetsToUpload.filter((image: NormalizedMovie['images'][number]) => image.type === 'backdrop').map((image: NormalizedMovie['images'][number]) => image.providerImageId)).toEqual(['/backdrop-2.jpg', '/backdrop-1.jpg']);
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

  it('allows editors to skip importing a hero image while keeping other image choices', async () => {
    const execute = vi.fn();
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', poster: null, backdrops: [] }} mappedFields={['title', 'poster', 'heroImage', 'backdrops']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movieWithBackdrops} resolvePeople={async () => []} prepare={capturePreparedPlan(execute)} resolve={vi.fn()} />);

    await reachReview();
    await userEvent.click(screen.getByRole('radio', { name: 'Do not import a Hero Image' }));
    expect(screen.getByText('1 poster and 2 Other Images selected for import.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start import' }));

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls[0][0].heroImageToUpload).toBeNull();
    expect(execute.mock.calls[0][0].otherImagesToUpload.map((image: NormalizedMovie['images'][number]) => image.providerImageId)).toEqual(['/backdrop-1.jpg', '/backdrop-2.jpg']);
  });

  it('describes the backdrop picker as hero-only when only the hero image field is mapped', async () => {
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', heroImage: null }} mappedFields={['title', 'heroImage']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movieWithBackdrops} resolvePeople={async () => []} {...pendingLifecycle} />);

    await reachReview();
    expect(screen.getByText('Choose one backdrop to upload to the Hero Image field, or skip this destination.')).toBeInTheDocument();
    expect(screen.queryByText('Choose a single Hero Image and any backdrops to add to Other Images. The same backdrop can be used in both places.')).not.toBeInTheDocument();
  });

  it('describes the backdrop picker as other-images-only when only the other images field is mapped', async () => {
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', backdrops: [] }} mappedFields={['title', 'backdrops']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movieWithBackdrops} resolvePeople={async () => []} {...pendingLifecycle} />);

    await reachReview();
    expect(screen.getByText('Select any backdrops to upload to the Other Images gallery field.')).toBeInTheDocument();
    expect(screen.queryByText('Choose a single Hero Image and any backdrops to add to Other Images. The same backdrop can be used in both places.')).not.toBeInTheDocument();
  });

  it('keeps an existing hero image untouched when only other images are selected', async () => {
    const execute = vi.fn();
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', heroImage: { upload_id: 'existing-hero' }, backdrops: [] }} mappedFields={['title', 'heroImage', 'backdrops']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movieWithBackdrops} resolvePeople={async () => []} prepare={capturePreparedPlan(execute)} resolve={vi.fn()} />);

    await reachReview();
    expect(screen.getByText('2 Other Images selected for import.')).toBeInTheDocument();
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
      assetsToUpload: movie.images,
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
    expect(screen.getByRole('checkbox', { name: /Use as poster/i })).toBeChecked();
    expect(screen.getByRole('img', { name: 'Poster option 1' })).toHaveAttribute('loading', 'lazy');
    expect(screen.getByRole('img', { name: 'Poster option 1' })).toHaveAttribute('width', '120');
    expect(screen.getByRole('img', { name: 'Poster option 1' })).toHaveAttribute('height', '180');
    await userEvent.click(screen.getByRole('checkbox', { name: /Use as poster/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start import' }));

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls[0][0].assetsToUpload).toEqual([]);
  });

  it('only displays and preselects English-language posters', async () => {
    const execute = vi.fn();
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', poster: null }} mappedFields={['title', 'poster']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movieWithNonEnglishPosters} resolvePeople={async () => []} prepare={capturePreparedPlan(execute)} resolve={vi.fn()} />);

    await reachReview();

    expect(screen.getByRole('img', { name: 'Example Movie poster' })).toHaveAttribute('src', 'https://image.tmdb.org/t/p/original/english-poster.jpg');
    expect(screen.getByRole('checkbox', { name: /Use as poster/i })).toBeChecked();
    expect(screen.getByRole('img', { name: 'Poster option 1' })).toHaveAttribute('src', 'https://image.tmdb.org/t/p/original/english-poster.jpg');
    expect(screen.queryByText('textless-poster.jpg')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start import' }));

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls[0][0].assetsToUpload.map((image: NormalizedMovie['images'][number]) => image.providerImageId)).toEqual(['/english-poster.jpg']);
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
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '' }} mappedFields={['title', 'directors']} searchMovies={async () => []} loadMovie={async () => movie} resolvePeople={async () => {
      throw new Error('DatoCMS item list permission is unavailable.');
    }} {...pendingLifecycle} />);

    await userEvent.type(screen.getByLabelText('TMDB ID'), '123');
    await userEvent.click(screen.getByRole('button', { name: 'Load movie by ID' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The TMDB movie loaded, but Person matching failed.');
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
        'MCS Movie Importer person matching failed',
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
    const imageToggle = screen.getByRole('checkbox', { name: /Use as poster/i });
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
});
