import { useId, useState, type KeyboardEvent } from 'react';
import type { FieldComparison } from '../domain/fieldComparison';
import {
  datoExternalVideoValue,
  sameExternalVideo,
  type NormalizedTrailerCandidate,
} from '../domain/trailer';
import { touchTargetStyle } from './touchTargets';

type TrailerReviewProps = {
  trailers: NormalizedTrailerCandidate[];
  selectedTrailer: NormalizedTrailerCandidate | null;
  comparison: FieldComparison;
  onSelect: (trailer: NormalizedTrailerCandidate | null) => void;
};

type ExternalVideoSummary = {
  provider: string;
  title: string | null;
  url: string | null;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
};

export function TrailerReview({ trailers, selectedTrailer, comparison, onSelect }: TrailerReviewProps) {
  const currentVideo = summarizeCurrentVideo(comparison.currentValue);
  const selectableTrailers = trailers.filter((trailer) => (
    !sameExternalVideo(comparison.currentValue, datoExternalVideoValue(trailer))
  ));
  let noAlternativesMessage: string | null = null;

  if (selectableTrailers.length === 0) {
    noAlternativesMessage = trailers.length > 0 && currentVideo
      ? 'The current trailer already matches TMDB. No alternative trailers are available.'
      : 'No official English YouTube trailers found.';
  }

  return (
    <div className="movie-import-modal__trailer-review">
      <div
        aria-label="Trailer import choice"
        className="movie-import-modal__trailer-grid"
        role="radiogroup"
        onKeyDown={handleTrailerChoiceKeyDown}
      >
        {currentVideo ? (
          <CurrentTrailerOption
            currentVideo={currentVideo}
            selected={selectedTrailer === null}
            onSelect={() => onSelect(null)}
          />
        ) : (
          <EmptyTrailerOption
            selected={selectedTrailer === null}
            onSelect={() => onSelect(null)}
          />
        )}
        {selectableTrailers.map((trailer) => (
          <TrailerOption
            key={trailer.providerVideoId}
            trailer={trailer}
            selected={selectedTrailer?.providerVideoId === trailer.providerVideoId}
            onSelect={() => onSelect(trailer)}
          />
        ))}
      </div>
      {noAlternativesMessage ? (
        <p className="movie-import-modal__empty">{noAlternativesMessage}</p>
      ) : null}
    </div>
  );
}

function handleTrailerChoiceKeyDown(event: KeyboardEvent<HTMLDivElement>) {
  if (!(event.target instanceof HTMLInputElement) || event.target.type !== 'radio') {
    return;
  }

  const choices = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
  const currentIndex = choices.indexOf(event.target);

  if (currentIndex === -1) {
    return;
  }

  const nextIndex = (() => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      return (currentIndex + 1) % choices.length;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      return (currentIndex - 1 + choices.length) % choices.length;
    }

    if (event.key === 'Home') {
      return 0;
    }

    if (event.key === 'End') {
      return choices.length - 1;
    }

    return null;
  })();

  if (nextIndex === null) {
    return;
  }

  event.preventDefault();
  choices[nextIndex].focus();
  choices[nextIndex].click();
}

type TrailerOptionProps = {
  trailer: NormalizedTrailerCandidate;
  selected: boolean;
  onSelect: () => void;
};

function TrailerPreview({ thumbnailUrl }: { thumbnailUrl: string | null }) {
  const [previewFailed, setPreviewFailed] = useState(false);

  return (
    <span className="movie-import-modal__trailer-preview">
      {thumbnailUrl && !previewFailed ? (
        <img
          alt=""
          className="movie-import-modal__trailer-thumb"
          decoding="async"
          loading="lazy"
          src={thumbnailUrl}
          onError={() => setPreviewFailed(true)}
        />
      ) : (
        <span className="movie-import-modal__trailer-preview-fallback">Preview unavailable</span>
      )}
    </span>
  );
}

function TrailerOption({ trailer, selected, onSelect }: TrailerOptionProps) {
  const metadataId = useId();
  const publishedAtId = useId();
  const publishedAtLabel = formatPublishedAt(trailer.publishedAt);
  const metadataLabel = [
    trailer.attribution,
    `${trailer.width} × ${trailer.height}`,
    trailer.country,
    trailer.language.toUpperCase(),
  ].filter(Boolean).join(' · ');
  const cardMain = (
    <span className="movie-import-modal__trailer-card-main">
      <TrailerPreview thumbnailUrl={trailer.thumbnailUrl} />
      <span className="movie-import-modal__trailer-body">
        <span className="movie-import-modal__trailer-heading">{trailer.title}</span>
        <span id={metadataId} className="movie-import-modal__image-meta movie-import-modal__trailer-meta">
          {metadataLabel}
        </span>
        {publishedAtLabel ? (
          <span id={publishedAtId} className="movie-import-modal__trailer-current">
            Published {publishedAtLabel}
          </span>
        ) : null}
      </span>
    </span>
  );

  return (
    <div className="movie-import-modal__trailer-option">
      <label
        className="movie-import-modal__image-option movie-import-modal__trailer-card"
        style={touchTargetStyle}
      >
        {cardMain}
        <span className="movie-import-modal__image-footer movie-import-modal__trailer-footer">
          <input
            aria-describedby={[metadataId, publishedAtLabel ? publishedAtId : null].filter(Boolean).join(' ')}
            aria-label={`Replace with ${trailer.title}`}
            checked={selected}
            name="trailer-import"
            type="radio"
            onChange={onSelect}
          />
          <span className="movie-import-modal__image-label">Replace with this trailer</span>
        </span>
      </label>
      <p className="movie-import-modal__trailer-link-row">
        <a
          aria-label={`Preview ${trailer.title} on YouTube`}
          href={trailer.watchUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Preview on YouTube
        </a>
      </p>
    </div>
  );
}

function CurrentTrailerOption({
  currentVideo,
  selected,
  onSelect,
}: {
  currentVideo: ExternalVideoSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const metadataId = useId();
  const metadataLabel = [
    'DatoCMS',
    currentVideo.width !== null && currentVideo.height !== null
      ? `${currentVideo.width} × ${currentVideo.height}`
      : null,
    providerLabel(currentVideo.provider),
  ].filter(Boolean).join(' · ');

  return (
    <div className="movie-import-modal__trailer-option">
      <label
        className="movie-import-modal__image-option movie-import-modal__trailer-card"
        style={touchTargetStyle}
      >
        <span className="movie-import-modal__trailer-card-main">
          <TrailerPreview thumbnailUrl={currentVideo.thumbnailUrl} />
          <span className="movie-import-modal__trailer-body">
            <span className="movie-import-modal__trailer-heading">
              {currentVideo.title ?? 'Untitled video'}
            </span>
            <span id={metadataId} className="movie-import-modal__image-meta movie-import-modal__trailer-meta">
              {metadataLabel}
            </span>
            <span className="movie-import-modal__trailer-current">Current DatoCMS trailer</span>
          </span>
        </span>
        <span className="movie-import-modal__image-footer movie-import-modal__trailer-footer">
          <input
            aria-describedby={metadataId}
            aria-label="Keep current trailer"
            checked={selected}
            name="trailer-import"
            type="radio"
            onChange={onSelect}
          />
          <span className="movie-import-modal__image-label">Keep current trailer</span>
        </span>
      </label>
      {currentVideo.url ? (
        <p className="movie-import-modal__trailer-link-row">
          <a
            aria-label={`Preview ${currentVideo.title ?? 'current trailer'} on ${providerLabel(currentVideo.provider)}`}
            href={currentVideo.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Preview current trailer on {providerLabel(currentVideo.provider)}
          </a>
        </p>
      ) : (
        <TrailerLinkPlaceholder />
      )}
    </div>
  );
}

function EmptyTrailerOption({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  return (
    <div className="movie-import-modal__trailer-option">
      <label
        className="movie-import-modal__image-option movie-import-modal__trailer-card movie-import-modal__trailer-card--none"
        style={touchTargetStyle}
      >
        <span className="movie-import-modal__trailer-none-preview">
          <span>No current trailer</span>
          <small>Leave the Trailer field empty</small>
        </span>
        <span className="movie-import-modal__image-footer movie-import-modal__trailer-footer">
          <input
            aria-label="Keep trailer empty"
            checked={selected}
            name="trailer-import"
            type="radio"
            onChange={onSelect}
          />
          <span className="movie-import-modal__image-label">Keep trailer empty</span>
        </span>
      </label>
      <TrailerLinkPlaceholder />
    </div>
  );
}

function TrailerLinkPlaceholder() {
  return (
    <span
      aria-hidden="true"
      className="movie-import-modal__trailer-link-row movie-import-modal__trailer-link-row--placeholder"
    >
      &nbsp;
    </span>
  );
}

function summarizeCurrentVideo(value: unknown): ExternalVideoSummary | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  if (typeof candidate.provider !== 'string' || candidate.provider.trim().length === 0) {
    return null;
  }

  return {
    provider: candidate.provider.trim(),
    title: trimmedString(candidate.title),
    url: trimmedString(candidate.url),
    thumbnailUrl: trimmedString(candidate.thumbnail_url),
    width: positiveNumber(candidate.width),
    height: positiveNumber(candidate.height),
  };
}

function trimmedString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function positiveNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function providerLabel(provider: string) {
  if (provider.trim().toLowerCase() === 'youtube') {
    return 'YouTube';
  }

  return provider.trim();
}

function formatPublishedAt(publishedAt: string | null) {
  if (!publishedAt) {
    return null;
  }

  const value = new Date(publishedAt);

  if (Number.isNaN(value.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(value);
}
