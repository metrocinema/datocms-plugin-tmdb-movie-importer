import { matchPerson, normalizePersonName } from './personMatching';

describe('person matching', () => {
  it('normalizes case, whitespace, and unicode shape', () => {
    expect(normalizePersonName('  JOSE\u0301   Alvarez ')).toBe(normalizePersonName('josé alvarez'));
  });

  it('matches by TMDB id when configured', () => {
    const decision = matchPerson(
      { tmdbId: 44, name: 'Actor Name', order: 0, role: 'actor' },
      [{ id: 'person-1', name: 'Different Name', tmdbId: 44 }],
      true,
    );

    expect(decision).toEqual({ type: 'reuse', recordId: 'person-1', source: 'tmdb-id', warning: null });
  });

  it('requires editor choice for ambiguous name matches', () => {
    const decision = matchPerson(
      { tmdbId: 44, name: 'Actor Name', order: 0, role: 'actor' },
      [
        { id: 'person-1', name: 'Actor Name', tmdbId: null },
        { id: 'person-2', name: ' actor   name ', tmdbId: null },
      ],
      false,
    );

    expect(decision.type).toBe('ambiguous');
  });

  it('proposes draft creation when no match exists', () => {
    const decision = matchPerson({ tmdbId: 44, name: 'Actor Name', order: 0, role: 'actor' }, [], false);

    expect(decision).toEqual({ type: 'create', name: 'Actor Name', source: 'auto', warning: null });
  });
});
