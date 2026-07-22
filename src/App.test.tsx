import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders the config screen', () => {
    render(<App screen={{ type: 'config' }} />);

    expect(screen.getByText('Configure TMDB Movie Import')).toBeInTheDocument();
  });

  it('renders the field add-on launcher', () => {
    render(<App screen={{ type: 'fieldAddon' }} />);

    expect(screen.getByRole('button', { name: 'Find movie' })).toBeInTheDocument();
  });
});
