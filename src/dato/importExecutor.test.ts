import {
  applyPreparedImport,
  executeImportPlan,
  prepareImport,
  type ImportPhaseTiming,
  type ImportProgressEvent,
} from './importExecutor';
import { DuplicatePersonNameError, FormValuesApplyError } from './datoGateway';
import type { ImportPlan } from '../domain/importPlanning';
import { assetReference } from '../plugin/datoFieldMapping';
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

const trailerValue = {
  provider: 'youtube',
  provider_uid: 'abc_123',
  url: 'https://www.youtube.com/watch?v=abc_123',
  width: 1920,
  height: 1080,
  thumbnail_url: 'https://i.ytimg.com/vi/abc_123/hqdefault.jpg',
  title: 'Official Trailer',
} as const;

const trailerParams: PluginParameters = {
  ...params,
  movieFields: { ...params.movieFields, trailer: 'trailer' },
};

const preparedWithTrailer: PreparedImport = {
  fieldChanges: [{ key: 'trailer', value: trailerValue }],
  directors: [],
  actors: [],
  people: [],
  images: [],
  heroImage: null,
  otherImages: [],
  createdPeople: [],
  uploadedAssets: [],
};

const plan: ImportPlan = {
  fieldChanges: [{ key: 'title', value: 'Example Movie' }],
  directors: [{ tmdbId: 10, name: 'Director Name', order: 0, role: 'director' }],
  actors: [{ tmdbId: 20, name: 'Actor Name', order: 0, role: 'actor' }],
  peopleToCreate: [{ candidateTmdbId: 10, candidateRole: 'director', name: 'Director Name', source: 'auto' }, { candidateTmdbId: 20, candidateRole: 'actor', name: 'Actor Name', source: 'auto' }],
  peopleToReuse: [],
  heroImageToUpload: null,
  otherImagesToUpload: [
    { providerKey: 'tmdb', providerImageId: '/backdrop.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'backdrop', originalUrl: 'https://image.tmdb.org/t/p/original/backdrop.jpg', width: 200, height: 100, language: 'en', rank: 1, attribution: 'TMDB' },
  ],
  assetsToUpload: [
    { providerKey: 'tmdb', providerImageId: '/poster.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'poster', originalUrl: 'https://image.tmdb.org/t/p/original/poster.jpg', width: 100, height: 150, language: 'en', rank: 1, attribution: 'TMDB' },
    { providerKey: 'tmdb', providerImageId: '/backdrop.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'backdrop', originalUrl: 'https://image.tmdb.org/t/p/original/backdrop.jpg', width: 200, height: 100, language: 'en', rank: 1, attribution: 'TMDB' },
  ],
};

describe('executeImportPlan', () => {
  it('prepares dependencies without applying form values or retaining source image URLs', async () => {
    const progress: ImportProgressEvent[] = [];
    const applyFormValues = vi.fn();

    const result = await prepareImport(
      {
        ...plan,
        directors: [plan.directors[0]],
        actors: [],
        peopleToCreate: [plan.peopleToCreate[0]],
        assetsToUpload: [plan.assetsToUpload[0]],
        heroImageToUpload: null,
        otherImagesToUpload: [],
      },
      params,
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
        applyFormValues,
      },
      {
        onProgress: (event) => progress.push(event),
      },
    );

    expect(result.status).toBe('success');
    expect(applyFormValues).not.toHaveBeenCalled();
    expect(result.status === 'success' && result.prepared.images).toEqual([
      {
        providerKey: 'tmdb',
        providerImageId: '/poster.jpg',
        type: 'poster',
        uploadId: 'upload-1',
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('image.tmdb.org');
    expect(progress).toContainEqual({
      phase: 'images',
      state: 'complete',
      completed: 1,
      total: 1,
    });
  });

  it('continues preparation when a progress observer throws', async () => {
    const result = await prepareImport(
      {
        ...plan,
        directors: [],
        actors: [],
        peopleToCreate: [],
        assetsToUpload: [plan.assetsToUpload[0]],
        heroImageToUpload: null,
        otherImagesToUpload: [],
      },
      params,
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
        async applyFormValues() {
          return undefined;
        },
      },
      {
        onProgress() {
          throw new Error('observer failed');
        },
      },
    );

    expect(result.status).toBe('success');
  });

  it('continues preparation when an async progress observer rejects', async () => {
    const result = await prepareImport(
      {
        ...plan,
        directors: [],
        actors: [],
        peopleToCreate: [],
        assetsToUpload: [plan.assetsToUpload[0]],
        heroImageToUpload: null,
        otherImagesToUpload: [],
      },
      params,
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
        async applyFormValues() {
          return undefined;
        },
      },
      {
        onProgress: async () => {
          throw new Error('async observer failed');
        },
      },
    );

    await Promise.resolve();

    expect(result.status).toBe('success');
  });

  it('reports safe phase timings for Person lookup, Person creation, images, fields, and total work', async () => {
    const timings: ImportPhaseTiming[] = [];

    const result = await executeImportPlan(
      {
        ...plan,
        directors: [],
        actors: [],
        peopleToCreate: [],
        assetsToUpload: [plan.assetsToUpload[0]],
      },
      params,
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
        async applyFormValues() {
          return undefined;
        },
      },
      {
        onPhaseTiming: (timing) => timings.push(timing),
      },
    );

    expect(result.status).toBe('success');
    expect(timings.map(({ phase, status, itemCount }) => ({ phase, status, itemCount }))).toEqual([
      { phase: 'people_lookup', status: 'success', itemCount: 0 },
      { phase: 'people_create', status: 'success', itemCount: 0 },
      { phase: 'images', status: 'success', itemCount: 1 },
      { phase: 'fields', status: 'success', itemCount: 2 },
      { phase: 'total', status: 'success', itemCount: 3 },
    ]);
    expect(timings.every(({ durationMs }) => Number.isFinite(durationMs) && durationMs >= 0)).toBe(true);
  });

  it('does not fail the import when a phase timing observer throws', async () => {
    const result = await executeImportPlan(
      {
        ...plan,
        directors: [],
        actors: [],
        peopleToCreate: [],
        assetsToUpload: [],
      },
      params,
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
        async applyFormValues() {
          return undefined;
        },
      },
      {
        onPhaseTiming() {
          throw new Error('observer failed');
        },
      },
    );

    expect(result.status).toBe('success');
  });

  it('uploads images while Person lookup is pending and waits for both before applying fields', async () => {
    const events: string[] = [];
    let resolvePeople!: (records: []) => void;
    let resolveUpload!: (upload: { id: string }) => void;
    const execution = executeImportPlan(
      {
        ...plan,
        directors: [plan.directors[0]],
        actors: [],
        peopleToCreate: [plan.peopleToCreate[0]],
        assetsToUpload: [plan.assetsToUpload[0]],
      },
      params,
      {
        findPeople() {
          events.push('people_lookup');
          return new Promise((resolve) => {
            resolvePeople = resolve;
          });
        },
        async createPersonDraft() {
          events.push('person_create');
          return { id: 'person-1' };
        },
        uploadImage() {
          events.push('image_upload');
          return new Promise((resolve) => {
            resolveUpload = resolve;
          });
        },
        async applyFormValues() {
          events.push('fields');
        },
      },
    );

    await vi.waitFor(() => expect(events).toEqual(['people_lookup', 'image_upload']));
    resolveUpload({ id: 'upload-1' });
    await Promise.resolve();
    expect(events).not.toContain('fields');

    resolvePeople([]);
    await expect(execution).resolves.toMatchObject({ status: 'success' });
    expect(events).toEqual(['people_lookup', 'image_upload', 'person_create', 'fields']);
  });

  it('reports failed image timing when the concurrent upload branch fails', async () => {
    const timings: ImportPhaseTiming[] = [];
    const result = await executeImportPlan(
      {
        ...plan,
        directors: [],
        actors: [],
        peopleToCreate: [],
        assetsToUpload: [plan.assetsToUpload[0]],
      },
      params,
      {
        async findPeople() {
          return [];
        },
        async createPersonDraft() {
          return { id: 'person-1' };
        },
        async uploadImage() {
          throw new Error('upload failed');
        },
        async applyFormValues() {
          throw new Error('fields must not run');
        },
      },
      {
        onPhaseTiming: (timing) => timings.push(timing),
      },
    );

    expect(result.status).toBe('dependency_failed');
    expect(result.status === 'dependency_failed' && result.failedPhase).toBe('images');
    expect(timings).toEqual(expect.arrayContaining([
      expect.objectContaining({ phase: 'images', status: 'failed', itemCount: 1 }),
      expect.objectContaining({ phase: 'total', status: 'failed' }),
    ]));
  });

  it('reports Person creation failures without misreporting a successful lookup', async () => {
    const timings: ImportPhaseTiming[] = [];
    const result = await executeImportPlan(
      {
        ...plan,
        directors: [plan.directors[0]],
        actors: [],
        peopleToCreate: [plan.peopleToCreate[0]],
        assetsToUpload: [],
      },
      params,
      {
        async findPeople() {
          return [];
        },
        async createPersonDraft() {
          throw new Error('create failed');
        },
        async uploadImage() {
          return { id: 'upload-1' };
        },
        async applyFormValues() {
          throw new Error('fields must not run');
        },
      },
      {
        onPhaseTiming: (timing) => timings.push(timing),
      },
    );

    expect(result.status).toBe('dependency_failed');
    expect(result.status === 'dependency_failed' && result.failedPhase).toBe('people_create');
    expect(timings.filter(({ phase }) => phase === 'people_lookup')).toEqual([
      expect.objectContaining({ status: 'success', itemCount: 1 }),
    ]);
    expect(timings).toEqual(expect.arrayContaining([
      expect.objectContaining({ phase: 'people_create', status: 'failed', itemCount: 1 }),
      expect.objectContaining({ phase: 'total', status: 'failed' }),
    ]));
  });

  it('preserves the first actual dependency failure when concurrent branches both fail', async () => {
    let finishLookup: ((records: []) => void) | undefined;
    const execution = prepareImport(
      {
        ...plan,
        directors: [plan.directors[0]],
        actors: [],
        peopleToCreate: [plan.peopleToCreate[0]],
        assetsToUpload: [plan.assetsToUpload[0]],
      },
      params,
      {
        findPeople() {
          return new Promise((resolve) => {
            finishLookup = resolve;
          });
        },
        async createPersonDraft() {
          throw new Error('create failed after upload');
        },
        async uploadImage() {
          throw new Error('upload failed first');
        },
        async applyFormValues() {
          throw new Error('fields must not run');
        },
      },
    );

    await Promise.resolve();
    finishLookup?.([]);

    const result = await execution;

    expect(result.status === 'dependency_failed' && result.failedPhase).toBe('images');
  });

  it('uploads at most five independent images at a time', async () => {
    const images = Array.from({ length: 6 }, (_, index) => ({
      ...plan.assetsToUpload[1],
      providerImageId: `/backdrop-${index + 1}.jpg`,
      originalUrl: `https://image.tmdb.org/t/p/original/backdrop-${index + 1}.jpg`,
    }));
    const started: string[] = [];
    const pending = new Map<string, (value: { id: string }) => void>();
    const execution = executeImportPlan(
      {
        ...plan,
        fieldChanges: [],
        directors: [],
        actors: [],
        peopleToCreate: [],
        otherImagesToUpload: images,
        assetsToUpload: images,
      },
      params,
      {
        async findPeople() {
          return [];
        },
        async createPersonDraft() {
          return { id: 'person-1' };
        },
        uploadImage(image) {
          started.push(image.providerImageId);
          return new Promise((resolve) => pending.set(image.providerImageId, resolve));
        },
        async applyFormValues() {
          return undefined;
        },
      },
    );

    await vi.waitFor(() => expect(started).toEqual([
      '/backdrop-1.jpg',
      '/backdrop-2.jpg',
      '/backdrop-3.jpg',
      '/backdrop-4.jpg',
      '/backdrop-5.jpg',
    ]));
    expect(started).not.toContain('/backdrop-6.jpg');

    pending.get('/backdrop-1.jpg')?.({ id: 'upload-1' });
    await vi.waitFor(() => expect(started).toContain('/backdrop-6.jpg'));
    pending.get('/backdrop-2.jpg')?.({ id: 'upload-2' });
    pending.get('/backdrop-3.jpg')?.({ id: 'upload-3' });
    pending.get('/backdrop-4.jpg')?.({ id: 'upload-4' });
    pending.get('/backdrop-5.jpg')?.({ id: 'upload-5' });
    pending.get('/backdrop-6.jpg')?.({ id: 'upload-6' });

    await expect(execution).resolves.toMatchObject({
      status: 'success',
      uploadedAssets: [
        'upload-1',
        'upload-2',
        'upload-3',
        'upload-4',
        'upload-5',
        'upload-6',
      ],
    });
  });

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
    expect(order.at(-1)).toBe('form');
    expect(order.slice(0, -1).sort()).toEqual(['person', 'person', 'upload', 'upload']);
    expect(appliedChanges).toEqual([
      { fieldPath: 'title', value: 'Example Movie' },
      { fieldPath: 'directors', value: ['person-1'] },
      { fieldPath: 'actors', value: ['person-2'] },
      { fieldPath: 'poster', value: assetReference('upload-1') },
      { fieldPath: 'backdrops', value: [assetReference('upload-2')] },
    ]);
  });

  it('passes the resolved Person model ID when creating draft people', async () => {
    const createPersonDraft = vi.fn(async () => ({ id: 'person-1' }));

    const result = await executeImportPlan({
      ...plan,
      directors: [{ tmdbId: 10, name: 'Director Name', order: 0, role: 'director' }],
      actors: [],
      peopleToCreate: [{ candidateTmdbId: 10, candidateRole: 'director', name: 'Director Name', source: 'auto' }],
      assetsToUpload: [],
    }, params, {
      async findPeople() {
        return [];
      },
      createPersonDraft,
      async uploadImage() {
        return { id: 'upload-1' };
      },
      async applyFormValues() {
        return undefined;
      },
    }, { personModelId: 'person-id' });

    expect(result.status).toBe('success');
    expect(createPersonDraft).toHaveBeenCalledWith(expect.objectContaining({
      modelApiKey: 'person',
      modelId: 'person-id',
    }));
  });

  it('stops before form updates when a dependency write fails', async () => {
    const order: string[] = [];
    const progress: ImportProgressEvent[] = [];
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
    }, {
      onProgress: (event) => progress.push(event),
    });

    expect(result.status).toBe('dependency_failed');
    if (result.status !== 'dependency_failed') {
      throw new Error(`Expected dependency_failed, got ${result.status}`);
    }
    expect(result.message).toBe('The import could not finish while creating people or uploading images. Some drafts or uploads may already exist in DatoCMS.');
    expect(result.message).not.toContain('permission denied');
    expect(progress).toContainEqual({
      phase: 'people_create',
      state: 'failed',
      completed: 0,
      total: 2,
      message: 'Person creation failed.',
    });
    expect(order).toContain('person');
    expect(order.filter((event) => event === 'upload')).toHaveLength(2);
    expect(order).not.toContain('form');
  });

  it('does not warn about cleanup when lookup fails before dependency writes', async () => {
    const result = await executeImportPlan(
      {
        ...plan,
        directors: [plan.directors[0]],
        actors: [],
        peopleToCreate: [plan.peopleToCreate[0]],
        assetsToUpload: [],
      },
      params,
      {
        async findPeople() {
          throw new Error('private lookup failure detail');
        },
        async createPersonDraft() {
          throw new Error('person creation must not run');
        },
        async uploadImage() {
          throw new Error('image upload must not run');
        },
        async applyFormValues() {
          throw new Error('form update must not run');
        },
      },
    );

    expect(result).toMatchObject({
      status: 'dependency_failed',
      failedPhase: 'people_lookup',
      sideEffectsPossible: false,
      message:
        'The import could not finish while matching existing people. No drafts or uploads were created in DatoCMS.',
    });
    if (result.status !== 'dependency_failed') {
      throw new Error(`Expected dependency_failed, got ${result.status}`);
    }
    expect(result.message).not.toContain('private lookup failure detail');
    expect(result.message).not.toContain('may already exist');
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

    expect(appliedChanges).toContainEqual({ fieldPath: 'backdrops', value: [assetReference('backdrop-upload')] });
    expect(appliedChanges.map((change) => change.fieldPath)).not.toContain('poster');
  });

  it('maps an explicit hero image without clearing other images', async () => {
    const appliedChanges: Array<{ fieldPath: string; value: unknown }> = [];
    await executeImportPlan(
      { ...plan, directors: [], actors: [], peopleToCreate: [], heroImageToUpload: plan.assetsToUpload[1], otherImagesToUpload: [], assetsToUpload: [plan.assetsToUpload[1]] },
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

    expect(appliedChanges).toContainEqual({ fieldPath: 'hero_image', value: assetReference('backdrop-upload') });
    expect(appliedChanges.map((change) => change.fieldPath)).not.toContain('other_images');
  });

  it('does not write hero image when only other backdrop images are selected', async () => {
    const appliedChanges: Array<{ fieldPath: string; value: unknown }> = [];
    await executeImportPlan(
      { ...plan, directors: [], actors: [], peopleToCreate: [], heroImageToUpload: null, otherImagesToUpload: [plan.assetsToUpload[1]], assetsToUpload: [plan.assetsToUpload[1]] },
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

    expect(appliedChanges).toContainEqual({ fieldPath: 'other_images', value: [assetReference('backdrop-upload')] });
    expect(appliedChanges.map((change) => change.fieldPath)).not.toContain('hero_image');
  });

  it('maps uploaded backdrop assets by provider and provider image ID', async () => {
    const firstBackdrop = { providerKey: 'tmdb', providerImageId: '/shared.jpg', movieIdentity: { providerKey: 'tmdb', tmdbId: 1 }, type: 'backdrop', originalUrl: 'https://image.tmdb.org/t/p/original/shared.jpg', width: 200, height: 100, language: 'en', rank: 1, attribution: 'TMDB' } as const;
    const secondBackdrop = { ...firstBackdrop, providerKey: 'future', originalUrl: 'https://future.example/shared.jpg', attribution: 'Future Provider' } as const;
    const appliedChanges: Array<{ fieldPath: string; value: unknown }> = [];

    await executeImportPlan(
      {
        ...plan,
        directors: [],
        actors: [],
        peopleToCreate: [],
        heroImageToUpload: secondBackdrop,
        otherImagesToUpload: [firstBackdrop],
        assetsToUpload: [firstBackdrop, secondBackdrop],
      },
      { ...params, movieFields: { ...params.movieFields, heroImage: 'hero_image', backdrops: 'other_images' } },
      {
        async findPeople() {
          return [];
        },
        async createPersonDraft() {
          return { id: 'person-1' };
        },
        async uploadImage(image) {
          return { id: image.providerKey === 'future' ? 'future-upload' : 'tmdb-upload' };
        },
        async applyFormValues(changes) {
          appliedChanges.push(...changes);
        },
      },
    );

    expect(appliedChanges).toContainEqual({ fieldPath: 'hero_image', value: assetReference('future-upload') });
    expect(appliedChanges).toContainEqual({ fieldPath: 'other_images', value: [assetReference('tmdb-upload')] });
  });

  it('excludes a prepared hero image from the other images gallery', async () => {
    const appliedChanges: Array<{ fieldPath: string; value: unknown }> = [];

    await applyPreparedImport(
      {
        fieldChanges: [],
        directors: [],
        actors: [],
        people: [],
        images: [
          { providerKey: 'tmdb', providerImageId: '/hero.jpg', type: 'backdrop', uploadId: 'hero-upload' },
          { providerKey: 'tmdb', providerImageId: '/other.jpg', type: 'backdrop', uploadId: 'other-upload' },
        ],
        heroImage: { providerKey: 'tmdb', providerImageId: '/hero.jpg' },
        otherImages: [
          { providerKey: 'tmdb', providerImageId: '/hero.jpg' },
          { providerKey: 'tmdb', providerImageId: '/other.jpg' },
        ],
        createdPeople: [],
        uploadedAssets: ['hero-upload', 'other-upload'],
      },
      { ...params, movieFields: { ...params.movieFields, heroImage: 'hero_image', backdrops: 'other_images' } },
      {
        async findPeople() {
          return [];
        },
        async createPersonDraft() {
          return { id: 'person-1' };
        },
        async uploadImage() {
          return { id: 'unused-upload' };
        },
        async applyFormValues(changes) {
          appliedChanges.push(...changes);
        },
      },
    );

    expect(appliedChanges).toContainEqual({ fieldPath: 'hero_image', value: assetReference('hero-upload') });
    expect(appliedChanges).toContainEqual({ fieldPath: 'other_images', value: [assetReference('other-upload')] });
  });

  it('does not write other images when its only prepared candidate is the hero image', async () => {
    const appliedChanges: Array<{ fieldPath: string; value: unknown }> = [];

    await applyPreparedImport(
      {
        fieldChanges: [],
        directors: [],
        actors: [],
        people: [],
        images: [
          { providerKey: 'tmdb', providerImageId: '/hero.jpg', type: 'backdrop', uploadId: 'hero-upload' },
        ],
        heroImage: { providerKey: 'tmdb', providerImageId: '/hero.jpg' },
        otherImages: [{ providerKey: 'tmdb', providerImageId: '/hero.jpg' }],
        createdPeople: [],
        uploadedAssets: ['hero-upload'],
      },
      { ...params, movieFields: { ...params.movieFields, heroImage: 'hero_image', backdrops: 'other_images' } },
      {
        async findPeople() {
          return [];
        },
        async createPersonDraft() {
          return { id: 'person-1' };
        },
        async uploadImage() {
          return { id: 'unused-upload' };
        },
        async applyFormValues(changes) {
          appliedChanges.push(...changes);
        },
      },
    );

    expect(appliedChanges).toContainEqual({ fieldPath: 'hero_image', value: assetReference('hero-upload') });
    expect(appliedChanges.map((change) => change.fieldPath)).not.toContain('other_images');
  });

  it('uses the active editor locale path for configured localized fields', async () => {
    const appliedChanges: Array<{ fieldPath: string; value: unknown }> = [];
    await executeImportPlan({ ...plan, directors: [], actors: [], peopleToCreate: [], assetsToUpload: [] }, { ...params, targetLocale: 'en-US' }, {
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

    expect(appliedChanges).toEqual([{ fieldPath: 'title.en-US', value: 'Example Movie' }]);
  });

  it('applies a reviewed trailer as a native External Video value', async () => {
    const gateway = {
      async findPeople() {
        return [];
      },
      async createPersonDraft() {
        return { id: 'person-1' };
      },
      async uploadImage() {
        return { id: 'upload-1' };
      },
      applyFormValues: vi.fn(async () => undefined),
    };

    await applyPreparedImport(preparedWithTrailer, trailerParams, gateway);

    expect(gateway.applyFormValues).toHaveBeenCalledWith(
      expect.arrayContaining([{ fieldPath: 'trailer', value: trailerValue }]),
    );
  });

  it('applies a reviewed trailer to the active locale path', async () => {
    const gateway = {
      async findPeople() {
        return [];
      },
      async createPersonDraft() {
        return { id: 'person-1' };
      },
      async uploadImage() {
        return { id: 'upload-1' };
      },
      applyFormValues: vi.fn(async () => undefined),
    };

    await applyPreparedImport(preparedWithTrailer, trailerParams, gateway, {
      localizedMovieFields: { trailer: true },
    });

    expect(gateway.applyFormValues).toHaveBeenCalledWith(
      expect.arrayContaining([{ fieldPath: 'trailer.en', value: trailerValue }]),
    );
  });

  it('writes description in the editor Slate format when configured field type is structured_text', async () => {
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
        value: [
          {
            type: 'paragraph',
            children: [{ text: 'Overview text' }],
          },
        ],
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
      peopleToCreate: [{ candidateTmdbId: 10, candidateRole: 'director', name: 'Director Name', source: 'auto' }],
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
    expect(appliedChanges).toContainEqual({ fieldPath: 'directors', value: ['person-existing'] });
  });

  it('keeps manual create and reuse decisions separate for the same TMDB person in different roles', async () => {
    const createPersonDraft = vi.fn(async () => ({ id: 'created-director' }));
    const findPeople = vi.fn(async () => []);
    const appliedChanges: Array<{ fieldPath: string; value: unknown }> = [];
    const result = await executeImportPlan(
      {
        ...plan,
        directors: [{ tmdbId: 99, name: 'Multi-Hyphenate Person', order: 0, role: 'director' }],
        actors: [{ tmdbId: 99, name: 'Multi-Hyphenate Person', order: 0, role: 'actor' }],
        peopleToCreate: [{ candidateTmdbId: 99, candidateRole: 'director', name: 'Multi-Hyphenate Person', source: 'manual' }],
        peopleToReuse: [{ candidateTmdbId: 99, candidateRole: 'actor', recordId: 'existing-actor', name: 'Multi-Hyphenate Person', source: 'manual' }],
        assetsToUpload: [],
      },
      params,
      {
        findPeople,
        createPersonDraft,
        async uploadImage() {
          return { id: 'upload-1' };
        },
        async applyFormValues(changes) {
          appliedChanges.push(...changes);
        },
      },
    );

    expect(result.status).toBe('success');
    expect(findPeople).not.toHaveBeenCalled();
    expect(createPersonDraft).toHaveBeenCalledTimes(1);
    expect(appliedChanges).toContainEqual({ fieldPath: 'directors', value: ['created-director'] });
    expect(appliedChanges).toContainEqual({ fieldPath: 'actors', value: ['existing-actor'] });
  });

  it('reuses a person found after DatoCMS rejects draft creation for a unique name', async () => {
    const createPersonDraft = vi.fn(async () => {
      throw new DuplicatePersonNameError('Director Name');
    });
    const findPeople = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'existing-director', name: 'Director Name', tmdbId: null }]);
    const appliedChanges: Array<{ fieldPath: string; value: unknown }> = [];

    const result = await executeImportPlan(
      {
        ...plan,
        directors: [{ tmdbId: 10, name: 'Director Name', order: 0, role: 'director' }],
        actors: [],
        peopleToCreate: [{ candidateTmdbId: 10, candidateRole: 'director', name: 'Director Name', source: 'auto' }],
        peopleToReuse: [],
        assetsToUpload: [],
      },
      params,
      {
        findPeople,
        createPersonDraft,
        async uploadImage() {
          return { id: 'upload-1' };
        },
        async applyFormValues(changes) {
          appliedChanges.push(...changes);
        },
      },
    );

    if (result.status !== 'success') {
      throw new Error(`Expected success, got ${result.status}`);
    }
    expect(result.createdPeople).toEqual([]);
    expect(findPeople).toHaveBeenCalledTimes(2);
    expect(appliedChanges).toContainEqual({ fieldPath: 'directors', value: ['existing-director'] });
  });

  it('creates one automatic draft when the same TMDB person appears in multiple roles', async () => {
    const createPersonDraft = vi.fn(async () => ({ id: 'created-person' }));
    const appliedChanges: Array<{ fieldPath: string; value: unknown }> = [];
    const result = await executeImportPlan(
      {
        ...plan,
        directors: [{ tmdbId: 99, name: 'Multi-Hyphenate Person', order: 0, role: 'director' }],
        actors: [{ tmdbId: 99, name: 'Multi-Hyphenate Person', order: 0, role: 'actor' }],
        peopleToCreate: [
          { candidateTmdbId: 99, candidateRole: 'director', name: 'Multi-Hyphenate Person', source: 'auto' },
          { candidateTmdbId: 99, candidateRole: 'actor', name: 'Multi-Hyphenate Person', source: 'auto' },
        ],
        peopleToReuse: [],
        assetsToUpload: [],
      },
      params,
      {
        async findPeople() {
          return [];
        },
        createPersonDraft,
        async uploadImage() {
          return { id: 'upload-1' };
        },
        async applyFormValues(changes) {
          appliedChanges.push(...changes);
        },
      },
    );

    expect(result.status).toBe('success');
    expect(createPersonDraft).toHaveBeenCalledTimes(1);
    expect(appliedChanges).toContainEqual({ fieldPath: 'directors', value: ['created-person'] });
    expect(appliedChanges).toContainEqual({ fieldPath: 'actors', value: ['created-person'] });
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
        throw new FormValuesApplyError('secret SDK failure detail', ['title']);
      },
    });

    expect(result).toMatchObject({ status: 'form_failed', appliedFields: ['title'] });
    if (result.status !== 'form_failed') {
      throw new Error(`Expected form_failed, got ${result.status}`);
    }
    expect(result.message).toBe(
      'The import could not finish while updating the movie form. Created people and uploaded images may already exist in DatoCMS.',
    );
    expect(result.message).not.toContain('secret SDK failure detail');
  });

  it('does not expose unexpected form update errors', async () => {
    const result = await executeImportPlan(
      {
        ...plan,
        directors: [],
        actors: [],
        peopleToCreate: [],
        assetsToUpload: [],
      },
      params,
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
        async applyFormValues() {
          throw new Error('POST /items failed with internal request details');
        },
      },
    );

    expect(result).toMatchObject({
      status: 'form_failed',
      message:
        'The import could not finish while updating the movie form. Created people and uploaded images may already exist in DatoCMS.',
    });
    if (result.status !== 'form_failed') {
      throw new Error(`Expected form_failed, got ${result.status}`);
    }
    expect(result.message).not.toContain('internal request details');
  });
});
