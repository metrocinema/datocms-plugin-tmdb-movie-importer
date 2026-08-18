import { useEffect, useState } from 'react';
import { Button, Section } from 'datocms-react-ui';
import type { FieldComparison } from '../domain/fieldComparison';
import type { NormalizedImageCandidate, NormalizedMovie, PersonCandidate } from '../domain/movie';
import type { MovieFieldKey } from '../domain/movie';
import type { PersonMatchDecision } from '../domain/personMatching';
import type { ImageSelection } from '../providers/imageProvider';
import type { NormalizedTrailerCandidate } from '../domain/trailer';
import { FieldDiffTable } from './FieldDiffTable';
import { ImagePicker } from './ImagePicker';
import { isEnglishPoster } from '../providers/imageProvider';
import { formatImpactSegments, formatRuntime, formatYear, pluralize } from './modalPresentation';
import { ModalStepIndicator } from './ModalStepIndicator';
import { PersonResolutionList } from './PersonResolutionList';
import { TrailerReview } from './TrailerReview';

type ReviewStepProps = {
  movie: NormalizedMovie;
  comparisons: FieldComparison[];
  mappedFields: MovieFieldKey[];
  onToggle: (key: FieldComparison['key']) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onContinue: () => void;
  onBack: () => void;
  people: Array<{ candidate: PersonCandidate; decision: PersonMatchDecision }>;
  onResolvePerson: (candidate: PersonCandidate, value: 'create' | `reuse:${string}`) => void;
  selectedTrailer: NormalizedTrailerCandidate | null;
  onSelectTrailer: (trailer: NormalizedTrailerCandidate | null) => void;
  images: NormalizedImageCandidate[];
  imageSelection: ImageSelection;
  onTogglePoster: (image: NormalizedImageCandidate | null) => void;
  onSelectHeroImage: (image: NormalizedImageCandidate | null) => void;
  onToggleBackdrop: (image: NormalizedImageCandidate) => void;
};

export function ReviewStep({ movie, comparisons, mappedFields, onToggle, onSelectAll, onClearAll, onContinue, onBack, people, onResolvePerson, selectedTrailer, onSelectTrailer, images, imageSelection, onTogglePoster, onSelectHeroImage, onToggleBackdrop }: ReviewStepProps) {
  const [selectedMovieOpen, setSelectedMovieOpen] = useState(true);
  const mappedFieldSet = new Set(mappedFields);
  const trailerComparison = comparisons.find((comparison) => comparison.key === 'trailer');
  const scalarComparisons = comparisons.filter((comparison) => comparison.key !== 'trailer');
  const hasPosterDestination = mappedFieldSet.has('poster');
  const hasHeroDestination = mappedFieldSet.has('heroImage');
  const hasOtherImagesDestination = mappedFieldSet.has('backdrops');
  const hasTrailerDestination = mappedFieldSet.has('trailer');
  const hasImageDestinations = hasPosterDestination || hasHeroDestination || hasOtherImagesDestination;
  const enabledPersonRoles = [
    mappedFieldSet.has('directors') ? 'director' : null,
    mappedFieldSet.has('actors') ? 'actor' : null,
  ].filter((role): role is PersonCandidate['role'] => role !== null);
  const hasPeopleDestinations = enabledPersonRoles.length > 0;
  const ambiguousPeopleCount = people.filter(({ decision }) => decision.type === 'ambiguous').length;
  const hasAmbiguousPeople = ambiguousPeopleCount > 0;
  const poster = movie.images.find(isEnglishPoster);
  const selectedFieldCount = scalarComparisons.filter((comparison) => comparison.selected && comparison.available && comparison.changed).length;
  const overwriteCount = scalarComparisons.filter((comparison) => comparison.selected && comparison.available && comparison.changed && !isEmptyValue(comparison.currentValue)).length;
  const emptyFillCount = scalarComparisons.filter((comparison) => comparison.selected && comparison.available && comparison.changed && isEmptyValue(comparison.currentValue)).length;
  const selectedImageCount = countSelectedImages(imageSelection);
  const imageDestinationCounts = countSelectedImageDestinations(imageSelection);
  const peopleToCreateCount = people.filter(({ decision }) => decision.type === 'create').length;
  const peopleToReuseCount = people.filter(({ decision }) => decision.type === 'reuse').length;
  const selectedTrailerCount = trailerComparison?.selected && trailerComparison.available && trailerComparison.changed ? 1 : 0;
  const selectedMovieSummary = `${movie.title}${movie.yearReleased ? ` (${formatYear(movie.yearReleased)})` : ''}`;
  const impactSummary = formatImpactSegments({
    fieldChanges: selectedFieldCount,
    trailers: selectedTrailerCount,
    imagesToUpload: selectedImageCount,
    peopleToCreate: peopleToCreateCount,
    peopleToReuse: peopleToReuseCount,
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mobileQuery = window.matchMedia('(max-width: 540px)');
    const syncSummaryVisibility = () => {
      setSelectedMovieOpen(!mobileQuery.matches);
    };

    syncSummaryVisibility();
    mobileQuery.addEventListener('change', syncSummaryVisibility);

    return () => {
      mobileQuery.removeEventListener('change', syncSummaryVisibility);
    };
  }, []);

  return (
    <section className="movie-import-modal__step-frame">
      <div className="movie-import-modal__chrome-header">
        <ModalStepIndicator activeStep="review" />
      </div>
      <div className="movie-import-modal__scroll-body">
        <header className="movie-import-modal__header">
          <p className="movie-import-modal__eyebrow">Movie Importer</p>
          <h2 className="movie-import-modal__title">Review changes</h2>
          <p className="movie-import-modal__intro">Choose which TMDB values to prepare. Nothing is saved or published until you save the DatoCMS movie.</p>
        </header>
        <details className="movie-import-modal__summary-disclosure" open={selectedMovieOpen} onToggle={(event) => setSelectedMovieOpen(event.currentTarget.open)}>
          <summary className="movie-import-modal__summary-toggle">
            <span>Selected movie</span>
            <strong>{selectedMovieSummary}</strong>
          </summary>
          <article aria-label="Selected movie" className="movie-import-modal__summary">
            {poster ? <img className="movie-import-modal__poster" src={poster.previewUrl ?? poster.originalUrl} alt={`${movie.title} poster`} /> : null}
            <div className="movie-import-modal__summary-content">
              <div className="movie-import-modal__summary-heading">
                <p className="movie-import-modal__section-kicker">Selected movie</p>
                <h3 className="movie-import-modal__summary-title">{movie.title}</h3>
              </div>
              <dl className="movie-import-modal__summary-list">
                <div><dt>Year</dt><dd>{formatYear(movie.yearReleased)}</dd></div>
                <div><dt>Rating</dt><dd>{movie.mpaaRating ?? 'Not available'}</dd></div>
                <div><dt>Runtime</dt><dd>{formatRuntime(movie.runtime)}</dd></div>
                <div><dt>TMDB ID</dt><dd>{movie.tmdbId}</dd></div>
              </dl>
            </div>
          </article>
        </details>
        <div className="movie-import-modal__review-stack">
          <div id="field-changes">
            <Section title="Field changes">
              <p className="movie-import-modal__section-help">Choose the proposed TMDB field values to apply to the movie form.</p>
              <FieldDiffTable comparisons={scalarComparisons} onToggle={onToggle} onSelectAll={onSelectAll} onClearAll={onClearAll} overwriteCount={overwriteCount} emptyFillCount={emptyFillCount} />
            </Section>
          </div>
          {hasTrailerDestination && trailerComparison ? (
            <div id="trailer">
              <Section title="Trailer">
                <p className="movie-import-modal__section-help">Keep the current Trailer field value or replace it with one official English YouTube trailer from TMDB.</p>
                <TrailerReview trailers={movie.trailers} selectedTrailer={selectedTrailer} comparison={trailerComparison} onSelect={onSelectTrailer} />
              </Section>
            </div>
          ) : null}
          {hasImageDestinations ? (
            <div id="images">
              <Section title="Images">
                <p className="movie-import-modal__section-help">Choose exactly which TMDB artwork destinations to import.</p>
                <p
                  aria-atomic="true"
                  aria-label="Image import impact"
                  aria-live="polite"
                  className="movie-import-modal__section-impact"
                  role="status"
                >
                  {formatImageImpact(imageDestinationCounts)}
                </p>
                <ImagePicker images={images} selection={imageSelection} allowPoster={hasPosterDestination} allowHeroImage={hasHeroDestination} allowOtherImages={hasOtherImagesDestination} onTogglePoster={onTogglePoster} onSelectHeroImage={onSelectHeroImage} onToggleBackdrop={onToggleBackdrop} />
              </Section>
            </div>
          ) : null}
          {hasPeopleDestinations ? (
            <div id="people">
              <Section title="People">
                <p className="movie-import-modal__section-help">Choose whether each director and actor should reuse an existing Person record or create a new draft.</p>
                <p className="movie-import-modal__section-impact">{formatPeopleImpact(peopleToCreateCount, peopleToReuseCount)}</p>
                <PersonResolutionList people={people} enabledRoles={enabledPersonRoles} onResolve={onResolvePerson} />
              </Section>
            </div>
          ) : null}
        </div>
      </div>
      <div className="movie-import-modal__actions movie-import-modal__actions--sticky">
        <p className="movie-import-modal__action-summary" aria-label={impactSummary.join(', ')}>
          {impactSummary.map((item) => <span key={item}>{item}</span>)}
        </p>
        {hasAmbiguousPeople ? <p role="alert" className="movie-import-modal__action-note">Resolve {ambiguousPeopleCount} {ambiguousPeopleCount === 1 ? 'person' : 'people'} before continuing.</p> : null}
        <div className="movie-import-modal__action-buttons">
          <Button type="button" onClick={onBack}>
            Back
          </Button>
          <Button buttonType="primary" type="button" onClick={onContinue} disabled={hasAmbiguousPeople}>
            Continue
          </Button>
        </div>
      </div>
    </section>
  );
}

function countSelectedImages(selection: ImageSelection) {
  const keys = new Set<string>();

  for (const image of [selection.poster, selection.heroImage, ...selection.backdrops]) {
    if (image) {
      keys.add(`${image.providerKey}:${image.providerImageId}`);
    }
  }

  return keys.size;
}

function countSelectedImageDestinations(selection: ImageSelection) {
  return {
    poster: selection.poster ? 1 : 0,
    heroImage: selection.heroImage ? 1 : 0,
    otherImages: selection.backdrops.length,
  };
}

function formatImageImpact(counts: ReturnType<typeof countSelectedImageDestinations>) {
  if (counts.poster === 0 && counts.heroImage === 0 && counts.otherImages === 0) {
    return 'No image destinations selected.';
  }

  const parts = [
    counts.poster > 0 ? '1 poster' : null,
    counts.heroImage > 0 ? '1 Hero Image' : null,
    counts.otherImages > 0 ? `${counts.otherImages} Other ${pluralize(counts.otherImages, 'Image')}` : null,
  ].filter(Boolean);

  return `${formatList(parts)} selected for upload after confirmation.`;
}

function formatPeopleImpact(createCount: number, reuseCount: number) {
  if (createCount === 0 && reuseCount === 0) {
    return 'No Person records will be created or reused.';
  }

  const parts = [
    createCount > 0 ? `${createCount} draft ${pluralize(createCount, 'Person record')}` : null,
    reuseCount > 0 ? `${reuseCount} existing ${pluralize(reuseCount, 'Person record')}` : null,
  ].filter(Boolean);

  return `${formatList(parts)} will be prepared after confirmation.`;
}

function formatList(parts: Array<string | null>) {
  const values = parts.filter((part): part is string => Boolean(part));

  if (values.length <= 1) {
    return values[0] ?? '';
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
}
function isEmptyValue(value: unknown) {
  return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}
