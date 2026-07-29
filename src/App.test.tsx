import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { App, type PluginScreen } from './App';
import type { FieldAddonStatusReporter } from './ui/FieldAddon';

const modalScreen: Extract<PluginScreen, { type: 'modal' }> = {
  type: 'modal',
  initialTitle: '',
  initialYear: null,
  currentValues: {},
  mappedFields: [],
  searchMovies: async () => [],
  loadMovie: async () => {
    throw new Error('No movie selected');
  },
  prepare: async () => ({
    status: 'dependency_failed',
    failedPhase: 'images',
    message: 'Image upload failed.',
    createdPeople: [],
    uploadedAssets: [],
  }),
  resolve: async () => undefined,
};

describe('App', () => {
  it('renders the config screen', () => {
    render(<App screen={{ type: 'config' }} />);

    expect(screen.getByRole('button', { name: 'Save configuration' })).toBeInTheDocument();
  });

  it('renders the field add-on launcher', () => {
    render(<App screen={{ type: 'fieldAddon' }} />);

    expect(screen.getByRole('button', { name: 'Find movie' })).toBeInTheDocument();
  });

  it('renders the modal with preparation and resolution callbacks', () => {
    render(<App screen={modalScreen} />);

    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
  });

  it('opens find mode from the field add-on launcher', async () => {
    const onOpen = vi.fn();
    render(<App screen={{ type: 'fieldAddon', onOpen }} />);

    await userEvent.click(screen.getByRole('button', { name: 'Find movie' }));

    expect(onOpen).toHaveBeenCalledWith('find', expect.any(Function));
  });

  it('opens refresh mode from the field add-on launcher', async () => {
    const onOpen = vi.fn();
    render(<App screen={{ type: 'fieldAddon', tmdbId: 123, onOpen }} />);

    await userEvent.click(screen.getByRole('button', { name: 'Refresh from TMDB' }));

    expect(onOpen).toHaveBeenCalledWith('refresh', expect.any(Function));
  });

  it('forwards field-context application status to the field add-on', async () => {
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
    render(<App screen={{ type: 'fieldAddon', tmdbId: 123, onOpen }} />);

    await userEvent.click(screen.getByRole('button', { name: 'Refresh from TMDB' }));

    expect(screen.getByRole('status')).toHaveTextContent(
      'Applying imported values…',
    );

    await act(async () => finishImport());

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
