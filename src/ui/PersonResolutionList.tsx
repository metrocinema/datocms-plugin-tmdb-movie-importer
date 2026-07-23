import type { PersonMatchDecision } from '../domain/personMatching';
import type { PersonCandidate } from '../domain/movie';

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
            <label className="movie-import-modal__select-label">
              Resolve {candidate.name}
              <select defaultValue="" onChange={(event) => onResolve(candidate, event.target.value as 'create' | `reuse:${string}`)}>
                <option value="" disabled>Choose a resolution</option>
                <option value="create">Create new draft</option>
                {decision.options.map((option) => <option key={option.id} value={`reuse:${option.id}`}>Reuse {option.name}</option>)}
              </select>
            </label>
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
