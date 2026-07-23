import { Button } from 'datocms-react-ui';
import type { FieldComparison } from '../domain/fieldComparison';
import { formatEmptyValue, movieFieldLabels } from './modalPresentation';

type FieldDiffTableProps = {
  comparisons: FieldComparison[];
  onToggle: (key: FieldComparison['key']) => void;
  onSelectAll: () => void;
};

export function FieldDiffTable({ comparisons, onToggle, onSelectAll }: FieldDiffTableProps) {
  const fieldCountLabel = comparisons.length === 1 ? '1 field available' : `${comparisons.length} fields available`;

  if (comparisons.length === 0) {
    return <p className="movie-import-modal__empty">No mapped movie fields are available for this import.</p>;
  }

  return (
    <div className="movie-import-modal__review-list">
      <div className="movie-import-modal__list-toolbar">
        <span>{fieldCountLabel}</span>
        <Button buttonSize="s" type="button" onClick={onSelectAll}>
          Select all changes
        </Button>
      </div>
      {comparisons.map((comparison) => (
        <article key={comparison.key} className="movie-import-modal__field-row">
          <div className="movie-import-modal__row-header">
            <div>
              <h4 className="movie-import-modal__field-title">{movieFieldLabels[comparison.key]}</h4>
              {!comparison.available ? <span className="movie-import-modal__badge movie-import-modal__badge--neutral">No TMDB value</span> : null}
              {comparison.available && !comparison.changed ? <span className="movie-import-modal__badge movie-import-modal__badge--neutral">Already matches</span> : null}
            </div>
            <label className="movie-import-modal__check">
              <input type="checkbox" checked={comparison.selected} disabled={!comparison.available || !comparison.changed} onChange={() => onToggle(comparison.key)} />
              Select
            </label>
          </div>
          <dl className="movie-import-modal__diff">
            <div><dt>Current</dt><dd>{formatEmptyValue(comparison.currentValue)}</dd></div>
            <div><dt>Proposed</dt><dd>{comparison.available ? formatEmptyValue(comparison.proposedValue) : 'No TMDB value available'}</dd></div>
          </dl>
        </article>
      ))}
    </div>
  );
}
