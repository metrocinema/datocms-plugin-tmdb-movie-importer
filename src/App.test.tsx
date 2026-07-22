import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

describe('App', () => {
  it('renders the config screen', () => {
    render(<App screen={{ type: 'config' }} />);

    expect(screen.getByRole('button', { name: 'Save configuration' })).toBeInTheDocument();
  });

  it('renders the field add-on launcher', () => {
    render(<App screen={{ type: 'fieldAddon' }} />);

    expect(screen.getByRole('button', { name: 'Find movie' })).toBeInTheDocument();
  });

  it('opens find mode from the field add-on launcher', async () => {
    const onOpen = vi.fn();
    render(<App screen={{ type: 'fieldAddon', onOpen }} />);

    await userEvent.click(screen.getByRole('button', { name: 'Find movie' }));

    expect(onOpen).toHaveBeenCalledWith('find');
  });

  it('opens refresh mode from the field add-on launcher', async () => {
    const onOpen = vi.fn();
    render(<App screen={{ type: 'fieldAddon', tmdbId: 123, onOpen }} />);

    await userEvent.click(screen.getByRole('button', { name: 'Refresh from TMDB' }));

    expect(onOpen).toHaveBeenCalledWith('refresh');
  });
});
