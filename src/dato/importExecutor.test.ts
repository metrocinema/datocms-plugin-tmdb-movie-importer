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
    directors: 'directors',
  },
  personModelApiKey: 'person',
  personNameFieldApiKey: 'name',
  personTmdbIdFieldApiKey: null,
  actorLimit: 10,
};

const plan: ImportPlan = {
  fieldChanges: [{ key: 'title', value: 'Example Movie' }],
  directors: [{ tmdbId: 10, name: 'Director Name', order: 0, role: 'director' }],
  actors: [],
  peopleToCreate: [{ candidateTmdbId: 10, name: 'Director Name' }],
  peopleToReuse: [],
  assetsToUpload: [{ providerKey: 'tmdb', providerImageId: '/poster.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'poster', originalUrl: 'https://image.tmdb.org/t/p/original/poster.jpg', width: 100, height: 150, language: 'en', rank: 1, attribution: 'TMDB' }],
};

describe('executeImportPlan', () => {
  it('creates people and uploads assets before applying form values', async () => {
    const order: string[] = [];
    const result = await executeImportPlan(plan, params, {
      async findPeople() {
        return [];
      },
      async createPersonDraft() {
        order.push('person');
        return { id: 'person-1' };
      },
      async uploadImage() {
        order.push('upload');
        return { id: 'upload-1' };
      },
      async applyFormValues() {
        order.push('form');
      },
    });

    expect(result.status).toBe('success');
    expect(order).toEqual(['person', 'upload', 'form']);
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
});
