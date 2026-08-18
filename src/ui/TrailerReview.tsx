import { useState } from 'react';
import type { FieldComparison } from '../domain/fieldComparison';
import type { NormalizedTrailerCandidate } from '../domain/trailer';
import { touchTargetStyle } from './touchTargets';

type TrailerReviewProps = {
  trailer: NormalizedTrailerCandidate | null;
  comparison: FieldComparison;
  onToggle: () => void;
};

type ExternalVideoSummary = {
  provider: string;
  title: string | null;
};

export function TrailerReview({ trailer, comparison, onToggle }: TrailerReviewProps) {
  const [previewFailed, setPreviewFailed] = useState(false);
  const currentVideo = summarizeCurrentVideo(comparison.currentValue);

  if (!trailer || !comparison.available) {
    return (
      <div className="movie-import-modal__trailer-empty">
        <p className="movie-import-modal__empty">No official English YouTube trailer found.</p>
        {currentVideo ? (
          <p className="movie-import-modal__trailer-current">
            Current: {formatCurrentVideoSummary(currentVideo)}
          </p>
        ) : null}
      </div>
    );
  }

  const canSelect = comparison.changed;
  const publishedAtLabel = formatPublishedAt(trailer.publishedAt);
  const metadataLabel = `${trailer.attribution} · ${trailer.width} × ${trailer.height} · ${trailer.language.toUpperCase()}`;

  const preview = (
    <span className="movie-import-modal__trailer-preview">
      {!previewFailed ? (
        <img
          alt=""
          className="movie-import-modal__trailer-thumb"
          decoding="async"
          loading="lazy"
          src={trailer.thumbnailUrl}
          onError={() => setPreviewFailed(true)}
        />
      ) : (
        <span className="movie-import-modal__trailer-preview-fallback">Preview unavailable</span>
      )}
    </span>
  );

  const trailerDetails = (
    <>
      <span className="movie-import-modal__trailer-heading">{trailer.title}</span>
      <span className="movie-import-modal__image-meta movie-import-modal__trailer-meta">
        {metadataLabel}
      </span>
    </>
  );

  const supportingDetails = (
    <span className="movie-import-modal__trailer-supporting">
      {publishedAtLabel ? (
        <span className="movie-import-modal__trailer-current">Published {publishedAtLabel}</span>
      ) : null}
      {currentVideo ? (
        <span className="movie-import-modal__trailer-current">
          Current: {formatCurrentVideoSummary(currentVideo)}
        </span>
      ) : (
        <span className="movie-import-modal__trailer-current">Current: Empty</span>
      )}
    </span>
  );

  return (
    <>
      {canSelect ? (
        <label
          className="movie-import-modal__image-option movie-import-modal__trailer-card"
          style={touchTargetStyle}
        >
          <span className="movie-import-modal__trailer-card-main">
            {preview}
            <span className="movie-import-modal__trailer-body">
              <span className="movie-import-modal__trailer-choice-copy">
                {trailerDetails}
              </span>
              {supportingDetails}
            </span>
          </span>
          <span className="movie-import-modal__image-footer movie-import-modal__trailer-footer">
            <input
              aria-label="Import Official Trailer"
              type="checkbox"
              checked={comparison.selected}
              onChange={onToggle}
            />
            <span className="movie-import-modal__image-label">Import Official Trailer</span>
          </span>
        </label>
      ) : (
        <article className="movie-import-modal__trailer-card movie-import-modal__trailer-card--static">
          <div className="movie-import-modal__trailer-card-main">
            {preview}
            <div className="movie-import-modal__trailer-body">
              <span className="movie-import-modal__trailer-choice-copy">
                {trailerDetails}
              </span>
              {supportingDetails}
            </div>
          </div>
          <div className="movie-import-modal__image-footer movie-import-modal__trailer-footer">
            <span className="movie-import-modal__image-label">Current trailer</span>
          </div>
        </article>
      )}
      <p className="movie-import-modal__trailer-link-row">
        <a href={trailer.watchUrl} target="_blank" rel="noopener noreferrer">
          Preview on YouTube
        </a>
      </p>
    </>
  );
}

function summarizeCurrentVideo(value: unknown): ExternalVideoSummary | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  if (typeof candidate.provider !== 'string' || candidate.provider.length === 0) {
    return null;
  }

  return {
    provider: candidate.provider,
    title: typeof candidate.title === 'string' && candidate.title.length > 0 ? candidate.title : null,
  };
}

function formatCurrentVideoSummary(currentVideo: ExternalVideoSummary) {
  return `${currentVideo.title ?? 'Untitled video'} · ${providerLabel(currentVideo.provider)}`;
}

function providerLabel(provider: string) {
  if (provider.toLowerCase() === 'youtube') {
    return 'YouTube';
  }

  return provider;
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
