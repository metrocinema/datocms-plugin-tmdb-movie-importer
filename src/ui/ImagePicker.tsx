import { useState } from 'react';
import type { NormalizedImageCandidate } from '../domain/movie';
import type { ImageSelection } from '../providers/imageProvider';
import { isEnglishPoster } from '../providers/imageProvider';
import { touchTargetStyle } from './touchTargets';

type ImagePickerProps = {
  images: NormalizedImageCandidate[];
  selection: ImageSelection;
  allowPoster: boolean;
  allowHeroImage: boolean;
  allowOtherImages: boolean;
  onTogglePoster: (image: NormalizedImageCandidate) => void;
  onSelectHeroImage: (image: NormalizedImageCandidate) => void;
  onToggleBackdrop: (image: NormalizedImageCandidate) => void;
};

export function ImagePicker({ images, selection, allowPoster, allowHeroImage, allowOtherImages, onTogglePoster, onSelectHeroImage, onToggleBackdrop }: ImagePickerProps) {
  const posters = images.filter(isEnglishPoster);
  const backdrops = images.filter((image) => image.type === 'backdrop');

  const posterOptions = posters.map((image, index) => (
    <ImageOption
      key={`${image.providerKey}:${image.providerImageId}`}
      image={image}
      index={index}
      inputType="checkbox"
      label="Use as poster"
      selected={Boolean(selection.poster && sameImage(selection.poster, image))}
      onChange={() => onTogglePoster(image)}
    />
  ));

  const heroOptions = backdrops.map((image, index) => (
        <BackdropImageOption
          key={`${image.providerKey}:${image.providerImageId}:hero`}
          image={image}
          index={index}
          allowHeroImage={allowHeroImage}
          allowOtherImages={allowOtherImages}
          heroSelected={Boolean(selection.heroImage && sameImage(selection.heroImage, image))}
          otherSelected={selection.backdrops.some((selected) => sameImage(selected, image))}
      onSelectHero={() => onSelectHeroImage(image)}
      onToggleOther={() => onToggleBackdrop(image)}
    />
  ));

  return (
    <div className="movie-import-modal__review-list">
      {allowPoster ? <div className="movie-import-modal__asset-group">
        <div className="movie-import-modal__asset-copy">
          <h4>Poster</h4>
          <p>Use one vertical poster for listing and detail-page artwork. Selected posters upload after confirmation.</p>
        </div>
        {posters.length > 0 ? <div className="movie-import-modal__image-grid">{posterOptions}</div> : <p className="movie-import-modal__empty">TMDB did not return any English-language poster candidates.</p>}
      </div> : null}
      {allowHeroImage || allowOtherImages ? <div className="movie-import-modal__asset-group">
        <div className="movie-import-modal__asset-copy">
          <h4>Backdrop images</h4>
          <p>Choose where each backdrop should go: Hero image, Other images, or both.</p>
        </div>
        {backdrops.length > 0 ? <div className="movie-import-modal__image-grid">{heroOptions}</div> : <p className="movie-import-modal__empty">TMDB did not return any backdrop candidates.</p>}
      </div> : null}
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
  const ariaLabel = `${label}: ${imageKind} option ${optionNumber}`;

  return (
    <label className="movie-import-modal__image-option" style={touchTargetStyle}>
      <span className="movie-import-modal__image-preview">
        {!previewFailed ? (
          <img
            className={`movie-import-modal__image-thumb movie-import-modal__image-thumb--${image.type}`}
            src={image.previewUrl ?? image.originalUrl}
            alt={`${capitalize(imageKind)} option ${optionNumber}`}
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

type BackdropImageOptionProps = {
  image: NormalizedImageCandidate;
  index: number;
  allowHeroImage: boolean;
  allowOtherImages: boolean;
  heroSelected: boolean;
  otherSelected: boolean;
  onSelectHero: () => void;
  onToggleOther: () => void;
};

function BackdropImageOption({ image, index, allowHeroImage, allowOtherImages, heroSelected, otherSelected, onSelectHero, onToggleOther }: BackdropImageOptionProps) {
  const [previewFailed, setPreviewFailed] = useState(false);
  const optionNumber = index + 1;
  const dimensions = image.width && image.height ? `${image.width} × ${image.height}` : 'Dimensions unavailable';
  const provider = image.attribution ?? image.providerKey.toUpperCase();
  const language = image.language ? image.language.toUpperCase() : 'No language tag';

  return (
    <fieldset className="movie-import-modal__image-option movie-import-modal__image-option--multi" style={touchTargetStyle}>
      <legend className="movie-import-modal__visually-hidden">Backdrop option {optionNumber}</legend>
      <span className="movie-import-modal__image-preview">
        {!previewFailed ? (
          <img
            className="movie-import-modal__image-thumb movie-import-modal__image-thumb--backdrop"
            src={image.previewUrl ?? image.originalUrl}
            alt={`Backdrop option ${optionNumber}`}
            loading="lazy"
            width={120}
            height={68}
            onError={() => setPreviewFailed(true)}
          />
        ) : (
          <span className="movie-import-modal__image-fallback" role="img" aria-label="backdrop preview unavailable">
            Preview unavailable
          </span>
        )}
        <span className="movie-import-modal__image-meta">{provider} · {dimensions} · {language}</span>
      </span>
      <span className="movie-import-modal__image-footer movie-import-modal__image-footer--stacked">
        {allowHeroImage ? <label>
          <input aria-label={`Use as Hero image: backdrop option ${optionNumber}`} type="radio" name="hero-image-selection" checked={heroSelected} onChange={onSelectHero} />
          <span className="movie-import-modal__image-label">Hero</span>
        </label> : null}
        {allowOtherImages ? <label>
          <input aria-label={`Add to Other images: backdrop option ${optionNumber}`} type="checkbox" checked={otherSelected} onChange={onToggleOther} />
          <span className="movie-import-modal__image-label">Other images</span>
        </label> : null}
      </span>
    </fieldset>
  );
}

function sameImage(left: NormalizedImageCandidate, right: NormalizedImageCandidate) {
  return left.providerKey === right.providerKey && left.providerImageId === right.providerImageId;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
