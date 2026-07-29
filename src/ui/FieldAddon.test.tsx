import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { FieldAddon, type FieldAddonStatusReporter } from './FieldAddon';

describe('FieldAddon', () => {
  it('opens find mode when no TMDB id exists', async () => {
    const onOpen = vi.fn();
    render(<FieldAddon tmdbId={null} onOpen={onOpen} />);

    await userEvent.click(screen.getByRole('button', { name: 'Find movie' }));

    expect(onOpen).toHaveBeenCalledWith('find', expect.any(Function));
  });

  it('uses the DatoCMS button component for the launcher', () => {
    render(<FieldAddon tmdbId={null} onOpen={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Find movie' })).toHaveAttribute('data-dato-component', 'Button');
  });

  it('opens refresh mode when a TMDB id exists', async () => {
    const onOpen = vi.fn();
    render(<FieldAddon tmdbId={123} onOpen={onOpen} />);

    await userEvent.click(screen.getByRole('button', { name: 'Refresh from TMDB' }));

    expect(onOpen).toHaveBeenCalledWith('refresh', expect.any(Function));
  });

  it('opens find mode when the TMDB id is whitespace only', async () => {
    const onOpen = vi.fn();
    render(<FieldAddon tmdbId="   " onOpen={onOpen} />);

    await userEvent.click(screen.getByRole('button', { name: 'Find movie' }));

    expect(onOpen).toHaveBeenCalledWith('find', expect.any(Function));
  });

  it('disables the launcher and explains the configuration problem', () => {
    render(<FieldAddon tmdbId={null} onOpen={vi.fn()} configurationIssues={['TMDB read token is required.']} />);

    expect(screen.getByRole('button', { name: 'Find movie' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('TMDB read token is required.');
    expect(screen.getByRole('alert')).toHaveClass('movie-import-field-addon__alert');
  });

  it('keeps form application visible until DatoCMS finishes updating the entry', async () => {
    let finishImport!: () => void;
    const onOpen = vi.fn((
      _mode: 'find' | 'refresh',
      reportStatus: FieldAddonStatusReporter,
    ) => {
      reportStatus('applying');
      return new Promise<void>((resolve) => {
        finishImport = resolve;
      });
    });
    render(<FieldAddon tmdbId={123} onOpen={onOpen} />);

    await userEvent.click(screen.getByRole('button', { name: 'Refresh from TMDB' }));

    expect(screen.getByRole('button', { name: 'Refresh from TMDB' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Applying imported values…',
    );

    await act(async () => finishImport());

    expect(screen.getByRole('button', { name: 'Refresh from TMDB' })).toBeEnabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
