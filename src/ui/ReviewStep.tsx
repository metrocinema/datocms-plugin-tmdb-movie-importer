import type { FieldComparison } from '../domain/fieldComparison';
import { FieldDiffTable } from './FieldDiffTable';

type ReviewStepProps = {
  comparisons: FieldComparison[];
  onToggle: (key: FieldComparison['key']) => void;
  onSelectAll: () => void;
  onContinue: () => void;
};

export function ReviewStep({ comparisons, onToggle, onSelectAll, onContinue }: ReviewStepProps) {
  return (
    <section>
      <h2>Review changes</h2>
      <FieldDiffTable comparisons={comparisons} onToggle={onToggle} onSelectAll={onSelectAll} />
      <button type="button" onClick={onContinue}>
        Continue
      </button>
    </section>
  );
}
