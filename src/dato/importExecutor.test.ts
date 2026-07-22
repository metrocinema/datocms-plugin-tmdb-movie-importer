import { executeImportPlan } from './importExecutor';
import type { ImportPlan } from '../domain/importPlanning';
import type { PluginParameters } from '../plugin/parameters';

const params: PluginParameters = {
  tmdbReadToken: 'token',
  movieModelApiKey: 'movie',
  targetLocale: 'en',
  movieFields: {
    title: 'title',
    poster: 'poster',
    backdrops: 'backdrops',
    directors: 'directors',
    actors: 'actors',
  },
  personModelApiKey: 'person',
  personNameFieldApiKey: 'name',
  personTmdbIdFieldApiKey: null,
  actorLimit: 10,
};

const plan: ImportPlan = {
  fieldChanges: [{ key: 'title', value: 'Example Movie' }],
  directors: [{ tmdbId: 10, name: 'Director Name', order: 0, role: 'director' }],
  actors: [{ tmdbId: 20, name: 'Actor Name', order: 0, role: 'actor' }],
  peopleToCreate: [{ candidateTmdbId: 10, name: 'Director Name' }, { candidateTmdbId: 20, name: 'Actor Name' }],
  peopleToReuse: [],
  assetsToUpload: [
    { providerKey: 'tmdb', providerImageId: '/poster.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'poster', originalUrl: 'https://image.tmdb.org/t/p/original/poster.jpg', width: 100, height: 150, language: 'en', rank: 1, attribution: 'TMDB' },
    { providerKey: 'tmdb', providerImageId: '/backdrop.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'backdrop', originalUrl: 'https://image.tmdb.org/t/p/original/backdrop.jpg', width: 200, height: 100, language: 'en', rank: 1, attribution: 'TMDB' },
  ],
};

describe('executeImportPlan', () => {
  it('creates people and uploads assets before applying form values', async () => {
    const order: string[] = [];
    const appliedChanges: Array<{ fieldPath: string; value: unknown }> = [];
    let peopleCreated = 0;
    let assetsUploaded = 0;
    const result = await executeImportPlan(plan, params, {
      async findPeople() {
        return [];
      },
      async createPersonDraft() {
        order.push('person');
        peopleCreated += 1;
        return { id: `person-${peopleCreated}` };
      },
      async uploadImage() {
        order.push('upload');
        assetsUploaded += 1;
        return { id: `upload-${assetsUploaded}` };
      },
      async applyFormValues(changes) {
        order.push('form');
        appliedChanges.push(...changes);
      },
    });

    expect(result.status).toBe('success');
    expect(order).toEqual(['person', 'person', 'upload', 'upload', 'form']);
    expect(appliedChanges).toEqual([
      { fieldPath: 'title', value: 'Example Movie' },
      { fieldPath: 'directors', value: [{ type: 'item', id: 'person-1' }] },
      { fieldPath: 'actors', value: [{ type: 'item', id: 'person-2' }] },
      { fieldPath: 'poster', value: { type: 'upload', id: 'upload-1' } },
      { fieldPath: 'backdrops', value: [{ type: 'upload', id: 'upload-2' }] },
    ]);
  });

  it('stops before form updates when a dependency write fails', async () => {
    const order: string[] = [];
    const result = await executeImportPlan(plan, params, {
      async findPeople() {
        return [];
      },
      async createPersonDraft() {
        order.push('person');
        throw new Error('permission denied');
      },
      async uploadImage() {
        order.push('upload');
        return { id: 'upload-1' };
      },
      async applyFormValues() {
        order.push('form');
      },
    });

    expect(result.status).toBe('dependency_failed');
    expect(order).toEqual(['person']);
  });

  it('maps a backdrop-only selection without writing the poster field', async () => {
    const appliedChanges: Array<{ fieldPath: string; value: unknown }> = [];
    await executeImportPlan({ ...plan, directors: [], actors: [], peopleToCreate: [], assetsToUpload: [plan.assetsToUpload[1]] }, params, {
      async findPeople() {
        return [];
      },
      async createPersonDraft() {
        return { id: 'person-1' };
      },
      async uploadImage() {
        return { id: 'backdrop-upload' };
      },
      async applyFormValues(changes) {
        appliedChanges.push(...changes);
      },
    });

    expect(appliedChanges).toContainEqual({ fieldPath: 'backdrops', value: [{ type: 'upload', id: 'backdrop-upload' }] });
    expect(appliedChanges.map((change) => change.fieldPath)).not.toContain('poster');
  });

  it('uses the English path for configured localized fields', async () => {
    const appliedChanges: Array<{ fieldPath: string; value: unknown }> = [];
    await executeImportPlan({ ...plan, directors: [], actors: [], peopleToCreate: [], assetsToUpload: [] }, params, {
      async findPeople() {
        return [];
      },
      async createPersonDraft() {
        return { id: 'person-1' };
      },
      async uploadImage() {
        return { id: 'upload-1' };
      },
      async applyFormValues(changes) {
        appliedChanges.push(...changes);
      },
    }, { localizedMovieFields: { title: true } });

    expect(appliedChanges).toEqual([{ fieldPath: 'title.en', value: 'Example Movie' }]);
  });

  it('does not clear directors when none are selected', async () => {
    const appliedChanges: Array<{ fieldPath: string; value: unknown }> = [];
    await executeImportPlan({ ...plan, directors: [], actors: [], peopleToCreate: [], assetsToUpload: [] }, params, {
      async findPeople() {
        return [];
      },
      async createPersonDraft() {
        return { id: 'person-1' };
      },
      async uploadImage() {
        return { id: 'upload-1' };
      },
      async applyFormValues(changes) {
        appliedChanges.push(...changes);
      },
    });

    expect(appliedChanges.map((change) => change.fieldPath)).not.toContain('directors');
  });
});
