import { render, screen } from '@testing-library/react';
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
  images: [],
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
