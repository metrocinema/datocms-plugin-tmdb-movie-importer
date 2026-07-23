import { Button, Section } from 'datocms-react-ui';
import type { FieldComparison } from '../domain/fieldComparison';
import type { NormalizedImageCandidate, NormalizedMovie, PersonCandidate } from '../domain/movie';
import type { PersonMatchDecision } from '../domain/personMatching';
import type { ImageSelection } from '../providers/imageProvider';
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
  onBack: () => void;
  people: Array<{ candidate: PersonCandidate; decision: PersonMatchDecision }>;
  onResolvePerson: (candidate: PersonCandidate, value: 'create' | `reuse:${string}`) => void;
  images: NormalizedImageCandidate[];
  imageSelection: ImageSelection;
  onTogglePoster: (providerImageId: string) => void;
  onSelectHeroImage: (providerImageId: string) => void;
  onToggleBackdrop: (providerImageId: string) => void;
};

export function ReviewStep({ movie, comparisons, onToggle, onSelectAll, onContinue, onBack, people, onResolvePerson, images, imageSelection, onTogglePoster, onSelectHeroImage, onToggleBackdrop }: ReviewStepProps) {
  const ambiguousPeopleCount = people.filter(({ decision }) => decision.type === 'ambiguous').length;
  const hasAmbiguousPeople = ambiguousPeopleCount > 0;
  const poster = movie.images.find(isEnglishPoster);
  const selectedFieldCount = comparisons.filter((comparison) => comparison.selected && comparison.available && comparison.changed).length;
  const selectedImageCount = countSelectedImages(imageSelection);
  const peopleToCreateCount = people.filter(({ decision }) => decision.type === 'create').length;
  const peopleToReuseCount = people.filter(({ decision }) => decision.type === 'reuse').length;
  const impactSummary = [
    `${selectedFieldCount} ${pluralize(selectedFieldCount, 'field')} selected`,
    `${selectedImageCount} ${pluralize(selectedImageCount, 'image')} to upload`,
    `${peopleToCreateCount} draft ${pluralize(peopleToCreateCount, 'person', 'people')}`,
    `${peopleToReuseCount} reused ${pluralize(peopleToReuseCount, 'person', 'people')}`,
  ];

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
        <div id="field-changes">
          <Section title="Field changes">
            <p className="movie-import-modal__section-help">Select the content fields you want to update from TMDB.</p>
            <FieldDiffTable comparisons={comparisons} onToggle={onToggle} onSelectAll={onSelectAll} />
          </Section>
        </div>
        <div id="images">
          <Section title="Images">
            <p className="movie-import-modal__section-help">Pick the poster and backdrop images to upload. Hero image and Other images are separate DatoCMS destinations.</p>
            <ImagePicker images={images} selection={imageSelection} onTogglePoster={onTogglePoster} onSelectHeroImage={onSelectHeroImage} onToggleBackdrop={onToggleBackdrop} />
          </Section>
        </div>
        <div id="people">
          <Section title="People">
            <p className="movie-import-modal__section-help">Confirm whether directors and actors should reuse existing people or create new draft records. This review currently creates {peopleToCreateCount} draft {pluralize(peopleToCreateCount, 'person', 'people')} and reuses {peopleToReuseCount} existing {pluralize(peopleToReuseCount, 'person', 'people')}.</p>
            <PersonResolutionList people={people} onResolve={onResolvePerson} />
          </Section>
        </div>
      </div>
      <div className="movie-import-modal__actions movie-import-modal__actions--sticky">
        <p className="movie-import-modal__action-summary">{impactSummary.join(' · ')}</p>
        <Button type="button" onClick={onBack}>
          Back
        </Button>
        {hasAmbiguousPeople ? <p role="alert" className="movie-import-modal__action-note">Resolve {ambiguousPeopleCount} {ambiguousPeopleCount === 1 ? 'person' : 'people'} before continuing.</p> : null}
        <Button buttonType="primary" type="button" onClick={onContinue} disabled={hasAmbiguousPeople}>
          Continue
        </Button>
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

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}
