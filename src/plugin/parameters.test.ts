import { activeTargetLocale, parsePluginParameters, validatePluginParameters } from './parameters';

describe('plugin parameters', () => {
  it('fills safe defaults for a new install', () => {
    const params = parsePluginParameters({});

    expect(params.targetLocale).toBe('en');
    expect(params.actorLimit).toBe(10);
    expect(params.tmdbReadToken).toBe('');
  });

  it('rejects missing required mappings', () => {
    const issues = validatePluginParameters(parsePluginParameters({}));

    expect(issues.map((issue) => issue.code)).toContain('missing_tmdb_token');
    expect(issues.map((issue) => issue.code)).toContain('missing_movie_model');
    expect(issues.map((issue) => issue.code)).toContain('missing_person_model');
  });

  it('normalizes actor limit to a positive integer', () => {
    const params = parsePluginParameters({ actorLimit: '7' });

    expect(params.actorLimit).toBe(7);
  });

  it('uses the active Dato editor locale for live form updates', () => {
    const params = parsePluginParameters({});

    expect(activeTargetLocale(params, 'en-US')).toBe('en-US');
  });
});
