import type { PersonCandidate } from './movie';

export type ExistingPersonRecord = {
  id: string;
  name: string;
  tmdbId: number | null;
};

export type PersonMatchDecision =
  | { type: 'reuse'; recordId: string; warning: string | null }
  | { type: 'create'; name: string; warning: string | null }
  | { type: 'ambiguous'; options: ExistingPersonRecord[]; warning: string };

export function normalizePersonName(name: string): string {
  return name.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

export function matchPerson(candidate: PersonCandidate, records: ExistingPersonRecord[], tmdbIdFieldConfigured: boolean): PersonMatchDecision {
  if (tmdbIdFieldConfigured) {
    const tmdbMatch = records.find((record) => record.tmdbId === candidate.tmdbId);
    if (tmdbMatch) {
      return { type: 'reuse', recordId: tmdbMatch.id, warning: null };
    }
  }

  const normalized = normalizePersonName(candidate.name);
  const nameMatches = records.filter((record) => normalizePersonName(record.name) === normalized);

  if (nameMatches.length === 1) {
    return {
      type: 'reuse',
      recordId: nameMatches[0].id,
      warning: 'Matched by exact normalized name because no TMDB person ID match was available.',
    };
  }

  if (nameMatches.length > 1) {
    return {
      type: 'ambiguous',
      options: nameMatches,
      warning: 'Multiple people share this normalized name. Choose one record or create a new draft.',
    };
  }

  return { type: 'create', name: candidate.name, warning: null };
}
