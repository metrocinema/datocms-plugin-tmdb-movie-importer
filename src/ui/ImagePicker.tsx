import type { NormalizedImageCandidate } from '../domain/movie';
import { isEnglishPoster } from '../providers/imageProvider';
import { touchTargetStyle } from './touchTargets';

type ImagePickerProps = {
  images: NormalizedImageCandidate[];
  selectedIds: string[];
  onToggle: (providerImageId: string) => void;
};

export function ImagePicker({ images, selectedIds, onToggle }: ImagePickerProps) {
  const posters = images.filter(isEnglishPoster);
  const backdrops = images.filter((image) => image.type === 'backdrop');
  const heroBackdropId = selectedIds.find((providerImageId) => backdrops.some((image) => image.providerImageId === providerImageId));

  const imageOptions = (candidates: NormalizedImageCandidate[]) => candidates.map((image) => (
    <label key={`${image.providerKey}:${image.providerImageId}`} className="movie-import-modal__image-option" style={touchTargetStyle}>
      <input type="checkbox" checked={selectedIds.includes(image.providerImageId)} onChange={() => onToggle(image.providerImageId)} />
      <img className={`movie-import-modal__image-thumb movie-import-modal__image-thumb--${image.type}`} src={image.originalUrl} alt={`${image.type} candidate`} loading="lazy" width={120} height={image.type === 'poster' ? 180 : 68} />
      {image.providerImageId === heroBackdropId ? <span className="movie-import-modal__badge">Hero image selection</span> : null}
    </label>
  ));

  return (
    <div className="movie-import-modal__review-list">
      <div className="movie-import-modal__asset-group">
        <div className="movie-import-modal__asset-copy">
          <h4>Poster</h4>
          <p>Usually one vertical image for listing and detail-page artwork.</p>
        </div>
        {posters.length > 0 ? <div className="movie-import-modal__image-grid">{imageOptions(posters)}</div> : <p className="movie-import-modal__empty">TMDB did not return an English-language poster candidate.</p>}
      </div>
      <div className="movie-import-modal__asset-group">
        <div className="movie-import-modal__asset-copy">
          <h4>Hero image</h4>
          <p>The first selected backdrop becomes the Hero image. All selected backdrops are added to Other images.</p>
          <h4>Other images</h4>
          <p>Select every backdrop you want available in the gallery.</p>
        </div>
        {backdrops.length > 0 ? <div className="movie-import-modal__image-grid">{imageOptions(backdrops)}</div> : <p className="movie-import-modal__empty">TMDB did not return backdrop candidates.</p>}
      </div>
    </div>
  );
}
