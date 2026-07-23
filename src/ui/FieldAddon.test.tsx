import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FieldAddon } from './FieldAddon';

describe('FieldAddon', () => {
  it('opens find mode when no TMDB id exists', async () => {
    const onOpen = vi.fn();
    render(<FieldAddon tmdbId={null} onOpen={onOpen} />);

    await userEvent.click(screen.getByRole('button', { name: 'Find movie' }));

    expect(onOpen).toHaveBeenCalledWith('find');
  });

  it('uses the DatoCMS button component for the launcher', () => {
    render(<FieldAddon tmdbId={null} onOpen={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Find movie' })).toHaveAttribute('data-dato-component', 'Button');
  });

  it('opens refresh mode when a TMDB id exists', async () => {
    const onOpen = vi.fn();
    render(<FieldAddon tmdbId={123} onOpen={onOpen} />);

    await userEvent.click(screen.getByRole('button', { name: 'Refresh from TMDB' }));

    expect(onOpen).toHaveBeenCalledWith('refresh');
  });

  it('opens find mode when the TMDB id is whitespace only', async () => {
    const onOpen = vi.fn();
    render(<FieldAddon tmdbId="   " onOpen={onOpen} />);

    await userEvent.click(screen.getByRole('button', { name: 'Find movie' }));

    expect(onOpen).toHaveBeenCalledWith('find');
  });

  it('disables the launcher and explains the configuration problem', () => {
    render(<FieldAddon tmdbId={null} onOpen={vi.fn()} configurationIssues={['TMDB read token is required.']} />);

    expect(screen.getByRole('button', { name: 'Find movie' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('TMDB read token is required.');
  });
});
