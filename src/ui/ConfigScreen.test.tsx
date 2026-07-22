import { render, screen } from '@testing-library/react';
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
});
