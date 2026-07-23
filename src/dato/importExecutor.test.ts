import { executeImportPlan } from './importExecutor';
import { FormValuesApplyError } from './datoGateway';
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
    if (result.status !== 'dependency_failed') {
      throw new Error(`Expected dependency_failed, got ${result.status}`);
    }
    expect(result.message).toContain('Some drafts or uploads may already exist in DatoCMS.');
    expect(result.message).toContain('permission denied');
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

  it('maps the first selected backdrop to the hero image field', async () => {
    const appliedChanges: Array<{ fieldPath: string; value: unknown }> = [];
    await executeImportPlan(
      { ...plan, directors: [], actors: [], peopleToCreate: [], assetsToUpload: [plan.assetsToUpload[1]] },
      { ...params, movieFields: { ...params.movieFields, heroImage: 'hero_image', backdrops: 'other_images' } },
      {
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
      },
    );

    expect(appliedChanges).toContainEqual({ fieldPath: 'hero_image', value: { type: 'upload', id: 'backdrop-upload' } });
    expect(appliedChanges).toContainEqual({ fieldPath: 'other_images', value: [{ type: 'upload', id: 'backdrop-upload' }] });
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

  it('writes description as a structured text document when configured field type is structured_text', async () => {
    const appliedChanges: Array<{ fieldPath: string; value: unknown }> = [];
    await executeImportPlan(
      {
        ...plan,
        fieldChanges: [{ key: 'description', value: 'Overview text' }],
        directors: [],
        actors: [],
        peopleToCreate: [],
        assetsToUpload: [],
      },
      { ...params, movieFields: { description: 'description' } },
      {
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
      },
      { movieFieldTypes: { description: 'structured_text' } },
    );

    expect(appliedChanges).toEqual([
      {
        fieldPath: 'description',
        value: {
          schema: 'dast',
          document: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'span', value: 'Overview text' }],
              },
            ],
          },
        },
      },
    ]);
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

  it('reuses a person discovered during the pre-create requery', async () => {
    const createPersonDraft = vi.fn();
    const appliedChanges: Array<{ fieldPath: string; value: unknown }> = [];
    const result = await executeImportPlan({
      ...plan,
      actors: [],
      peopleToCreate: [{ candidateTmdbId: 10, name: 'Director Name' }],
      assetsToUpload: [],
    }, params, {
      async findPeople(input) {
        expect(input).toMatchObject({ names: ['Director Name'], tmdbIds: [10] });
        return [{ id: 'person-existing', name: 'Director Name', tmdbId: null }];
      },
      createPersonDraft,
      async uploadImage() {
        return { id: 'upload-1' };
      },
      async applyFormValues(changes) {
        appliedChanges.push(...changes);
      },
    });

    expect(result.status).toBe('success');
    expect(createPersonDraft).not.toHaveBeenCalled();
    expect(appliedChanges).toContainEqual({ fieldPath: 'directors', value: [{ type: 'item', id: 'person-existing' }] });
  });

  it('reports fields applied before a form update fails', async () => {
    const result = await executeImportPlan({ ...plan, directors: [], actors: [], peopleToCreate: [], assetsToUpload: [] }, params, {
      async findPeople() {
        return [];
      },
      async createPersonDraft() {
        return { id: 'person-1' };
      },
      async uploadImage() {
        return { id: 'upload-1' };
      },
      async applyFormValues() {
        throw new FormValuesApplyError('Form update failed.', ['title']);
      },
    });

    expect(result).toMatchObject({ status: 'form_failed', appliedFields: ['title'] });
    if (result.status !== 'form_failed') {
      throw new Error(`Expected form_failed, got ${result.status}`);
    }
    expect(result.message).toContain('Created people and uploaded images may already exist in DatoCMS.');
    expect(result.message).toContain('Form update failed.');
  });
});
