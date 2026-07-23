import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportModal } from './ImportModal';
import type { NormalizedMovie } from '../domain/movie';

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

describe('ImportModal', () => {
  it('presents the find movie workflow and detailed search results', async () => {
    render(
      <ImportModal
        initialTitle="Example"
        initialYear={2024}
        currentValues={{ title: '' }}
        mappedFields={['title']}
        searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: 'Overview text', posterPath: null, posterUrl: 'https://image.tmdb.org/t/p/w154/poster.jpg' }]}
        loadMovie={async () => movie}
        execute={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Find movie' })).toBeInTheDocument();
    expect(screen.getByText('Find the TMDB record that matches this DatoCMS movie.')).toBeInTheDocument();
    expect(screen.getByText('Review changes')).toBeInTheDocument();
    expect(screen.getByText('Confirm import')).toBeInTheDocument();
    expect(screen.getByText('Search by title and year')).toBeInTheDocument();
    expect(screen.getByText('Lookup by TMDB ID')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Search by title and year' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Lookup by TMDB ID' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(screen.getByText('Example Movie')).toBeInTheDocument();
    expect(screen.getByText('2024')).toBeInTheDocument();
    expect(screen.getByText('Overview text')).toBeInTheDocument();
    expect(screen.getByText('TMDB ID 123')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Example Movie poster' })).toHaveAttribute('src', 'https://image.tmdb.org/t/p/w154/poster.jpg');
    expect(screen.getByRole('img', { name: 'Example Movie poster' })).toHaveAttribute('loading', 'lazy');
    expect(screen.getByRole('img', { name: 'Example Movie poster' })).toHaveAttribute('width', '64');
    expect(screen.getByRole('img', { name: 'Example Movie poster' })).toHaveAttribute('height', '96');
    expect(screen.getByRole('button', { name: 'Use Example Movie' })).toBeInTheDocument();
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
        execute={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(screen.getByRole('button', { name: 'Searching TMDB' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Load TMDB ID' })).toBeDisabled();
    finishSearch?.([]);
  });

  it('searches, shows review, and reaches confirmation without writing early', async () => {
    const execute = vi.fn();
    render(
      <ImportModal
        initialTitle="Example"
        initialYear={2024}
        currentValues={{ title: '' }}
        mappedFields={['title', 'runtime', 'tmdbId']}
        searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: 'Overview text', posterPath: null, posterUrl: null }]}
        loadMovie={async () => movie}
        execute={execute}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    await userEvent.click(screen.getByRole('button', { name: /Example Movie/i }));

    expect(screen.getByRole('heading', { name: 'Review changes' })).toBeInTheDocument();
    expect(execute).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { name: 'Confirm import' })).toBeInTheDocument();
    expect(screen.getByText('Import summary')).toBeInTheDocument();
    expect(screen.getByText('Field changes')).toBeInTheDocument();
    expect(screen.getByText('People to create')).toBeInTheDocument();
    expect(screen.getByText('People to reuse')).toBeInTheDocument();
    expect(screen.getByText('Images to upload')).toBeInTheDocument();
    expect(screen.getByText('The plugin applies values to the current unsaved DatoCMS movie form.')).toBeInTheDocument();
    expect(screen.getByText('It does not save or publish the movie.')).toBeInTheDocument();
    expect(screen.getByText('Created people and uploaded images may remain in DatoCMS if a later form update fails.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply to unsaved movie' })).toBeInTheDocument();
  });

  it('frames the selected movie review with field, image, and people sections', async () => {
    render(
      <ImportModal
        initialTitle="Example"
        initialYear={2024}
        currentValues={{ title: '' }}
        mappedFields={['title']}
        searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: 'Overview text', posterPath: null, posterUrl: null }]}
        loadMovie={async () => movie}
        execute={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    await userEvent.click(screen.getByRole('button', { name: /Use Example Movie/i }));

    const selectedMovie = screen.getByRole('article', { name: 'Selected movie' });
    expect(within(selectedMovie).getByText('Selected movie')).toBeInTheDocument();
    expect(within(selectedMovie).getByText('Example Movie')).toBeInTheDocument();
    expect(within(selectedMovie).getByRole('img', { name: 'Example Movie poster' })).toHaveAttribute('src', 'https://image.tmdb.org/t/p/original/poster.jpg');
    expect(screen.getByText('PG-13')).toBeInTheDocument();
    expect(screen.getByText('125 min')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Field changes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Images' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'People' })).toBeInTheDocument();
    expect(screen.getAllByText('Title').length).toBeGreaterThan(0);
    expect(screen.getByText('Poster')).toBeInTheDocument();
    expect(screen.getByText('Hero image')).toBeInTheDocument();
    expect(screen.getByText('Other images')).toBeInTheDocument();
    expect(screen.getByText('Directors')).toBeInTheDocument();
    expect(screen.getByText('Actors')).toBeInTheDocument();
  });
});

async function reachReview() {
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));
  await userEvent.click(screen.getByRole('button', { name: /Example Movie/i }));
}

describe('ImportModal data flow', () => {
  it('makes the first selected backdrop the visible hero selection and preserves backdrop upload order', async () => {
    const execute = vi.fn();
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', poster: null, backdrops: [] }} mappedFields={['title', 'poster', 'heroImage', 'backdrops']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movieWithBackdrops} resolvePeople={async () => []} execute={execute} />);

    await reachReview();
    expect(screen.getByText('The first selected backdrop becomes the Hero image. All selected backdrops are added to Other images.')).toBeInTheDocument();
    expect(screen.getByText('Hero image selection')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply to unsaved movie' }));

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls[0][0].assetsToUpload.filter((image: NormalizedMovie['images'][number]) => image.type === 'backdrop').map((image: NormalizedMovie['images'][number]) => image.providerImageId)).toEqual(['/backdrop-1.jpg', '/backdrop-2.jpg']);
  });

  it('creates resolutions for imported directors and actors before confirming', async () => {
    const execute = vi.fn();
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', poster: null }} mappedFields={['title']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movie} resolvePeople={async () => []} execute={execute} />);

    await reachReview();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply to unsaved movie' }));

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls[0][0]).toMatchObject({
      directors: movie.directors,
      actors: movie.actors,
      peopleToCreate: [
        { candidateTmdbId: 10, name: 'Director Name' },
        { candidateTmdbId: 20, name: 'Actor Name' },
      ],
      assetsToUpload: movie.images,
    });
  });

  it('blocks confirmation for an ambiguous person until the editor resolves it', async () => {
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '' }} mappedFields={['title']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movie} resolvePeople={async () => [{ id: 'person-a', name: 'Director Name', tmdbId: null }, { id: 'person-b', name: 'Director Name', tmdbId: null }]} execute={vi.fn()} />);

    await reachReview();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    const resolutionControl = screen.getByLabelText('Resolve Director Name');
    expect(resolutionControl.closest('[data-dato-component="SelectField"]')).not.toBeNull();
    expect(within(resolutionControl.closest('.movie-import-modal__person-row')!).getByText('Resolve this person before continuing.')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Resolve Director Name'), 'create');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('includes selected images and excludes images deselected in review', async () => {
    const execute = vi.fn();
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', poster: null }} mappedFields={['title', 'poster']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movie} resolvePeople={async () => []} execute={execute} />);

    await reachReview();
    expect(screen.getByRole('checkbox', { name: 'poster candidate' })).toBeChecked();
    expect(screen.getByRole('img', { name: 'poster candidate' })).toHaveAttribute('loading', 'lazy');
    expect(screen.getByRole('img', { name: 'poster candidate' })).toHaveAttribute('width', '120');
    expect(screen.getByRole('img', { name: 'poster candidate' })).toHaveAttribute('height', '180');
    await userEvent.click(screen.getByRole('checkbox', { name: 'poster candidate' }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply to unsaved movie' }));

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls[0][0].assetsToUpload).toEqual([]);
  });

  it('only displays and preselects English-language posters', async () => {
    const execute = vi.fn();
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', poster: null }} mappedFields={['title', 'poster']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movieWithNonEnglishPosters} resolvePeople={async () => []} execute={execute} />);

    await reachReview();

    expect(screen.getByRole('img', { name: 'Example Movie poster' })).toHaveAttribute('src', 'https://image.tmdb.org/t/p/original/english-poster.jpg');
    expect(screen.getByRole('checkbox', { name: 'poster candidate' })).toBeChecked();
    expect(screen.getByRole('img', { name: 'poster candidate' })).toHaveAttribute('src', 'https://image.tmdb.org/t/p/original/english-poster.jpg');
    expect(screen.queryByText('textless-poster.jpg')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply to unsaved movie' }));

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls[0][0].assetsToUpload.map((image: NormalizedMovie['images'][number]) => image.providerImageId)).toEqual(['/english-poster.jpg']);
  });

  it('loads the existing TMDB ID directly for refresh mode', async () => {
    const loadMovie = vi.fn(async () => movie);
    render(<ImportModal initialTitle="Example" initialYear={2024} initialTmdbId={123} currentValues={{ title: '' }} mappedFields={['title']} searchMovies={async () => []} loadMovie={loadMovie} resolvePeople={async () => []} execute={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Review changes' })).toBeInTheDocument());
    expect(loadMovie).toHaveBeenCalledWith(123);
  });

  it('loads a movie from a TMDB ID entered in find mode', async () => {
    const loadMovie = vi.fn(async () => movie);
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '' }} mappedFields={['title']} searchMovies={async () => []} loadMovie={loadMovie} resolvePeople={async () => []} execute={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('TMDB ID'), '123');
    await userEvent.click(screen.getByRole('button', { name: 'Load TMDB ID' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Review changes' })).toBeInTheDocument());
    expect(loadMovie).toHaveBeenCalledWith(123);
  });

  it('disables direct TMDB ID loading while loading a movie', async () => {
    let finishLoad: ((value: NormalizedMovie) => void) | undefined;
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '' }} mappedFields={['title']} searchMovies={async () => []} loadMovie={() => new Promise((resolve) => {
      finishLoad = resolve;
    })} resolvePeople={async () => []} execute={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('TMDB ID'), '123');
    await userEvent.click(screen.getByRole('button', { name: 'Load TMDB ID' }));

    expect(screen.getByRole('button', { name: 'Loading movie' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
    finishLoad?.(movie);
  });

  it('disables the final import action while submitting the plan to DatoCMS', async () => {
    let finishExecute: (() => void) | undefined;
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '' }} mappedFields={['title']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movie} resolvePeople={async () => []} execute={() => new Promise<void>((resolve) => {
      finishExecute = resolve;
    })} />);

    await reachReview();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply to unsaved movie' }));

    expect(screen.getByRole('button', { name: 'Preparing import' })).toBeDisabled();
    finishExecute?.();
  });

  it('uses safe copy if DatoCMS cannot start the import from the modal', async () => {
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '' }} mappedFields={['title']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movie} resolvePeople={async () => []} execute={async () => {
      throw new Error('ctx.resolve failed');
    }} />);

    await reachReview();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply to unsaved movie' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to start the import.');
    expect(screen.getByRole('alert')).toHaveTextContent('some drafts or uploads may exist in DatoCMS');
    expect(screen.queryByText(/Nothing was saved or published/i)).not.toBeInTheDocument();
  });

  it('keeps custom review controls at accessible touch-target sizes', async () => {
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', poster: null }} mappedFields={['title', 'poster']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movie} resolvePeople={async () => []} execute={vi.fn()} />);

    await reachReview();

    const fieldToggle = screen.getAllByRole('checkbox', { name: 'Select' })[0];
    const imageToggle = screen.getByRole('checkbox', { name: 'poster candidate' });
    expect(fieldToggle.closest('.movie-import-modal__check')).toHaveStyle({ minHeight: '44px' });
    expect(imageToggle.closest('.movie-import-modal__image-option')).toHaveStyle({ minHeight: '44px' });
  });

  it('reuses a different-name record when the TMDB ID matches', async () => {
    const execute = vi.fn();
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '' }} mappedFields={['title']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movie} resolvePeople={async () => [{ id: 'director-10', name: 'Stored Name', tmdbId: 10 }]} execute={execute} />);

    await reachReview();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply to unsaved movie' }));

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls[0][0].peopleToReuse).toContainEqual({ candidateTmdbId: 10, recordId: 'director-10', name: 'Director Name' });
  });

  it('does not use TMDB ID matching when the person ID field is not configured', async () => {
    const execute = vi.fn();
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '' }} mappedFields={['title']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null, posterUrl: null }]} loadMovie={async () => movie} resolvePeople={async () => [{ id: 'director-10', name: 'Stored Name', tmdbId: 10 }]} tmdbIdFieldConfigured={false} execute={execute} />);

    await reachReview();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply to unsaved movie' }));

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls[0][0].peopleToCreate).toContainEqual({ candidateTmdbId: 10, name: 'Director Name' });
  });
});
