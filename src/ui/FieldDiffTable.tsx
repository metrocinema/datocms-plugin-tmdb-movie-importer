import type { FieldComparison } from '../domain/fieldComparison';
import { formatEmptyValue, movieFieldLabels } from './modalPresentation';

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
        <article key={comparison.key}>
          <h4>{movieFieldLabels[comparison.key]}</h4>
          <label>
            <input type="checkbox" checked={comparison.selected} disabled={!comparison.available || !comparison.changed} onChange={() => onToggle(comparison.key)} />
            Select {movieFieldLabels[comparison.key]}
          </label>
          <p>Destination: {movieFieldLabels[comparison.key]}</p>
          <p>Current: {formatEmptyValue(comparison.currentValue)}</p>
          <p>Proposed: {comparison.available ? formatEmptyValue(comparison.proposedValue) : 'No TMDB value available'}</p>
        </article>
      ))}
    </div>
  );
}
