import { render, screen, waitFor } from '@testing-library/react';
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

describe('ImportModal', () => {
  it('searches, shows review, and reaches confirmation without writing early', async () => {
    const execute = vi.fn();
    render(
      <ImportModal
        initialTitle="Example"
        initialYear={2024}
        currentValues={{ title: '' }}
        mappedFields={['title', 'runtime', 'tmdbId']}
        searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: 'Overview text', posterPath: null }]}
        loadMovie={async () => movie}
        execute={execute}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    await userEvent.click(screen.getByRole('button', { name: /Example Movie/i }));

    expect(screen.getByText('Review changes')).toBeInTheDocument();
    expect(execute).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Confirm import')).toBeInTheDocument();
  });
});

async function reachReview() {
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));
  await userEvent.click(screen.getByRole('button', { name: /Example Movie/i }));
}

describe('ImportModal data flow', () => {
  it('creates resolutions for imported directors and actors before confirming', async () => {
    const execute = vi.fn();
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', poster: null }} mappedFields={['title']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null }]} loadMovie={async () => movie} resolvePeople={async () => []} execute={execute} />);

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
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '' }} mappedFields={['title']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null }]} loadMovie={async () => movie} resolvePeople={async () => [{ id: 'person-a', name: 'Director Name', tmdbId: null }, { id: 'person-b', name: 'Director Name', tmdbId: null }]} execute={vi.fn()} />);

    await reachReview();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText('Resolve Director Name'), 'create');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('includes selected images and excludes images deselected in review', async () => {
    const execute = vi.fn();
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '', poster: null }} mappedFields={['title', 'poster']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null }]} loadMovie={async () => movie} resolvePeople={async () => []} execute={execute} />);

    await reachReview();
    expect(screen.getByRole('checkbox', { name: 'poster candidate' })).toBeChecked();
    await userEvent.click(screen.getByRole('checkbox', { name: 'poster candidate' }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply to unsaved movie' }));

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls[0][0].assetsToUpload).toEqual([]);
  });

  it('loads the existing TMDB ID directly for refresh mode', async () => {
    const loadMovie = vi.fn(async () => movie);
    render(<ImportModal initialTitle="Example" initialYear={2024} initialTmdbId={123} currentValues={{ title: '' }} mappedFields={['title']} searchMovies={async () => []} loadMovie={loadMovie} resolvePeople={async () => []} execute={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Review changes')).toBeInTheDocument());
    expect(loadMovie).toHaveBeenCalledWith(123);
  });

  it('loads a movie from a TMDB ID entered in find mode', async () => {
    const loadMovie = vi.fn(async () => movie);
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '' }} mappedFields={['title']} searchMovies={async () => []} loadMovie={loadMovie} resolvePeople={async () => []} execute={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('TMDB ID'), '123');
    await userEvent.click(screen.getByRole('button', { name: 'Load TMDB ID' }));

    await waitFor(() => expect(screen.getByText('Review changes')).toBeInTheDocument());
    expect(loadMovie).toHaveBeenCalledWith(123);
  });

  it('reuses a different-name record when the TMDB ID matches', async () => {
    const execute = vi.fn();
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '' }} mappedFields={['title']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null }]} loadMovie={async () => movie} resolvePeople={async () => [{ id: 'director-10', name: 'Stored Name', tmdbId: 10 }]} execute={execute} />);

    await reachReview();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply to unsaved movie' }));

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls[0][0].peopleToReuse).toContainEqual({ candidateTmdbId: 10, recordId: 'director-10', name: 'Director Name' });
  });

  it('does not use TMDB ID matching when the person ID field is not configured', async () => {
    const execute = vi.fn();
    render(<ImportModal initialTitle="Example" initialYear={2024} currentValues={{ title: '' }} mappedFields={['title']} searchMovies={async () => [{ id: 123, title: 'Example Movie', releaseDate: '2024-03-01', overview: null, posterPath: null }]} loadMovie={async () => movie} resolvePeople={async () => [{ id: 'director-10', name: 'Stored Name', tmdbId: 10 }]} tmdbIdFieldConfigured={false} execute={execute} />);

    await reachReview();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply to unsaved movie' }));

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls[0][0].peopleToCreate).toContainEqual({ candidateTmdbId: 10, name: 'Director Name' });
  });
});
