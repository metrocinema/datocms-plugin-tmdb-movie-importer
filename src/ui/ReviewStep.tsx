import { Button, Section } from 'datocms-react-ui';
import type { FieldComparison } from '../domain/fieldComparison';
import type { NormalizedImageCandidate, NormalizedMovie, PersonCandidate } from '../domain/movie';
import type { PersonMatchDecision } from '../domain/personMatching';
import { FieldDiffTable } from './FieldDiffTable';
import { ImagePicker } from './ImagePicker';
import { isEnglishPoster } from '../providers/imageProvider';
import { formatRuntime, formatYear } from './modalPresentation';
import { ModalStepIndicator } from './ModalStepIndicator';
import { PersonResolutionList } from './PersonResolutionList';

type ReviewStepProps = {
  movie: NormalizedMovie;
  comparisons: FieldComparison[];
  onToggle: (key: FieldComparison['key']) => void;
  onSelectAll: () => void;
  onContinue: () => void;
  people: Array<{ candidate: PersonCandidate; decision: PersonMatchDecision }>;
  onResolvePerson: (candidate: PersonCandidate, value: 'create' | `reuse:${string}`) => void;
  images: NormalizedImageCandidate[];
  selectedImageIds: string[];
  onToggleImage: (providerImageId: string) => void;
};

export function ReviewStep({ movie, comparisons, onToggle, onSelectAll, onContinue, people, onResolvePerson, images, selectedImageIds, onToggleImage }: ReviewStepProps) {
  const hasAmbiguousPeople = people.some(({ decision }) => decision.type === 'ambiguous');
  const poster = movie.images.find(isEnglishPoster);

  return (
    <section>
      <ModalStepIndicator activeStep="review" />
      <header className="movie-import-modal__header">
        <h2 className="movie-import-modal__title">Review changes</h2>
        <p className="movie-import-modal__intro">Choose exactly which TMDB values should be applied to this unsaved DatoCMS form.</p>
      </header>
      <article aria-label="Selected movie" className="movie-import-modal__summary">
        {poster ? <img className="movie-import-modal__poster" src={poster.originalUrl} alt={`${movie.title} poster`} /> : null}
        <div className="movie-import-modal__summary-content">
          <p className="movie-import-modal__section-kicker">Selected movie</p>
          <h3 className="movie-import-modal__summary-title">{movie.title}</h3>
          <dl className="movie-import-modal__summary-list">
            <div><dt>Year</dt><dd>{formatYear(movie.yearReleased)}</dd></div>
            <div><dt>Rating</dt><dd>{movie.mpaaRating ?? 'Not available'}</dd></div>
            <div><dt>Runtime</dt><dd>{formatRuntime(movie.runtime)}</dd></div>
            <div><dt>TMDB ID</dt><dd>{movie.tmdbId}</dd></div>
          </dl>
        </div>
      </article>
      <div className="movie-import-modal__review-stack">
        <Section title="Field changes">
          <p className="movie-import-modal__section-help">Select the content fields you want to update from TMDB.</p>
          <FieldDiffTable comparisons={comparisons} onToggle={onToggle} onSelectAll={onSelectAll} />
        </Section>
        <Section title="Images">
          <p className="movie-import-modal__section-help">Pick the poster and backdrops to upload. The first selected backdrop becomes the hero image.</p>
          <ImagePicker images={images} selectedIds={selectedImageIds} onToggle={onToggleImage} />
        </Section>
        <Section title="People">
          <p className="movie-import-modal__section-help">Confirm whether directors and actors should reuse existing people or create new draft records.</p>
          <PersonResolutionList people={people} onResolve={onResolvePerson} />
        </Section>
      </div>
      <div className="movie-import-modal__actions">
        <Button buttonType="primary" type="button" onClick={onContinue} disabled={hasAmbiguousPeople}>
          Continue
        </Button>
      </div>
    </section>
  );
}
