import { SelectField } from 'datocms-react-ui';
import type { PersonMatchDecision } from '../domain/personMatching';
import type { PersonCandidate } from '../domain/movie';

type ResolutionOption = {
  label: string;
  value: 'create' | `reuse:${string}`;
};

type PersonResolutionListProps = {
  people: Array<{ candidate: PersonCandidate; decision: PersonMatchDecision }>;
  onResolve: (candidate: PersonCandidate, value: 'create' | `reuse:${string}`) => void;
};

export function PersonResolutionList({ people, onResolve }: PersonResolutionListProps) {
  const renderPeople = (role: PersonCandidate['role']) => {
    const matches = people.filter(({ candidate }) => candidate.role === role);

    if (matches.length === 0) {
      return <p className="movie-import-modal__empty">No {role === 'director' ? 'directors' : 'actors'} were returned for this movie.</p>;
    }

    return matches.map(({ candidate, decision }) => (
      <div key={`${candidate.role}:${candidate.tmdbId}`} className="movie-import-modal__person-row">
        <div className="movie-import-modal__row-header">
          <strong>{candidate.name}</strong>
          {decision.type === 'reuse' ? <span className="movie-import-modal__badge">Reuse existing</span> : null}
          {decision.type === 'create' ? <span className="movie-import-modal__badge">Create draft</span> : null}
        </div>
        {decision.warning ? <p className="movie-import-modal__row-note">{decision.warning}</p> : null}
        {decision.type === 'ambiguous' ? (
          <>
            <p><span className="movie-import-modal__warning">Resolve this person before continuing.</span></p>
            <div className="movie-import-modal__select-label">
              <SelectField
                id={`resolve-${candidate.role}-${candidate.tmdbId}`}
                name={`resolve-${candidate.role}-${candidate.tmdbId}`}
                label={`Resolve ${candidate.name}`}
                value={null}
                onChange={(option) => {
                  if (option && !Array.isArray(option) && 'value' in option) {
                    onResolve(candidate, option.value as ResolutionOption['value']);
                  }
                }}
                selectInputProps={{
                  options: [
                    { label: 'Create new draft', value: 'create' },
                    ...decision.options.map((option) => ({ label: `Reuse ${option.name}`, value: `reuse:${option.id}` })),
                  ],
                }}
              />
            </div>
          </>
        ) : null}
      </div>
    ));
  };

  return (
    <div className="movie-import-modal__review-list">
      <div className="movie-import-modal__people-group">
        <h4>Directors</h4>
        {renderPeople('director')}
      </div>
      <div className="movie-import-modal__people-group">
        <h4>Actors</h4>
        {renderPeople('actor')}
      </div>
    </div>
  );
}
