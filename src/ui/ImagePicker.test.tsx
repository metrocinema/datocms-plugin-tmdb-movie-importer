import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { NormalizedImageCandidate } from '../domain/movie';
import {
  selectHeroImage,
  toggleOtherImage,
  type ImageSelection,
} from '../providers/imageProvider';
import { ImagePicker } from './ImagePicker';

const posters = Array.from({ length: 23 }, (_, index) =>
  imageCandidate('poster', index + 1));
const backdrops = Array.from({ length: 23 }, (_, index) =>
  imageCandidate('backdrop', index + 1));
const images = [...posters, ...backdrops];

function imageCandidate(
  type: NormalizedImageCandidate['type'],
  number: number,
  providerKey = 'tmdb',
): NormalizedImageCandidate {
  return {
    providerKey,
    providerImageId: `/${type}-${number}.jpg`,
    movieIdentity: { providerKey: 'tmdb', tmdbId: 123 },
    type,
    originalUrl: `https://images.example/${providerKey}/${type}-${number}.jpg`,
    previewUrl: `https://images.example/${providerKey}/preview-${type}-${number}.jpg`,
    width: type === 'poster' ? 1000 : 1920,
    height: type === 'poster' ? 1500 : 1080,
    language: 'en',
    rank: number,
    attribution: 'TMDB',
  };
}

function renderPicker({
  selection = { poster: null, heroImage: null, backdrops: [] },
  allowPoster = true,
  allowHeroImage = true,
  allowOtherImages = true,
}: {
  selection?: ImageSelection;
  allowPoster?: boolean;
  allowHeroImage?: boolean;
  allowOtherImages?: boolean;
} = {}) {
  const onTogglePoster = vi.fn();
  const onSelectHeroImage = vi.fn();
  const onToggleBackdrop = vi.fn();

  render(
    <ImagePicker
      images={images}
      selection={selection}
      allowPoster={allowPoster}
      allowHeroImage={allowHeroImage}
      allowOtherImages={allowOtherImages}
      onTogglePoster={onTogglePoster}
      onSelectHeroImage={onSelectHeroImage}
      onToggleBackdrop={onToggleBackdrop}
    />,
  );

  return { onTogglePoster, onSelectHeroImage, onToggleBackdrop };
}

function StatefulPicker() {
  const [selection, setSelection] = useState<ImageSelection>({
    poster: posters[0],
    heroImage: backdrops[0],
    backdrops: [backdrops[1]],
  });

  return (
    <ImagePicker
      images={images}
      selection={selection}
      allowPoster
      allowHeroImage
      allowOtherImages
      onTogglePoster={(poster) => setSelection((current) => ({
        ...current,
        poster,
      }))}
      onSelectHeroImage={(heroImage) => setSelection((current) =>
        selectHeroImage(current, heroImage))}
      onToggleBackdrop={(backdrop) => setSelection((current) =>
        toggleOtherImage(current, backdrop))}
    />
  );
}

describe('ImagePicker', () => {
  it('renders ten candidates in each section before either section is revealed', () => {
    renderPicker();

    expect(screen.getAllByRole('img', { name: /Poster option/i })).toHaveLength(10);
    expect(screen.getAllByRole('img', { name: /Backdrop option/i })).toHaveLength(10);
    expect(screen.queryByRole('img', { name: 'Poster option 11' })).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Backdrop option 11' })).not.toBeInTheDocument();
    const posterReveal = screen.getByRole('button', { name: 'Show 10 more posters' });
    const backdropReveal = screen.getByRole('button', { name: 'Show 10 more backdrops' });
    expect(posterReveal).not.toHaveAttribute('aria-label');
    expect(backdropReveal).not.toHaveAttribute('aria-label');
    expect(posterReveal.querySelector('.movie-import-modal__visually-hidden')).toHaveTextContent('posters');
    expect(backdropReveal.querySelector('.movie-import-modal__visually-hidden')).toHaveTextContent('backdrops');
  });

  it('defers candidate image fetching and decoding to protect modal scrolling', () => {
    renderPicker();

    for (const preview of screen.getAllByRole('img', { name: /(?:Poster|Backdrop) option/i })) {
      expect(preview).toHaveAttribute('loading', 'lazy');
      expect(preview).toHaveAttribute('decoding', 'async');
      expect(preview).toHaveAttribute('fetchpriority', 'low');
    }
  });

  it('reveals ten more posters without revealing more backdrops', async () => {
    renderPicker();

    await userEvent.click(screen.getByRole('button', { name: 'Show 10 more posters' }));

    expect(screen.getAllByRole('img', { name: /Poster option/i })).toHaveLength(20);
    expect(screen.getAllByRole('img', { name: /Backdrop option/i })).toHaveLength(10);
  });

  it('reveals ten more backdrops without revealing more posters', async () => {
    renderPicker();

    await userEvent.click(screen.getByRole('button', { name: 'Show 10 more backdrops' }));

    expect(screen.getAllByRole('img', { name: /Poster option/i })).toHaveLength(10);
    expect(screen.getAllByRole('img', { name: /Backdrop option/i })).toHaveLength(20);
  });

  it('keeps assigned candidates outside the first batch visible once and in source order', () => {
    renderPicker({
      selection: {
        poster: posters[22],
        heroImage: backdrops[22],
        backdrops: [backdrops[20], backdrops[22]],
      },
    });

    const posterPreviews = screen.getAllByRole('img', { name: /Poster option/i });
    expect(posterPreviews).toHaveLength(11);
    expect(posterPreviews.at(-1)).toHaveAttribute('src', posters[22].previewUrl);

    const backdropPreviews = screen.getAllByRole('img', { name: /Backdrop option/i });
    expect(backdropPreviews).toHaveLength(12);
    expect(backdropPreviews.at(-2)).toHaveAttribute('src', backdrops[20].previewUrl);
    expect(backdropPreviews.at(-1)).toHaveAttribute('src', backdrops[22].previewUrl);
  });

  it('hides reveal controls when retained selections make every candidate visible', () => {
    const limitedPosters = posters.slice(0, 11);
    const limitedBackdrops = backdrops.slice(0, 11);

    render(
      <ImagePicker
        images={[...limitedPosters, ...limitedBackdrops]}
        selection={{
          poster: limitedPosters[10]!,
          heroImage: limitedBackdrops[10]!,
          backdrops: [],
        }}
        allowPoster
        allowHeroImage
        allowOtherImages
        onTogglePoster={vi.fn()}
        onSelectHeroImage={vi.fn()}
        onToggleBackdrop={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('img', { name: /Poster option/i })).toHaveLength(11);
    expect(screen.getAllByRole('img', { name: /Backdrop option/i })).toHaveLength(11);
    expect(screen.queryByRole('button', { name: 'Show 10 more posters' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show 10 more backdrops' })).not.toBeInTheDocument();
  });

  it('renders each visible backdrop once with separate destination labels and no status chips', () => {
    renderPicker();

    expect(screen.getAllByRole('img', { name: /Backdrop option/i })).toHaveLength(10);
    expect(screen.getAllByRole('radio', { name: /Use as Hero Image/i })).toHaveLength(10);
    expect(screen.getAllByRole('checkbox', { name: /Add to Other Images/i })).toHaveLength(10);
    expect(screen.getByText('Assign each backdrop to Hero Image, Other Images, or neither. One image cannot be used for both destinations.')).toBeInTheDocument();
    expect(document.querySelector('.movie-import-modal__image-chip')).not.toBeInTheDocument();

    const firstHero = screen.getAllByRole('radio', { name: /Use as Hero Image/i })[0];
    const card = firstHero.closest('article');
    expect(card).toBeInTheDocument();
    expect(card?.tagName).not.toBe('LABEL');
    expect(within(card!).getByRole('radio', { name: /Use as Hero Image/i }).closest('label')).toBeInTheDocument();
    expect(within(card!).getByRole('checkbox', { name: /Add to Other Images/i }).closest('label')).toBeInTheDocument();
  });

  it('renders only the controls for mapped destinations', () => {
    const { unmount } = render(
      <ImagePicker
        images={images}
        selection={{ poster: null, heroImage: null, backdrops: [] }}
        allowPoster={false}
        allowHeroImage
        allowOtherImages={false}
        onTogglePoster={vi.fn()}
        onSelectHeroImage={vi.fn()}
        onToggleBackdrop={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('radio', { name: /Use as Hero Image/i })).toHaveLength(10);
    expect(screen.queryByRole('checkbox', { name: /Add to Other Images/i })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Do not import a Hero Image' })).toBeInTheDocument();

    unmount();
    renderPicker({ allowPoster: false, allowHeroImage: false, allowOtherImages: true });

    expect(screen.queryByRole('radio', { name: /Use as Hero Image/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Do not import a Hero Image' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('checkbox', { name: /Add to Other Images/i })).toHaveLength(10);
  });

  it('keeps the selected Hero opt-out visible when TMDB returns no backdrops', () => {
    render(
      <ImagePicker
        images={[]}
        selection={{ poster: null, heroImage: null, backdrops: [] }}
        allowPoster={false}
        allowHeroImage
        allowOtherImages={false}
        onTogglePoster={vi.fn()}
        onSelectHeroImage={vi.fn()}
        onToggleBackdrop={vi.fn()}
      />,
    );

    expect(screen.getByRole('radio', { name: 'Do not import a Hero Image' })).toBeChecked();
    expect(screen.getByText('TMDB did not return any backdrop candidates.')).toBeInTheDocument();
  });

  it('uses destination-specific accessible names with stable provider identity', () => {
    renderPicker();

    expect(screen.getByRole('radio', {
      name: /Use as Hero Image.*tmdb:\/backdrop-1\.jpg/i,
    })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', {
      name: /Add to Other Images.*tmdb:\/backdrop-1\.jpg/i,
    })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', {
      name: /Use as poster.*tmdb:\/poster-1\.jpg/i,
    })).toBeInTheDocument();
  });

  it('shows Preview unavailable after an image preview fails', () => {
    renderPicker();

    fireEvent.error(screen.getByRole('img', { name: 'Backdrop option 1' }));

    expect(screen.getByRole('img', { name: 'backdrop preview unavailable' })).toHaveTextContent('Preview unavailable');
  });

  it('keeps Hero Image and Other Images mutually exclusive as either control is chosen', async () => {
    render(<StatefulPicker />);

    const firstOther = screen.getByRole('checkbox', {
      name: /Add to Other Images.*tmdb:\/backdrop-1\.jpg/i,
    });
    const firstHero = screen.getByRole('radio', {
      name: /Use as Hero Image.*tmdb:\/backdrop-1\.jpg/i,
    });
    const secondOther = screen.getByRole('checkbox', {
      name: /Add to Other Images.*tmdb:\/backdrop-2\.jpg/i,
    });
    const secondHero = screen.getByRole('radio', {
      name: /Use as Hero Image.*tmdb:\/backdrop-2\.jpg/i,
    });

    expect(firstHero).toBeChecked();
    expect(firstOther).not.toBeChecked();
    await userEvent.click(firstOther);
    expect(firstOther).toBeChecked();
    expect(firstHero).not.toBeChecked();

    expect(secondOther).toBeChecked();
    await userEvent.click(secondHero);
    expect(secondHero).toBeChecked();
    expect(secondOther).not.toBeChecked();
  });
});
