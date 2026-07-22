import type { FieldComparison } from '../domain/fieldComparison';
import type { PersonCandidate } from '../domain/movie';
import type { PersonMatchDecision } from '../domain/personMatching';
import type { NormalizedImageCandidate } from '../domain/movie';
import { FieldDiffTable } from './FieldDiffTable';
import { ImagePicker } from './ImagePicker';
import { PersonResolutionList } from './PersonResolutionList';

type ReviewStepProps = {
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

export function ReviewStep({ comparisons, onToggle, onSelectAll, onContinue, people, onResolvePerson, images, selectedImageIds, onToggleImage }: ReviewStepProps) {
  const hasAmbiguousPeople = people.some(({ decision }) => decision.type === 'ambiguous');

  return (
    <section>
      <h2>Review changes</h2>
      <FieldDiffTable comparisons={comparisons} onToggle={onToggle} onSelectAll={onSelectAll} />
      <ImagePicker images={images} selectedIds={selectedImageIds} onToggle={onToggleImage} />
      <PersonResolutionList people={people} onResolve={onResolvePerson} />
      <button type="button" onClick={onContinue} disabled={hasAmbiguousPeople}>
        Continue
      </button>
    </section>
  );
}
