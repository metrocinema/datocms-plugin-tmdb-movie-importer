import { Button } from 'datocms-react-ui';
import type { FieldComparison } from '../domain/fieldComparison';
import { isEmptyStructuredText } from '../domain/structuredText';
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
  const selectedCountLabel = selectedCount === 1 ? '1 selected' : `${selectedCount} selected`;

  if (comparisons.length === 0) {
    return <p className="movie-import-modal__empty">No mapped movie fields are available for this import.</p>;
  }

  return (
    <div className="movie-import-modal__review-list">
      <div className="movie-import-modal__list-toolbar">
        <div className="movie-import-modal__toolbar-summary">
          <span>{fieldCountLabel} · {selectedCountLabel}</span>
          <span>{formatFieldImpactSummary(overwriteCount, emptyFillCount)}</span>
        </div>
        <div className="movie-import-modal__toolbar-actions">
          <Button buttonSize="s" type="button" onClick={onSelectAll}>
            Select all
          </Button>
          <Button buttonSize="s" buttonType="muted" type="button" onClick={onClearAll} disabled={selectedCount === 0}>
            Clear all
          </Button>
        </div>
      </div>
      <table className="movie-import-modal__field-table" aria-label="Field changes">
        <thead>
          <tr>
            <th scope="col">Field</th>
            <th scope="col">Current</th>
            <th scope="col">Proposed</th>
          </tr>
        </thead>
        <tbody>
          {comparisons.map((comparison) => {
            const fieldLabel = movieFieldLabels[comparison.key];
            const canSelect = comparison.available && comparison.changed;

            return (
              <tr
                key={comparison.key}
                className={comparison.selected && canSelect
                  ? 'movie-import-modal__field-table-row movie-import-modal__field-table-row--selected'
                  : 'movie-import-modal__field-table-row'}
              >
                <th scope="row" className="movie-import-modal__field-table-field">
                  <span className="movie-import-modal__field-title">{fieldLabel}</span>
                </th>
                <td className="movie-import-modal__field-table-value" data-label="Current">
                  <ReviewValue comparison={comparison} value={comparison.currentValue} />
                </td>
                <td className="movie-import-modal__field-table-value movie-import-modal__field-table-proposed" data-label="Proposed">
                  <ProposedFieldCell comparison={comparison} fieldLabel={fieldLabel} canSelect={canSelect} onToggle={onToggle} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ReviewValue({ comparison, value }: { comparison: FieldComparison; value: unknown }) {
  const formattedValue = formatReviewValue(comparison.key, value);

  if (isEmptyValue(comparison.key, value)) {
    return <span className="movie-import-modal__field-placeholder">{formattedValue}</span>;
  }

  return <>{formattedValue}</>;
}

function ProposedFieldCell({
  comparison,
  fieldLabel,
  canSelect,
  onToggle,
}: {
  comparison: FieldComparison;
  fieldLabel: string;
  canSelect: boolean;
  onToggle: (key: FieldComparison['key']) => void;
}) {
  const value = comparison.available ? formatReviewValue(comparison.key, comparison.proposedValue) : 'TMDB did not provide a value';

  return (
    <label
      className={canSelect
        ? 'movie-import-modal__field-table-choice'
        : 'movie-import-modal__field-table-choice movie-import-modal__field-table-choice--disabled'}
      style={touchTargetStyle}
    >
      <input
        aria-label={`Use proposed ${fieldLabel}`}
        type="checkbox"
        checked={canSelect ? comparison.selected : false}
        disabled={!canSelect}
        onChange={() => onToggle(comparison.key)}
      />
      <span className="movie-import-modal__field-table-choice-copy">{value}</span>
    </label>
  );
}

function isEmptyValue(key: FieldComparison['key'], value: unknown) {
  if (key === 'description' && isEmptyStructuredText(value)) {
    return true;
  }

  return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function formatFieldImpactSummary(overwriteCount: number, emptyFillCount: number) {
  const overwriteLabel = overwriteCount === 0 ? 'No current values will be overwritten' : `${overwriteCount} current ${pluralize(overwriteCount, 'value')} will be overwritten`;
  const fillLabel = emptyFillCount === 0
    ? 'no empty fields will be filled'
    : `${emptyFillCount} empty ${pluralize(emptyFillCount, 'field')} will be filled`;

  return `${overwriteLabel} · ${fillLabel}`;
}
