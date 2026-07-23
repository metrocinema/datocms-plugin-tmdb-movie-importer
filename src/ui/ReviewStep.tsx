import type { FieldComparison } from '../domain/fieldComparison';
import type { NormalizedImageCandidate, NormalizedMovie, PersonCandidate } from '../domain/movie';
import type { PersonMatchDecision } from '../domain/personMatching';
import { FieldDiffTable } from './FieldDiffTable';
import { ImagePicker } from './ImagePicker';
import { formatRuntime, formatYear } from './modalPresentation';
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
  const poster = movie.images.find((image) => image.type === 'poster');

  return (
    <section>
      <ol aria-label="Import steps">
        <li>Find movie</li>
        <li>Review changes</li>
        <li>Confirm import</li>
      </ol>
      <h2>Review changes</h2>
      <article aria-label="Selected movie">
        <h3>Selected movie</h3>
        {poster ? <img src={poster.originalUrl} alt={`${movie.title} poster`} width="120" /> : null}
        <p>{movie.title}</p>
        <p>{formatYear(movie.yearReleased)}</p>
        <p>{movie.mpaaRating ?? 'Not available'}</p>
        <p>{formatRuntime(movie.runtime)}</p>
        <p>TMDB ID {movie.tmdbId}</p>
      </article>
      <section aria-label="Field changes">
        <h3>Field changes</h3>
        <FieldDiffTable comparisons={comparisons} onToggle={onToggle} onSelectAll={onSelectAll} />
      </section>
      <section aria-label="Images">
        <h3>Images</h3>
        <ImagePicker images={images} selectedIds={selectedImageIds} onToggle={onToggleImage} />
      </section>
      <section aria-label="People">
        <h3>People</h3>
        <PersonResolutionList people={people} onResolve={onResolvePerson} />
      </section>
      <button type="button" onClick={onContinue} disabled={hasAmbiguousPeople}>
        Continue
      </button>
    </section>
  );
}
