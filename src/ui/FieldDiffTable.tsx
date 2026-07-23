import { Button } from 'datocms-react-ui';
import type { FieldComparison } from '../domain/fieldComparison';
import { formatReviewValue, movieFieldLabels } from './modalPresentation';
import { touchTargetStyle } from './touchTargets';

type FieldDiffTableProps = {
  comparisons: FieldComparison[];
  onToggle: (key: FieldComparison['key']) => void;
  onSelectAll: () => void;
};

export function FieldDiffTable({ comparisons, onToggle, onSelectAll }: FieldDiffTableProps) {
  const fieldCountLabel = comparisons.length === 1 ? '1 field available' : `${comparisons.length} fields available`;
  const selectedCount = comparisons.filter((comparison) => comparison.selected && comparison.available && comparison.changed).length;
  const selectedCountLabel = selectedCount === 1 ? '1 selected change' : `${selectedCount} selected changes`;

  if (comparisons.length === 0) {
    return <p className="movie-import-modal__empty">No mapped movie fields are available for this import.</p>;
  }

  return (
    <div className="movie-import-modal__review-list">
      <div className="movie-import-modal__list-toolbar">
        <span>{fieldCountLabel} · {selectedCountLabel}</span>
        <Button buttonSize="s" type="button" onClick={onSelectAll}>
          Select all changes
        </Button>
      </div>
      {comparisons.map((comparison) => {
        const detailed = isDetailedField(comparison);

        return (
          <article key={comparison.key} className={detailed ? 'movie-import-modal__field-row movie-import-modal__field-row--detailed' : 'movie-import-modal__field-row'}>
            <div className="movie-import-modal__field-name">
              <h4 className="movie-import-modal__field-title">{movieFieldLabels[comparison.key]}</h4>
              {!comparison.available ? <span className="movie-import-modal__badge movie-import-modal__badge--neutral">No TMDB value</span> : null}
              {comparison.available && !comparison.changed ? <span className="movie-import-modal__badge movie-import-modal__badge--neutral">Already matches</span> : null}
            </div>
            <dl className={detailed ? 'movie-import-modal__diff' : 'movie-import-modal__diff movie-import-modal__diff--compact'}>
              <div><dt>Current</dt><dd>{formatReviewValue(comparison.key, comparison.currentValue)}</dd></div>
              <div><dt>Proposed</dt><dd>{comparison.available ? formatReviewValue(comparison.key, comparison.proposedValue) : 'No TMDB value available'}</dd></div>
            </dl>
            <label className="movie-import-modal__check" style={touchTargetStyle}>
              <input aria-label={`Select ${movieFieldLabels[comparison.key]}`} type="checkbox" checked={comparison.selected} disabled={!comparison.available || !comparison.changed} onChange={() => onToggle(comparison.key)} />
              <span aria-hidden="true">Select</span>
            </label>
          </article>
        );
      })}
    </div>
  );
}

function isDetailedField(comparison: FieldComparison) {
  return comparison.key === 'tagline' || comparison.key === 'description';
}
