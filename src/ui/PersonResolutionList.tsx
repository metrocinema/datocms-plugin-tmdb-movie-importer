import type { PersonMatchDecision } from '../domain/personMatching';
import type { PersonCandidate } from '../domain/movie';

type PersonResolutionListProps = {
  people: Array<{ candidate: PersonCandidate; decision: PersonMatchDecision }>;
  onResolve: (candidate: PersonCandidate, value: 'create' | `reuse:${string}`) => void;
};

export function PersonResolutionList({ people, onResolve }: PersonResolutionListProps) {
  return (
    <div>
      {people.map(({ candidate, decision }) => (
        <div key={`${candidate.role}:${candidate.tmdbId}`}>
          <strong>{candidate.name}</strong>
          <span>{decision.type}</span>
          {decision.warning ? <p>{decision.warning}</p> : null}
          {decision.type === 'ambiguous' ? (
            <label>
              Resolve {candidate.name}
              <select defaultValue="" onChange={(event) => onResolve(candidate, event.target.value as 'create' | `reuse:${string}`)}>
                <option value="" disabled>Choose a resolution</option>
                <option value="create">Create new draft</option>
                {decision.options.map((option) => <option key={option.id} value={`reuse:${option.id}`}>Reuse {option.name}</option>)}
              </select>
            </label>
          ) : null}
        </div>
      ))}
    </div>
  );
}
