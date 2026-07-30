import { useState } from 'react';
import { Button } from 'datocms-react-ui';
import type { NormalizedImageCandidate } from '../domain/movie';
import type { ImageSelection } from '../providers/imageProvider';
import { isEnglishPoster } from '../providers/imageProvider';
import { touchTargetStyle } from './touchTargets';

const IMAGE_REVEAL_BATCH_SIZE = 10;

type ImagePickerProps = {
  images: NormalizedImageCandidate[];
  selection: ImageSelection;
  allowPoster: boolean;
  allowHeroImage: boolean;
  allowOtherImages: boolean;
  onTogglePoster: (image: NormalizedImageCandidate) => void;
  onSelectHeroImage: (image: NormalizedImageCandidate | null) => void;
  onToggleBackdrop: (image: NormalizedImageCandidate) => void;
};

export function ImagePicker({ images, selection, allowPoster, allowHeroImage, allowOtherImages, onTogglePoster, onSelectHeroImage, onToggleBackdrop }: ImagePickerProps) {
  const [visiblePosterCount, setVisiblePosterCount] = useState(IMAGE_REVEAL_BATCH_SIZE);
  const [visibleBackdropCount, setVisibleBackdropCount] = useState(IMAGE_REVEAL_BATCH_SIZE);
  const posters = images.filter(isEnglishPoster);
  const backdrops = images.filter((image) => image.type === 'backdrop');
  const visiblePosters = visibleWithSelections(
    posters,
    visiblePosterCount,
    [selection.poster],
  );
  const visibleBackdrops = visibleWithSelections(
    backdrops,
    visibleBackdropCount,
    [selection.heroImage, ...selection.backdrops],
  );

  const posterOptions = visiblePosters.map((image, index) => (
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

  const backdropOptions = visibleBackdrops.map((image, index) => (
    <SharedBackdropOption
      key={imageIdentity(image)}
      image={image}
      index={index}
      allowHeroImage={allowHeroImage}
      allowOtherImages={allowOtherImages}
      heroSelected={Boolean(
        selection.heroImage && sameImage(selection.heroImage, image),
      )}
      otherSelected={selection.backdrops.some((selected) =>
        sameImage(selected, image))}
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
        {posters.length > visiblePosterCount ? (
          <div className="movie-import-modal__image-reveal">
            <Button
              buttonType="muted"
              type="button"
              onClick={() => setVisiblePosterCount((count) =>
                Math.min(count + IMAGE_REVEAL_BATCH_SIZE, posters.length))}
            >
              Show 10 more <span className="movie-import-modal__visually-hidden">posters</span>
            </Button>
          </div>
        ) : null}
      </div> : null}
      {allowHeroImage || allowOtherImages ? <div className="movie-import-modal__asset-group">
        <div className="movie-import-modal__asset-copy">
          <h4>Backdrop images</h4>
          <p>Assign each backdrop to Hero Image, Other Images, or neither. One image cannot be used for both destinations.</p>
        </div>
        {backdrops.length > 0 ? (
          <div className="movie-import-modal__image-grid">
            {allowHeroImage ? (
              <NoHeroImageOption
                selected={selection.heroImage === null}
                onChange={() => onSelectHeroImage(null)}
              />
            ) : null}
            {backdropOptions}
          </div>
        ) : <p className="movie-import-modal__empty">TMDB did not return any backdrop candidates.</p>}
        {backdrops.length > visibleBackdropCount ? (
          <div className="movie-import-modal__image-reveal">
            <Button
              buttonType="muted"
              type="button"
              onClick={() => setVisibleBackdropCount((count) =>
                Math.min(count + IMAGE_REVEAL_BATCH_SIZE, backdrops.length))}
            >
              Show 10 more <span className="movie-import-modal__visually-hidden">backdrops</span>
            </Button>
          </div>
        ) : null}
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
  const language = image.language ? image.language.toUpperCase() : 'NA';
  const ariaLabel = `${label}: ${imageKind} option ${optionNumber}, ${imageIdentity(image)}`;

  return (
    <label className="movie-import-modal__image-option" style={touchTargetStyle}>
      <span className="movie-import-modal__image-preview">
        <span className="movie-import-modal__image-canvas">
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
        </span>
        <span className="movie-import-modal__image-meta">{provider} · {dimensions} · {language}</span>
      </span>
      <span className="movie-import-modal__image-footer">
        <input aria-label={ariaLabel} type={inputType} name={inputName} checked={selected} onChange={onChange} />
        <span className="movie-import-modal__image-label">{label}</span>
      </span>
    </label>
  );
}

type NoHeroImageOptionProps = {
  selected: boolean;
  onChange: () => void;
};

function NoHeroImageOption({ selected, onChange }: NoHeroImageOptionProps) {
  return (
    <label className="movie-import-modal__image-option movie-import-modal__image-option--none" style={touchTargetStyle}>
      <span className="movie-import-modal__image-preview">
        <span className="movie-import-modal__image-canvas">
          <span className="movie-import-modal__image-fallback movie-import-modal__image-fallback--none" aria-hidden="true">
            No image
          </span>
        </span>
        <span className="movie-import-modal__image-meta">Leave Hero Image unchanged</span>
      </span>
      <span className="movie-import-modal__image-footer">
        <input aria-label="Do not import a Hero Image" type="radio" name="hero-image-selection" checked={selected} onChange={onChange} />
        <span className="movie-import-modal__image-label">Do not import</span>
      </span>
    </label>
  );
}

type SharedBackdropOptionProps = {
  image: NormalizedImageCandidate;
  index: number;
  allowHeroImage: boolean;
  allowOtherImages: boolean;
  heroSelected: boolean;
  otherSelected: boolean;
  onSelectHero: () => void;
  onToggleOther: () => void;
};

function SharedBackdropOption({
  image,
  index,
  allowHeroImage,
  allowOtherImages,
  heroSelected,
  otherSelected,
  onSelectHero,
  onToggleOther,
}: SharedBackdropOptionProps) {
  const optionNumber = index + 1;
  const dimensions = image.width && image.height ? `${image.width} × ${image.height}` : 'Dimensions unavailable';
  const provider = image.attribution ?? image.providerKey.toUpperCase();
  const languageDescription = image.language ? image.language.toUpperCase() : 'No language metadata';
  const identity = imageIdentity(image);
  const heroAriaLabel = `Use as Hero Image: backdrop option ${optionNumber}, ${identity}, ${provider}, ${dimensions}, ${languageDescription}. Current status: ${heroSelected ? 'selected' : 'not selected'} for Hero Image.`;
  const otherAriaLabel = `Add to Other Images: backdrop option ${optionNumber}, ${identity}, ${provider}, ${dimensions}, ${languageDescription}. Current status: ${otherSelected ? 'selected' : 'not selected'} for Other Images.`;

  return (
    <article className="movie-import-modal__image-option" style={touchTargetStyle}>
      <ImagePreview image={image} index={index} />
      <div className="movie-import-modal__image-footer movie-import-modal__image-footer--destinations">
        {allowHeroImage ? (
          <label className="movie-import-modal__image-destination">
            <input
              aria-label={heroAriaLabel}
              type="radio"
              name="hero-image-selection"
              checked={heroSelected}
              onChange={onSelectHero}
            />
            <span>Hero Image</span>
          </label>
        ) : null}
        {allowOtherImages ? (
          <label className="movie-import-modal__image-destination">
            <input
              aria-label={otherAriaLabel}
              type="checkbox"
              checked={otherSelected}
              onChange={onToggleOther}
            />
            <span>Other Images</span>
          </label>
        ) : null}
      </div>
    </article>
  );
}

function ImagePreview({ image, index }: { image: NormalizedImageCandidate; index: number }) {
  const [previewFailed, setPreviewFailed] = useState(false);
  const optionNumber = index + 1;
  const dimensions = image.width && image.height ? `${image.width} × ${image.height}` : 'Dimensions unavailable';
  const provider = image.attribution ?? image.providerKey.toUpperCase();
  const languageDisplay = image.language ? image.language.toUpperCase() : 'NA';

  return (
    <div className="movie-import-modal__image-preview">
      <div className="movie-import-modal__image-canvas">
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
      </div>
      <span className="movie-import-modal__image-meta">{provider} · {dimensions} · {languageDisplay}</span>
    </div>
  );
}

function visibleWithSelections(
  candidates: NormalizedImageCandidate[],
  count: number,
  selected: Array<NormalizedImageCandidate | null>,
) {
  const selectedKeys = new Set(
    selected
      .filter((candidate): candidate is NormalizedImageCandidate =>
        candidate !== null)
      .map(imageIdentity),
  );

  return candidates.filter(
    (candidate, index) =>
      index < count || selectedKeys.has(imageIdentity(candidate)),
  );
}

function imageIdentity(image: NormalizedImageCandidate) {
  return `${image.providerKey}:${image.providerImageId}`;
}

function sameImage(left: NormalizedImageCandidate, right: NormalizedImageCandidate) {
  return imageIdentity(left) === imageIdentity(right);
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
