import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { FieldComparison } from '../domain/fieldComparison';
import { datoExternalVideoValue, type NormalizedTrailerCandidate } from '../domain/trailer';
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

const ukTrailer: NormalizedTrailerCandidate = {
  ...trailer,
  providerVideoId: 'tmdb-video-2',
  externalProviderId: 'youtube-video-2',
  title: 'Official New UK Trailer',
  watchUrl: 'https://www.youtube.com/watch?v=youtube-video-2',
  thumbnailUrl: 'https://img.youtube.com/vi/youtube-video-2/maxresdefault.jpg',
  country: 'GB',
};

function buildComparison(overrides: Partial<FieldComparison> = {}): FieldComparison {
  return {
    key: 'trailer',
    currentValue: null,
    proposedValue: null,
    selected: false,
    available: true,
    changed: false,
    ...overrides,
  };
}

function renderReview(overrides: {
  trailers?: NormalizedTrailerCandidate[];
  selectedTrailer?: NormalizedTrailerCandidate | null;
  comparison?: FieldComparison;
  onSelect?: (trailer: NormalizedTrailerCandidate | null) => void;
} = {}) {
  return render(
    <TrailerReview
      trailers={overrides.trailers ?? [trailer, ukTrailer]}
      selectedTrailer={overrides.selectedTrailer ?? null}
      comparison={overrides.comparison ?? buildComparison()}
      onSelect={overrides.onSelect ?? vi.fn()}
    />,
  );
}

describe('TrailerReview', () => {
  it('shows every eligible trailer with the empty Trailer field selected by default', () => {
    renderReview();

    expect(screen.getByRole('radio', { name: 'Keep trailer empty' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Replace with Official Trailer' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Replace with Official New UK Trailer' })).not.toBeChecked();
  });

  it('selects one trailer from the whole card', () => {
    const onSelect = vi.fn();
    const { container } = renderReview({ onSelect });
    const cards = container.querySelectorAll('label.movie-import-modal__trailer-card');

    fireEvent.click(cards[1]);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(trailer);
  });

  it('shows the selected trailer as the only checked video choice', () => {
    renderReview({ selectedTrailer: ukTrailer });

    expect(screen.getByRole('radio', { name: 'Keep trailer empty' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Replace with Official Trailer' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Replace with Official New UK Trailer' })).toBeChecked();
  });

  it('moves through trailer choices with radio-group arrow keys', () => {
    const onSelect = vi.fn();
    function ControlledReview() {
      const [selectedTrailer, setSelectedTrailer] = useState<NormalizedTrailerCandidate | null>(null);

      return (
        <TrailerReview
          trailers={[trailer, ukTrailer]}
          selectedTrailer={selectedTrailer}
          comparison={buildComparison()}
          onSelect={(nextTrailer) => {
            onSelect(nextTrailer);
            setSelectedTrailer(nextTrailer);
          }}
        />
      );
    }

    render(<ControlledReview />);
    const keepEmpty = screen.getByRole('radio', { name: 'Keep trailer empty' });
    const firstTrailer = screen.getByRole('radio', { name: 'Replace with Official Trailer' });

    fireEvent.keyDown(keepEmpty, { key: 'ArrowRight' });

    expect(onSelect).toHaveBeenLastCalledWith(trailer);
    expect(firstTrailer).toHaveFocus();

    fireEvent.keyDown(firstTrailer, { key: 'ArrowLeft' });

    expect(onSelect).toHaveBeenLastCalledWith(null);
    expect(keepEmpty).toHaveFocus();
  });

  it('moves to the first and last trailer choices with Home and End', () => {
    const onSelect = vi.fn();
    function ControlledReview() {
      const [selectedTrailer, setSelectedTrailer] = useState<NormalizedTrailerCandidate | null>(trailer);

      return (
        <TrailerReview
          trailers={[trailer, ukTrailer]}
          selectedTrailer={selectedTrailer}
          comparison={buildComparison()}
          onSelect={(nextTrailer) => {
            onSelect(nextTrailer);
            setSelectedTrailer(nextTrailer);
          }}
        />
      );
    }

    render(<ControlledReview />);
    const keepEmpty = screen.getByRole('radio', { name: 'Keep trailer empty' });
    const firstTrailer = screen.getByRole('radio', { name: 'Replace with Official Trailer' });
    const lastTrailer = screen.getByRole('radio', { name: 'Replace with Official New UK Trailer' });

    firstTrailer.focus();
    fireEvent.keyDown(firstTrailer, { key: 'Home' });

    expect(onSelect).toHaveBeenLastCalledWith(null);
    expect(keepEmpty).toHaveFocus();

    fireEvent.keyDown(keepEmpty, { key: 'End' });

    expect(onSelect).toHaveBeenLastCalledWith(ukTrailer);
    expect(lastTrailer).toHaveFocus();
  });

  it('renders country, resolution, publication date, and safe preview links', () => {
    renderReview();

    expect(screen.getByText('TMDB · 1920 × 1080 · US · EN')).toBeInTheDocument();
    expect(screen.getByText('TMDB · 1920 × 1080 · GB · EN')).toBeInTheDocument();
    expect(screen.getByRole('radio', {
      name: 'Replace with Official Trailer',
      description: 'TMDB · 1920 × 1080 · US · EN Published Jan 1, 2024',
    })).toBeInTheDocument();
    expect(screen.getByRole('radio', {
      name: 'Replace with Official New UK Trailer',
      description: 'TMDB · 1920 × 1080 · GB · EN Published Jan 1, 2024',
    })).toBeInTheDocument();
    expect(screen.getAllByText('Published Jan 1, 2024')).toHaveLength(2);
    for (const link of [
      screen.getByRole('link', { name: 'Preview Official Trailer on YouTube' }),
      screen.getByRole('link', { name: 'Preview Official New UK Trailer on YouTube' }),
    ]) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
      expect(link.closest('.movie-import-modal__trailer-card')).toBeNull();
    }
  });

  it('does not change selection when a YouTube preview link is clicked', () => {
    const onSelect = vi.fn();
    renderReview({ onSelect });

    fireEvent.click(screen.getByRole('link', { name: 'Preview Official Trailer on YouTube' }));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders the current DatoCMS trailer as the selected full card', () => {
    renderReview({
      comparison: buildComparison({
        currentValue: { ...datoExternalVideoValue(trailer), title: 'Editorial title' },
      }),
    });

    const keepCurrent = screen.getByRole('radio', {
      name: 'Keep current trailer',
      description: 'DatoCMS · 1920 × 1080 · YouTube',
    });
    const currentCard = keepCurrent.closest('label');

    expect(keepCurrent).toBeChecked();
    expect(currentCard).toHaveTextContent('Editorial title');
    expect(currentCard).toHaveTextContent('Current DatoCMS trailer');
    expect(currentCard?.querySelector('img')).toHaveAttribute('src', trailer.thumbnailUrl);
    expect(screen.getByRole('link', { name: 'Preview Editorial title on YouTube' })).toHaveAttribute('href', trailer.watchUrl);
    expect(screen.queryByRole('radio', { name: 'Replace with Official Trailer' })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Replace with Official New UK Trailer' })).toBeInTheDocument();
  });

  it('explains when the current trailer is the only eligible TMDB result', () => {
    renderReview({
      trailers: [trailer],
      comparison: buildComparison({
        currentValue: { ...datoExternalVideoValue(trailer), title: 'Editorial title' },
      }),
    });

    expect(screen.getByRole('radio', { name: 'Keep current trailer' })).toBeChecked();
    expect(screen.getAllByRole('radio')).toHaveLength(1);
    expect(screen.getByText(
      'The current trailer already matches TMDB. No alternative trailers are available.',
    )).toBeInTheDocument();
  });

  it('keeps the current trailer card inside the trailer choice radiogroup', () => {
    renderReview({
      comparison: buildComparison({
        currentValue: { ...datoExternalVideoValue(trailer), title: 'Editorial title' },
      }),
    });

    const choices = screen.getByRole('radiogroup', { name: 'Trailer import choice' });

    expect(within(choices).getByRole('radio', { name: 'Keep current trailer' })).toBeChecked();
    expect(within(choices).getAllByRole('radio')).toHaveLength(2);
  });

  it('uses the same option wrapper for the None choice and trailer choices', () => {
    const { container } = renderReview();
    const choices = screen.getByRole('radiogroup', { name: 'Trailer import choice' });
    const optionWrappers = choices.querySelectorAll('.movie-import-modal__trailer-option');

    expect(optionWrappers).toHaveLength(3);
    expect(optionWrappers[0]).toContainElement(screen.getByRole('radio', { name: 'Keep trailer empty' }));
    expect(container.querySelector('.movie-import-modal__trailer-link-row--placeholder')).toBeInTheDocument();
  });

  it('keeps Do not import visible when TMDB has no eligible trailer', () => {
    renderReview({
      trailers: [],
      comparison: buildComparison({
        currentValue: {
          provider: 'youtube',
          provider_uid: 'existing-youtube-id',
          title: 'Editorial trailer',
        },
        available: false,
      }),
    });

    expect(screen.getByRole('radio', { name: 'Keep current trailer' })).toBeChecked();
    expect(screen.getByText('No official English YouTube trailers found.')).toBeInTheDocument();
    expect(screen.getByText('Editorial trailer')).toBeInTheDocument();
  });

  it('normalizes whitespace-only current video metadata before displaying it', () => {
    renderReview({
      trailers: [],
      comparison: buildComparison({
        currentValue: {
          provider: ' youtube ',
          provider_uid: 'existing-youtube-id',
          title: '   ',
        },
      }),
    });

    expect(screen.getByRole('radio', { name: 'Keep current trailer' })).toBeChecked();
    expect(screen.getByText('Untitled video')).toBeInTheDocument();
  });

  it('omits invalid publication metadata', () => {
    renderReview({ trailers: [{ ...trailer, publishedAt: 'not-a-date' }] });

    expect(screen.queryByText(/Published /i)).not.toBeInTheDocument();
  });

  it('shows a preview fallback without removing its choice or link', () => {
    renderReview({ trailers: [trailer] });
    const preview = document.querySelector('.movie-import-modal__trailer-thumb');

    fireEvent.error(preview as HTMLImageElement);

    expect(screen.getByText('Preview unavailable')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Replace with Official Trailer' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Preview Official Trailer on YouTube' })).toHaveAttribute('href', trailer.watchUrl);
  });
});
