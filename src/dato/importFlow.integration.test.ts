import { compareMovieFields } from '../domain/fieldComparison';
import { buildImportPlan } from '../domain/importPlanning';
import { applyPreparedImport, executeImportPlan, prepareImport } from './importExecutor';
import type { NormalizedMovie } from '../domain/movie';
import type { PluginParameters } from '../plugin/parameters';

const params: PluginParameters = {
  tmdbReadToken: 'token',
  movieModelApiKey: 'movie',
  targetLocale: 'en',
  movieFields: { title: 'title', runtime: 'runtime', directors: 'directors' },
  personModelApiKey: 'person',
  personNameFieldApiKey: 'name',
  personTmdbIdFieldApiKey: 'tmdb_id',
  actorLimit: 10,
};

const movie: NormalizedMovie = {
  tmdbId: 123,
  title: 'Example Movie',
  primaryReleaseDate: '2024-03-01',
  yearReleased: 2024,
  mpaaRating: null,
  runtime: 125,
  tagline: null,
  description: null,
  directors: [{ tmdbId: 10, name: 'Director Name', order: 0, role: 'director' }],
  actors: [],
  images: [],
};

describe('import flow integration', () => {
  it('applies only selected fields after dependencies resolve', async () => {
    const comparisons = compareMovieFields({ title: '', runtime: 120, mpaaRating: 'R' }, movie, ['title', 'runtime', 'mpaaRating']);
    const plan = buildImportPlan({
      fieldComparisons: comparisons,
      directors: movie.directors,
      actors: movie.actors,
      imageSelection: { poster: null, heroImage: null, backdrops: [] },
      personResolutions: [{ candidateTmdbId: 10, candidateRole: 'director', action: 'create', name: 'Director Name', source: 'auto' }],
      mappedFields: ['title', 'runtime', 'mpaaRating', 'directors'],
    });
    const applied: Array<{ fieldPath: string; value: unknown }> = [];

    const preparation = await prepareImport(plan, params, {
      async findPeople() {
        return [];
      },
      async createPersonDraft() {
        return { id: 'person-1' };
      },
      async uploadImage() {
        throw new Error('unexpected upload');
      },
      async applyFormValues(changes) {
        applied.push(...changes);
      },
    });

    expect(preparation.status).toBe('success');
    expect(applied).toEqual([]);

    if (preparation.status !== 'success') {
      throw new Error('Expected preparation to succeed');
    }

    const result = await applyPreparedImport(preparation.prepared, params, {
      async findPeople() {
        return [];
      },
      async createPersonDraft() {
        return { id: 'person-1' };
      },
      async uploadImage() {
        throw new Error('unexpected upload');
      },
      async applyFormValues(changes) {
        applied.push(...changes);
      },
    });

    expect(result.status).toBe('success');
    expect(applied).toEqual([
      { fieldPath: 'title', value: 'Example Movie' },
      { fieldPath: 'directors', value: ['person-1'] },
    ]);
    expect(applied.map((change) => change.fieldPath)).not.toContain('runtime');
    expect(applied.map((change) => change.fieldPath)).not.toContain('mpaaRating');
  });

  it('does not update movie form when person creation fails', async () => {
    const plan = buildImportPlan({
      fieldComparisons: compareMovieFields({ title: '' }, movie, ['title']),
      directors: movie.directors,
      actors: [],
      imageSelection: { poster: null, heroImage: null, backdrops: [] },
      personResolutions: [{ candidateTmdbId: 10, candidateRole: 'director', action: 'create', name: 'Director Name', source: 'auto' }],
      mappedFields: ['title', 'directors'],
    });
    const applyFormValues = vi.fn();

    const result = await executeImportPlan(plan, params, {
      async findPeople() {
        return [];
      },
      async createPersonDraft() {
        throw new Error('item create permission denied');
      },
      async uploadImage() {
        return { id: 'upload-1' };
      },
      applyFormValues,
    });

    expect(result.status).toBe('dependency_failed');
    expect(applyFormValues).not.toHaveBeenCalled();
  });
});
