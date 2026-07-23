import type { NormalizedImageCandidate } from '../domain/movie';
import type { ImageSelection } from '../providers/imageProvider';
import { isEnglishPoster } from '../providers/imageProvider';
import { touchTargetStyle } from './touchTargets';

type ImagePickerProps = {
  images: NormalizedImageCandidate[];
  selection: ImageSelection;
  onTogglePoster: (providerImageId: string) => void;
  onSelectHeroImage: (providerImageId: string) => void;
  onToggleBackdrop: (providerImageId: string) => void;
};

export function ImagePicker({ images, selection, onTogglePoster, onSelectHeroImage, onToggleBackdrop }: ImagePickerProps) {
  const posters = images.filter(isEnglishPoster);
  const backdrops = images.filter((image) => image.type === 'backdrop');

  const posterOptions = posters.map((image) => (
    <label key={`${image.providerKey}:${image.providerImageId}`} className="movie-import-modal__image-option" style={touchTargetStyle}>
      <input type="checkbox" checked={selection.poster?.providerImageId === image.providerImageId} onChange={() => onTogglePoster(image.providerImageId)} />
      <img className={`movie-import-modal__image-thumb movie-import-modal__image-thumb--${image.type}`} src={image.originalUrl} alt={`${image.type} candidate`} loading="lazy" width={120} height={image.type === 'poster' ? 180 : 68} />
      <span className="movie-import-modal__image-label">Use as poster</span>
    </label>
  ));

  const heroOptions = backdrops.map((image) => (
    <label key={`${image.providerKey}:${image.providerImageId}:hero`} className="movie-import-modal__image-option" style={touchTargetStyle}>
      <input type="radio" name="hero-image-selection" checked={selection.heroImage?.providerImageId === image.providerImageId} onChange={() => onSelectHeroImage(image.providerImageId)} />
      <img className="movie-import-modal__image-thumb movie-import-modal__image-thumb--backdrop" src={image.originalUrl} alt="hero image candidate" loading="lazy" width={120} height={68} />
      <span className="movie-import-modal__image-label">Use as Hero image</span>
    </label>
  ));

  const backdropOptions = backdrops.map((image) => (
    <label key={`${image.providerKey}:${image.providerImageId}:other`} className="movie-import-modal__image-option" style={touchTargetStyle}>
      <input type="checkbox" checked={selection.backdrops.some((selected) => selected.providerImageId === image.providerImageId)} onChange={() => onToggleBackdrop(image.providerImageId)} />
      <img className="movie-import-modal__image-thumb movie-import-modal__image-thumb--backdrop" src={image.originalUrl} alt="other image candidate" loading="lazy" width={120} height={68} />
      <span className="movie-import-modal__image-label">Add to Other images</span>
    </label>
  ));

  return (
    <div className="movie-import-modal__review-list">
      <div className="movie-import-modal__asset-group">
        <div className="movie-import-modal__asset-copy">
          <h4>Poster</h4>
          <p>Usually one vertical image for listing and detail-page artwork.</p>
        </div>
        {posters.length > 0 ? <div className="movie-import-modal__image-grid">{posterOptions}</div> : <p className="movie-import-modal__empty">TMDB did not return an English-language poster candidate.</p>}
      </div>
      <div className="movie-import-modal__asset-group">
        <div className="movie-import-modal__asset-copy">
          <h4>Hero image</h4>
          <p>Choose one TMDB backdrop for the single Hero image field.</p>
        </div>
        {backdrops.length > 0 ? <div className="movie-import-modal__image-grid">{heroOptions}</div> : <p className="movie-import-modal__empty">TMDB did not return backdrop candidates.</p>}
      </div>
      <div className="movie-import-modal__asset-group">
        <div className="movie-import-modal__asset-copy">
          <h4>Other images</h4>
          <p>Select every backdrop you want available in the gallery. These choices are separate from the Hero image.</p>
        </div>
        {backdrops.length > 0 ? <div className="movie-import-modal__image-grid">{backdropOptions}</div> : <p className="movie-import-modal__empty">TMDB did not return backdrop candidates.</p>}
      </div>
    </div>
  );
}
