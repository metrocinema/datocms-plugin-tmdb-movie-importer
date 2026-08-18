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
    expect(screen.getByText('TMDB · 1920 × 1080 · EN')).toBeInTheDocument();
    expect(screen.getByText('Published Jan 1, 2024')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Preview on YouTube' })).toHaveAttribute('href', trailer.watchUrl);
    expect(screen.getByRole('link', { name: 'Preview on YouTube' })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: 'Preview on YouTube' })).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('toggles a proposal when its thumbnail is selected without making the preview link toggle it', () => {
    const onToggle = vi.fn();
    const { container } = render(
      <TrailerReview
        trailer={trailer}
        comparison={buildComparison({ selected: false })}
        onToggle={onToggle}
      />,
    );

    const thumbnail = container.querySelector('.movie-import-modal__trailer-preview');
    expect(thumbnail).not.toBeNull();

    fireEvent.click(thumbnail as HTMLElement);
    expect(onToggle).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('link', { name: 'Preview on YouTube' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders the YouTube preview action outside the selectable trailer card', () => {
    const { container } = render(
      <TrailerReview
        trailer={trailer}
        comparison={buildComparison({ selected: false })}
        onToggle={vi.fn()}
      />,
    );

    const card = container.querySelector('.movie-import-modal__trailer-card');
    const previewAction = screen.getByRole('link', { name: 'Preview on YouTube' });

    expect(card).not.toContainElement(previewAction);
    expect(card?.nextElementSibling).toContainElement(previewAction);
  });

  it('toggles only once when the selectable trailer body is clicked', () => {
    const onToggle = vi.fn();
    const { container } = render(
      <TrailerReview
        trailer={trailer}
        comparison={buildComparison({ selected: false })}
        onToggle={onToggle}
      />,
    );

    const cardBody = container.querySelector('.movie-import-modal__trailer-card-main');
    expect(cardBody).not.toBeNull();

    fireEvent.click(cardBody as HTMLElement);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('uses the same single selectable root and footer pattern as image cards', () => {
    render(
      <TrailerReview
        trailer={trailer}
        comparison={buildComparison({ selected: false })}
        onToggle={vi.fn()}
      />,
    );

    const checkbox = screen.getByRole('checkbox', { name: 'Import Official Trailer' });
    const selectableCard = checkbox.closest('label.movie-import-modal__image-option');

    expect(selectableCard).toHaveClass('movie-import-modal__trailer-card');
    expect(checkbox.closest('.movie-import-modal__image-footer')).toBeInTheDocument();
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

  it('presents an already-current trailer as a non-actionable status', () => {
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

    expect(screen.getByText('Current trailer')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Import Official Trailer' })).not.toBeInTheDocument();
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
