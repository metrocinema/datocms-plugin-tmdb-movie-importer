import type { FieldComparison } from '../domain/fieldComparison';

type FieldDiffTableProps = {
  comparisons: FieldComparison[];
  onToggle: (key: FieldComparison['key']) => void;
  onSelectAll: () => void;
};

export function FieldDiffTable({ comparisons, onToggle, onSelectAll }: FieldDiffTableProps) {
  return (
    <div>
      <button type="button" onClick={onSelectAll}>
        Select all changes
      </button>
      {comparisons.map((comparison) => (
        <label key={comparison.key}>
          <input type="checkbox" checked={comparison.selected} disabled={!comparison.available || !comparison.changed} onChange={() => onToggle(comparison.key)} />
          {comparison.key}: {String(comparison.currentValue ?? '')} -&gt; {String(comparison.proposedValue ?? '')}
        </label>
      ))}
    </div>
  );
}
