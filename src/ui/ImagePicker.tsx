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
  onSelectHeroImage: (image: NormalizedImageCandidate | null) => void;
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

  const heroOptions = backdrops.map((image, index) => {
    const otherSelected = selection.backdrops.some((selected) => sameImage(selected, image));

    return (
      <BackdropDestinationOption
        key={`${image.providerKey}:${image.providerImageId}:hero`}
        image={image}
        index={index}
        destination="hero"
        selected={Boolean(selection.heroImage && sameImage(selection.heroImage, image))}
        secondaryStatus={otherSelected ? 'Also in Other Images' : null}
        onChange={() => onSelectHeroImage(image)}
      />
    );
  });

  const otherImageOptions = backdrops.map((image, index) => {
    const heroSelected = Boolean(selection.heroImage && sameImage(selection.heroImage, image));

    return (
      <BackdropDestinationOption
        key={`${image.providerKey}:${image.providerImageId}:other`}
        image={image}
        index={index}
        destination="other"
        selected={selection.backdrops.some((selected) => sameImage(selected, image))}
        secondaryStatus={heroSelected ? 'Also Hero Image' : null}
        onChange={() => onToggleBackdrop(image)}
      />
    );
  });

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
          <p>Choose a single Hero Image and any backdrops to add to Other Images. The same backdrop can be used in both places.</p>
        </div>
        {backdrops.length > 0 ? (
          <div className="movie-import-modal__destination-stack">
            {allowHeroImage ? (
              <div className="movie-import-modal__destination-lane">
                <div className="movie-import-modal__destination-heading">
                  <h5>Hero Image</h5>
                  <p>Choose one backdrop for the Hero Image field, or skip this destination.</p>
                </div>
                <div className="movie-import-modal__image-grid">
                  <NoHeroImageOption selected={selection.heroImage === null} onChange={() => onSelectHeroImage(null)} />
                  {heroOptions}
                </div>
              </div>
            ) : null}
            {allowOtherImages ? (
              <div className="movie-import-modal__destination-lane">
                <div className="movie-import-modal__destination-heading">
                  <h5>Other Images</h5>
                  <p>Select every backdrop to upload to the Other Images gallery field.</p>
                </div>
                <div className="movie-import-modal__image-grid">{otherImageOptions}</div>
              </div>
            ) : null}
          </div>
        ) : <p className="movie-import-modal__empty">TMDB did not return any backdrop candidates.</p>}
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
  const language = image.language ? image.language.toUpperCase() : 'No language metadata';
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

type NoHeroImageOptionProps = {
  selected: boolean;
  onChange: () => void;
};

function NoHeroImageOption({ selected, onChange }: NoHeroImageOptionProps) {
  return (
    <label className="movie-import-modal__image-option movie-import-modal__image-option--none" style={touchTargetStyle}>
      <span className="movie-import-modal__image-preview">
        <span className="movie-import-modal__image-fallback movie-import-modal__image-fallback--none" aria-hidden="true">
          No image
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

type BackdropDestinationOptionProps = {
  image: NormalizedImageCandidate;
  index: number;
  destination: 'hero' | 'other';
  selected: boolean;
  secondaryStatus: string | null;
  onChange: () => void;
};

function BackdropDestinationOption({ image, index, destination, selected, secondaryStatus, onChange }: BackdropDestinationOptionProps) {
  const [previewFailed, setPreviewFailed] = useState(false);
  const optionNumber = index + 1;
  const dimensions = image.width && image.height ? `${image.width} × ${image.height}` : 'Dimensions unavailable';
  const provider = image.attribution ?? image.providerKey.toUpperCase();
  const language = image.language ? image.language.toUpperCase() : 'No language metadata';
  const isHeroDestination = destination === 'hero';
  const inputType = isHeroDestination ? 'radio' : 'checkbox';
  const inputName = isHeroDestination ? 'hero-image-selection' : undefined;
  const label = isHeroDestination ? 'Use as Hero Image' : 'Add to Other Images';
  const selectedStatus = isHeroDestination ? 'Hero Image' : 'Other Images';
  const statusParts = [
    selected ? `selected for ${selectedStatus}` : `not selected for ${selectedStatus}`,
    secondaryStatus ? accessibleSecondaryStatus(secondaryStatus) : null,
  ].filter(Boolean);
  const ariaLabel = `${label}: backdrop option ${optionNumber}, ${provider}, ${dimensions}, ${language}. Current status: ${statusParts.join('; ')}.`;

  return (
    <label className="movie-import-modal__image-option" style={touchTargetStyle}>
      <span className="movie-import-modal__image-status" aria-hidden="true">
        {selected ? <span className="movie-import-modal__image-chip">{selectedStatus}</span> : null}
        {secondaryStatus ? <span className="movie-import-modal__image-chip movie-import-modal__image-chip--muted">{secondaryStatus}</span> : null}
      </span>
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
      <span className="movie-import-modal__image-footer">
        <input aria-label={ariaLabel} type={inputType} name={inputName} checked={selected} onChange={onChange} />
        <span className="movie-import-modal__image-label">{label}</span>
      </span>
    </label>
  );
}

function sameImage(left: NormalizedImageCandidate, right: NormalizedImageCandidate) {
  return left.providerKey === right.providerKey && left.providerImageId === right.providerImageId;
}

function accessibleSecondaryStatus(status: string) {
  if (status === 'Also in Other Images') return 'also selected for Other Images';
  if (status === 'Also Hero Image') return 'also selected as Hero Image';
  return status;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
