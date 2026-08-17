import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigScreen } from './ConfigScreen';
import { parsePluginParameters } from '../plugin/parameters';

describe('ConfigScreen', () => {
  it('shows token visibility warning for frontend-only v1', () => {
    render(<ConfigScreen parameters={parsePluginParameters({})} onSave={vi.fn()} />);

    expect(screen.getByText(/Editors who can use the plugin may inspect it in browser tools/i)).toBeInTheDocument();
  });

  it('shows the approved TMDB attribution in the configuration credits area', () => {
    render(<ConfigScreen parameters={parsePluginParameters({})} onSave={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'TMDB attribution' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'TMDB logo' })).toBeInTheDocument();
    expect(screen.getByText('This product uses the TMDB API but is not endorsed or certified by TMDB.')).toBeInTheDocument();
  });

  it('uses Dato form sections for plugin settings groups', () => {
    const { container } = render(<ConfigScreen parameters={parsePluginParameters({})} onSave={vi.fn()} />);
    const sections = Array.from(container.querySelectorAll('[data-dato-component="Section"]'));

    expect(container.querySelector('form')).toHaveAttribute('data-dato-component', 'Form');
    expect(sections).toHaveLength(5);
    expect(screen.getByRole('heading', { name: 'TMDB access' }).closest('[data-dato-component="Section"]')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Movie model and fields' }).closest('[data-dato-component="Section"]')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Person matching' }).closest('[data-dato-component="Section"]')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Import behavior' }).closest('[data-dato-component="Section"]')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'TMDB attribution' }).closest('[data-dato-component="Section"]')).not.toBeNull();
  });

  it('shows validation errors for missing required values', () => {
    render(<ConfigScreen parameters={parsePluginParameters({})} onSave={vi.fn()} />);

    expect(screen.getByRole('alert', { name: '' })).toHaveTextContent('TMDB read token is required.');
  });

  it('saves the current parameters when submitted', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const parameters = parsePluginParameters({ tmdbReadToken: 'read-token' });
    render(<ConfigScreen parameters={parameters} onSave={onSave} />);

    await userEvent.click(screen.getByRole('button', { name: 'Save configuration' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(parameters));
  });

  it('saves a complete configuration with field mappings and actor limit', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    const movieFields = {
      title: 'title',
      yearReleased: 'year_released',
      mpaaRating: 'mpaa_rating',
      runtime: 'runtime',
      tmdbId: 'tmdb_id',
      tagline: 'tagline',
      description: 'description',
      trailer: 'trailer',
      poster: 'poster',
      heroImage: 'hero_image',
      backdrops: 'other_images',
      directors: 'directors',
      actors: 'actors',
    };
    render(<ConfigScreen parameters={parsePluginParameters({})} onSave={onSave} />);

    await user.type(screen.getByLabelText('TMDB read token'), 'read-token');
    await user.type(screen.getByLabelText('Movie model API name'), 'movie');
    for (const [key, value] of Object.entries(movieFields)) {
      await user.type(screen.getByLabelText(`${movieFieldLabel(key)} field API name`), value);
    }
    await user.type(screen.getByLabelText('Person model API name'), 'person');
    await user.type(screen.getByLabelText('Person name field API name'), 'name');
    await user.type(screen.getByLabelText('Person TMDB ID field API name'), 'person_tmdb_id');
    await user.clear(screen.getByLabelText('Actor limit'));
    await user.type(screen.getByLabelText('Actor limit'), '7');
    await user.click(screen.getByRole('button', { name: 'Save configuration' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      tmdbReadToken: 'read-token',
      movieModelApiKey: 'movie',
      movieFields,
      personModelApiKey: 'person',
      personNameFieldApiKey: 'name',
      personTmdbIdFieldApiKey: 'person_tmdb_id',
      actorLimit: 7,
    })));
  });

  it('shows the trailer field mapping input', () => {
    render(<ConfigScreen parameters={parsePluginParameters({})} onSave={vi.fn()} />);

    expect(screen.getByLabelText('Trailer field API name')).toBeInTheDocument();
  });

  it('disables the save button while saving', async () => {
    let completeSave: (() => void) | undefined;
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          completeSave = resolve;
        }),
    );
    render(<ConfigScreen parameters={parsePluginParameters({})} onSave={onSave} />);

    await userEvent.click(screen.getByRole('button', { name: 'Save configuration' }));

    expect(screen.getByRole('button', { name: 'Saving configuration' })).toBeDisabled();
    completeSave?.();
  });

  it('shows a safe error message when saving fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('token=private-token'));
    render(<ConfigScreen parameters={parsePluginParameters({})} onSave={onSave} />);

    await userEvent.click(screen.getByRole('button', { name: 'Save configuration' }));

    expect(await screen.findByText('The plugin settings could not be saved. Try again.')).toBeInTheDocument();
    expect(screen.queryByText(/private-token/i)).not.toBeInTheDocument();
  });
});

function movieFieldLabel(key: string): string {
  return {
    title: 'Title',
    yearReleased: 'Year released',
    mpaaRating: 'MPAA rating',
    runtime: 'Runtime',
    tmdbId: 'TMDB ID',
    tagline: 'Tagline',
    description: 'Description',
    trailer: 'Trailer',
    poster: 'Poster',
    heroImage: 'Hero image',
    backdrops: 'Other images',
    directors: 'Directors',
    actors: 'Actors',
  }[key] ?? key;
}
