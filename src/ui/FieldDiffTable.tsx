import { Button } from 'datocms-react-ui';
import type { FieldComparison } from '../domain/fieldComparison';
import { formatReviewValue, movieFieldLabels } from './modalPresentation';
import { touchTargetStyle } from './touchTargets';

type FieldDiffTableProps = {
  comparisons: FieldComparison[];
  onToggle: (key: FieldComparison['key']) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  overwriteCount: number;
  emptyFillCount: number;
};

export function FieldDiffTable({ comparisons, onToggle, onSelectAll, onClearAll, overwriteCount, emptyFillCount }: FieldDiffTableProps) {
  const fieldCountLabel = comparisons.length === 1 ? '1 field available' : `${comparisons.length} fields available`;
  const selectedCount = comparisons.filter((comparison) => comparison.selected && comparison.available && comparison.changed).length;
  const selectedCountLabel = selectedCount === 1 ? '1 selected change' : `${selectedCount} selected changes`;

  if (comparisons.length === 0) {
    return <p className="movie-import-modal__empty">No mapped movie fields are available for this import.</p>;
  }

  return (
    <div className="movie-import-modal__review-list">
      <div className="movie-import-modal__list-toolbar">
        <div className="movie-import-modal__toolbar-summary">
          <span>{fieldCountLabel} · {selectedCountLabel}</span>
          <span>{overwriteCount} {pluralize(overwriteCount, 'overwrite')} · {emptyFillCount} empty-field {pluralize(emptyFillCount, 'fill')}</span>
        </div>
        <div className="movie-import-modal__toolbar-actions">
          <Button buttonSize="s" type="button" onClick={onSelectAll}>
            Select all changes
          </Button>
          <Button buttonSize="s" buttonType="muted" type="button" onClick={onClearAll} disabled={selectedCount === 0}>
            Clear all
          </Button>
        </div>
      </div>
      {comparisons.map((comparison) => {
        const detailed = isDetailedField(comparison);
        const isOverwrite = comparison.available && comparison.changed && !isEmptyValue(comparison.currentValue);
        const isEmptyFill = comparison.available && comparison.changed && isEmptyValue(comparison.currentValue);

        return (
          <article key={comparison.key} className={detailed ? 'movie-import-modal__field-row movie-import-modal__field-row--detailed' : 'movie-import-modal__field-row'}>
            <div className="movie-import-modal__field-name">
              <h4 className="movie-import-modal__field-title">{movieFieldLabels[comparison.key]}</h4>
              {isOverwrite ? <span className="movie-import-modal__badge movie-import-modal__badge--warning">Overwrites value</span> : null}
              {isEmptyFill ? <span className="movie-import-modal__badge movie-import-modal__badge--success">Fills empty field</span> : null}
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

function isEmptyValue(value: unknown) {
  return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}
