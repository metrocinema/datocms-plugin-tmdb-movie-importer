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
  const canSelect = comparison.available && comparison.changed && trailer !== null;
  const isAlreadyCurrent = comparison.available && !comparison.changed && trailer !== null;
  const currentVideo = summarizeCurrentVideo(comparison.currentValue);
  const publishedAtLabel = trailer ? formatPublishedAt(trailer.publishedAt) : null;
  const cardClassName = comparison.selected && canSelect
    ? 'movie-import-modal__trailer-card movie-import-modal__trailer-card--selected'
    : 'movie-import-modal__trailer-card';

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

  return (
    <article className={cardClassName}>
      <div className="movie-import-modal__trailer-preview">
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
      </div>
      <div className="movie-import-modal__trailer-body">
        <label
          className={canSelect || isAlreadyCurrent
            ? 'movie-import-modal__trailer-choice'
            : 'movie-import-modal__trailer-choice movie-import-modal__trailer-choice--static'}
          style={touchTargetStyle}
        >
          <input
            aria-label="Import Official Trailer"
            type="checkbox"
            checked={canSelect ? comparison.selected : false}
            disabled={!canSelect}
            onChange={onToggle}
          />
          <span className="movie-import-modal__trailer-choice-copy">
            <span className="movie-import-modal__trailer-choice-title">Import Official Trailer</span>
            <span className="movie-import-modal__trailer-heading">{trailer.title}</span>
            <span className="movie-import-modal__trailer-meta">
              <span className="movie-import-modal__trailer-chip">Official</span>
              <span className="movie-import-modal__trailer-chip">English</span>
              <span className="movie-import-modal__trailer-chip">{trailer.resolution}p</span>
            </span>
          </span>
        </label>
        <div className="movie-import-modal__trailer-supporting">
          {isAlreadyCurrent ? (
            <p className="movie-import-modal__trailer-status">Already current trailer</p>
          ) : null}
          {publishedAtLabel ? (
            <p className="movie-import-modal__trailer-current">Published {publishedAtLabel}</p>
          ) : null}
          {currentVideo ? (
            <p className="movie-import-modal__trailer-current">
              Current: {formatCurrentVideoSummary(currentVideo)}
            </p>
          ) : (
            <p className="movie-import-modal__trailer-current">Current: Empty</p>
          )}
          <p className="movie-import-modal__trailer-link-row">
            <a href={trailer.watchUrl} target="_blank" rel="noopener noreferrer">
              Preview on YouTube
            </a>
          </p>
        </div>
      </div>
    </article>
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
