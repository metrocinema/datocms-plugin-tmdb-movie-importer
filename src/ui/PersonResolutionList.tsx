import type { PersonMatchDecision } from '../domain/personMatching';
import type { PersonCandidate } from '../domain/movie';

type PersonResolutionListProps = {
  people: Array<{ candidate: PersonCandidate; decision: PersonMatchDecision }>;
  onResolve: (candidate: PersonCandidate, value: 'create' | `reuse:${string}`) => void;
};

export function PersonResolutionList({ people, onResolve }: PersonResolutionListProps) {
  const renderPeople = (role: PersonCandidate['role']) => people
    .filter(({ candidate }) => candidate.role === role)
    .map(({ candidate, decision }) => (
      <div key={`${candidate.role}:${candidate.tmdbId}`}>
        <strong>{candidate.name}</strong>
        {decision.type === 'reuse' ? <p>Will reuse existing person</p> : null}
        {decision.type === 'create' ? <p>Will create new draft person</p> : null}
        {decision.warning ? <p>{decision.warning}</p> : null}
        {decision.type === 'ambiguous' ? (
          <>
            <p>Resolve this person before continuing.</p>
            <label>
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

  return (
    <div>
      <h4>Directors</h4>
      {renderPeople('director')}
      <h4>Actors</h4>
      {renderPeople('actor')}
    </div>
  );
}
