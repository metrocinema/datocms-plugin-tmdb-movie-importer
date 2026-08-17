import { fireEvent, render, screen } from '@testing-library/react';
import type { FieldComparison } from '../domain/fieldComparison';
import type { NormalizedTrailerCandidate } from '../domain/trailer';
import { datoExternalVideoValue } from '../domain/trailer';
import { TrailerReview } from './TrailerReview';

const trailer: NormalizedTrailerCandidate = {
  providerKey: 'tmdb',
  providerVideoId: 'tmdb-video-1',
  movieIdentity: { providerKey: 'tmdb', tmdbId: 123 },
  externalProvider: 'youtube',
  externalProviderId: 'youtube-video-1',
  title: 'Official Trailer',
  watchUrl: 'https://www.youtube.com/watch?v=youtube-video-1',
  thumbnailUrl: 'https://img.youtube.com/vi/youtube-video-1/maxresdefault.jpg',
  width: 1920,
  height: 1080,
  language: 'en',
  country: 'US',
  resolution: 1080,
  publishedAt: '2024-01-01T00:00:00.000Z',
  official: true,
  attribution: 'TMDB',
};

function buildComparison(overrides: Partial<FieldComparison>): FieldComparison {
  return {
    key: 'trailer',
    currentValue: null,
    proposedValue: datoExternalVideoValue(trailer),
    selected: false,
    available: true,
    changed: true,
    ...overrides,
  };
}

describe('TrailerReview', () => {
  it('renders a selected empty-field proposal with a safe YouTube preview link', () => {
    const onToggle = vi.fn();

    render(
      <TrailerReview
        trailer={trailer}
        comparison={buildComparison({ selected: true })}
        onToggle={onToggle}
      />,
    );

    expect(screen.getByRole('checkbox', { name: 'Import Official Trailer' })).toBeChecked();
    expect(screen.getByText('Official')).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('1080p')).toBeInTheDocument();
    expect(screen.getByText('Published Jan 1, 2024')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Preview on YouTube' })).toHaveAttribute('href', trailer.watchUrl);
    expect(screen.getByRole('link', { name: 'Preview on YouTube' })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: 'Preview on YouTube' })).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('shows a replacement unselected with current title and provider context', () => {
    render(
      <TrailerReview
        trailer={trailer}
        comparison={buildComparison({
          currentValue: {
            provider: 'youtube',
            provider_uid: 'existing-youtube-id',
            title: 'Editorial trailer',
            width: 1280,
            height: 720,
            thumbnail_url: 'https://img.youtube.com/vi/existing/hqdefault.jpg',
            url: 'https://www.youtube.com/watch?v=existing-youtube-id',
          },
        })}
        onToggle={vi.fn()}
      />,
    );

    expect(screen.getByRole('checkbox', { name: 'Import Official Trailer' })).not.toBeChecked();
    expect(screen.getByText(/Current: Editorial trailer · YouTube/i)).toBeInTheDocument();
  });

  it('disables an already-current proposal', () => {
    render(
      <TrailerReview
        trailer={trailer}
        comparison={buildComparison({
          currentValue: {
            ...datoExternalVideoValue(trailer),
            title: 'Editorial trailer',
          },
          changed: false,
          selected: false,
        })}
        onToggle={vi.fn()}
      />,
    );

    expect(screen.getByText('Already current trailer')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Import Official Trailer' })).toBeDisabled();
  });

  it('shows no-result copy without clearing the current value', () => {
    render(
      <TrailerReview
        trailer={null}
        comparison={buildComparison({
          currentValue: {
            provider: 'youtube',
            provider_uid: 'existing-youtube-id',
            title: 'Editorial trailer',
            width: 1280,
            height: 720,
            thumbnail_url: 'https://img.youtube.com/vi/existing/hqdefault.jpg',
            url: 'https://www.youtube.com/watch?v=existing-youtube-id',
          },
          proposedValue: null,
          available: false,
        })}
        onToggle={vi.fn()}
      />,
    );

    expect(screen.getByText('No official English YouTube trailer found.')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Import Official Trailer' })).not.toBeInTheDocument();
  });

  it('omits publication metadata when publishedAt is null or invalid', () => {
    const { rerender } = render(
      <TrailerReview
        trailer={{ ...trailer, publishedAt: null }}
        comparison={buildComparison({ selected: true })}
        onToggle={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Published /i)).not.toBeInTheDocument();

    rerender(
      <TrailerReview
        trailer={{ ...trailer, publishedAt: 'not-a-date' }}
        comparison={buildComparison({ selected: true })}
        onToggle={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Published /i)).not.toBeInTheDocument();
  });

  it('shows a preview fallback without removing the link or decision control', () => {
    render(
      <TrailerReview
        trailer={trailer}
        comparison={buildComparison({ selected: true })}
        onToggle={vi.fn()}
      />,
    );

    const preview = document.querySelector('.movie-import-modal__trailer-thumb');
    expect(preview).toBeInstanceOf(HTMLImageElement);

    fireEvent.error(preview as HTMLImageElement);

    expect(screen.getByText('Preview unavailable')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Preview on YouTube' })).toHaveAttribute('href', trailer.watchUrl);
    expect(screen.getByRole('checkbox', { name: 'Import Official Trailer' })).toBeChecked();
  });
});
