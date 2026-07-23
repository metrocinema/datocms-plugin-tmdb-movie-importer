import { useState } from 'react';
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

  const posterOptions = posters.map((image, index) => (
    <ImageOption
      key={`${image.providerKey}:${image.providerImageId}`}
      image={image}
      index={index}
      inputType="checkbox"
      label="Use as poster"
      selected={selection.poster?.providerImageId === image.providerImageId}
      onChange={() => onTogglePoster(image.providerImageId)}
    />
  ));

  const heroOptions = backdrops.map((image, index) => (
    <ImageOption
      key={`${image.providerKey}:${image.providerImageId}:hero`}
      image={image}
      index={index}
      inputType="radio"
      inputName="hero-image-selection"
      label="Use as Hero image"
      selected={selection.heroImage?.providerImageId === image.providerImageId}
      onChange={() => onSelectHeroImage(image.providerImageId)}
    />
  ));

  const backdropOptions = backdrops.map((image, index) => (
    <ImageOption
      key={`${image.providerKey}:${image.providerImageId}:other`}
      image={image}
      index={index}
      inputType="checkbox"
      label="Add to Other images"
      selected={selection.backdrops.some((selected) => selected.providerImageId === image.providerImageId)}
      onChange={() => onToggleBackdrop(image.providerImageId)}
    />
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

type ImageOptionProps = {
  image: NormalizedImageCandidate;
  index: number;
  inputType: 'checkbox' | 'radio';
  inputName?: string;
  label: string;
  selected: boolean;
  onChange: () => void;
};

function ImageOption({ image, index, inputType, inputName, label, selected, onChange }: ImageOptionProps) {
  const [previewFailed, setPreviewFailed] = useState(false);
  const imageKind = image.type === 'poster' ? 'poster' : 'backdrop';
  const optionNumber = index + 1;
  const dimensions = image.width && image.height ? `${image.width} × ${image.height}` : 'Dimensions unavailable';
  const provider = image.attribution ?? image.providerKey.toUpperCase();
  const language = image.language ? image.language.toUpperCase() : 'No language tag';
  const ariaLabel = `${label}: ${imageKind} image ${optionNumber}`;

  return (
    <label className="movie-import-modal__image-option" style={touchTargetStyle}>
      <span className="movie-import-modal__image-preview">
        {!previewFailed ? (
          <img
            className={`movie-import-modal__image-thumb movie-import-modal__image-thumb--${image.type}`}
            src={image.originalUrl}
            alt={`${imageKind} candidate`}
            loading="lazy"
            width={120}
            height={image.type === 'poster' ? 180 : 68}
            onError={() => setPreviewFailed(true)}
          />
        ) : (
          <span className="movie-import-modal__image-fallback" role="img" aria-label={`${imageKind} preview unavailable`}>
            Preview unavailable
          </span>
        )}
        <span className="movie-import-modal__image-meta">{provider} · {dimensions} · {language}</span>
      </span>
      <span className="movie-import-modal__image-footer">
        <input aria-label={ariaLabel} type={inputType} name={inputName} checked={selected} onChange={onChange} />
        <span className="movie-import-modal__image-label">{label}</span>
      </span>
    </label>
  );
}
