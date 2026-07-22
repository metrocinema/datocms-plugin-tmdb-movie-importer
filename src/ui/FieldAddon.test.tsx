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

  it('opens refresh mode when a TMDB id exists', async () => {
    const onOpen = vi.fn();
    render(<FieldAddon tmdbId={123} onOpen={onOpen} />);

    await userEvent.click(screen.getByRole('button', { name: 'Refresh from TMDB' }));

    expect(onOpen).toHaveBeenCalledWith('refresh');
  });
});
