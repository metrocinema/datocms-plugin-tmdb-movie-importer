import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigScreen } from './ConfigScreen';
import { parsePluginParameters } from '../plugin/parameters';

describe('ConfigScreen', () => {
  it('shows token visibility warning for frontend-only v1', () => {
    render(<ConfigScreen parameters={parsePluginParameters({})} onSave={vi.fn()} />);

    expect(screen.getByText(/authenticated editors can inspect the TMDB read token/i)).toBeInTheDocument();
  });

  it('shows validation errors for missing required values', () => {
    render(<ConfigScreen parameters={parsePluginParameters({})} onSave={vi.fn()} />);

    expect(screen.getByText('TMDB read token is required.')).toBeInTheDocument();
  });

  it('saves the current parameters when submitted', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const parameters = parsePluginParameters({ tmdbReadToken: 'read-token' });
    render(<ConfigScreen parameters={parameters} onSave={onSave} />);

    await userEvent.click(screen.getByRole('button', { name: 'Save configuration' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(parameters));
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

    expect(await screen.findByText('Unable to save configuration. Please try again.')).toBeInTheDocument();
    expect(screen.queryByText(/private-token/i)).not.toBeInTheDocument();
  });
});
