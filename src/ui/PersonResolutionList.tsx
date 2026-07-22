import type { PersonMatchDecision } from '../domain/personMatching';
import type { PersonCandidate } from '../domain/movie';

type PersonResolutionListProps = {
  people: Array<{ candidate: PersonCandidate; decision: PersonMatchDecision }>;
};

export function PersonResolutionList({ people }: PersonResolutionListProps) {
  return (
    <div>
      {people.map(({ candidate, decision }) => (
        <div key={`${candidate.role}:${candidate.tmdbId}`}>
          <strong>{candidate.name}</strong>
          <span>{decision.type}</span>
          {decision.warning ? <p>{decision.warning}</p> : null}
        </div>
      ))}
    </div>
  );
}
