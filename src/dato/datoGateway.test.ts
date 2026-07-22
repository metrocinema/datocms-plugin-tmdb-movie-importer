import { createDatoGateway } from './datoGateway';

describe('DatoGateway', () => {
  it('finds configured people by normalized name and maps their records', async () => {
    const list = async (params: Record<string, unknown>) => {
      expect(params).toEqual({
        filter: {
          type: 'person',
        },
      });

      return [
        { id: 'person-1', name: 'Director Name', tmdb_id: '77' },
        { id: 'person-2', name: ' actor   name ' },
        { id: 'person-3', name: 'Unrequested Person' },
      ];
    };
    const gateway = createDatoGateway({ client: { items: { list } }, ctx: {} });

    await expect(
      gateway.findPeople({
        modelApiKey: 'person',
        nameFieldApiKey: 'name',
        tmdbIdFieldApiKey: 'tmdb_id',
        names: ['Director Name', 'Actor Name'],
      }),
    ).resolves.toEqual([
      { id: 'person-1', name: 'Director Name', tmdbId: 77 },
      { id: 'person-2', name: ' actor   name ', tmdbId: null },
    ]);
  });

  it('throws when person lookup is unavailable', async () => {
    const gateway = createDatoGateway({ client: { items: {} }, ctx: {} });

    await expect(
      gateway.findPeople({
        modelApiKey: 'person',
        nameFieldApiKey: 'name',
        tmdbIdFieldApiKey: null,
        names: ['Director Name'],
      }),
    ).rejects.toThrow('DatoCMS item list permission is unavailable.');
  });

  it('finds a configured person by TMDB ID even when the stored name differs', async () => {
    const gateway = createDatoGateway({
      client: {
        items: {
          list: async () => [{ id: 'person-1', name: 'Dato Display Name', tmdb_id: 77 }],
        },
      },
      ctx: {},
    });

    await expect(gateway.findPeople({
      modelApiKey: 'person',
      nameFieldApiKey: 'name',
      tmdbIdFieldApiKey: 'tmdb_id',
      names: ['TMDB Director Name'],
      tmdbIds: [77],
    })).resolves.toEqual([{ id: 'person-1', name: 'Dato Display Name', tmdbId: 77 }]);
  });

  it('creates draft people with name and optional TMDB id', async () => {
    const created: unknown[] = [];
    const gateway = createDatoGateway({
      client: {
        items: {
          create: async (payload: unknown) => {
            created.push(payload);
            return { id: 'person-1' };
          },
        },
      },
      ctx: { environment: 'main' },
    });

    const record = await gateway.createPersonDraft({
      modelApiKey: 'person',
      nameFieldApiKey: 'name',
      tmdbIdFieldApiKey: 'tmdb_id',
      name: 'Director Name',
      tmdbId: 77,
    });

    expect(record.id).toBe('person-1');
    expect(created[0]).toMatchObject({
      item_type: { type: 'item_type', id: 'person' },
      name: 'Director Name',
      tmdb_id: 77,
    });
  });

  it('throws when draft person creation is unavailable', async () => {
    const gateway = createDatoGateway({ client: { items: {} }, ctx: {} });

    await expect(
      gateway.createPersonDraft({
        modelApiKey: 'person',
        nameFieldApiKey: 'name',
        tmdbIdFieldApiKey: null,
        name: 'Director Name',
        tmdbId: 77,
      }),
    ).rejects.toThrow('DatoCMS item create permission is unavailable.');
  });

  it('uploads image metadata using the configured locale', async () => {
    const created: unknown[] = [];
    const gateway = createDatoGateway({
      client: {
        uploads: {
          createFromUrl: async (payload) => {
            created.push(payload);
            return { id: 'upload-1' };
          },
        },
      },
      ctx: {},
      targetLocale: 'en-US',
    });

    await gateway.uploadImage({
      providerKey: 'tmdb',
      providerImageId: '/poster.jpg',
      movieIdentity: { providerKey: 'tmdb', tmdbId: 1 },
      type: 'poster',
      originalUrl: 'https://image.tmdb.org/t/p/original/poster.jpg',
      width: 100,
      height: 150,
      language: 'en',
      rank: 1,
      attribution: 'TMDB',
    });

    expect(created[0]).toMatchObject({
      default_field_metadata: {
        'en-US': {
          alt: 'poster from tmdb',
          title: '/poster.jpg',
        },
      },
    });
  });

  it('throws when image upload is unavailable', async () => {
    const gateway = createDatoGateway({ client: {}, ctx: {} });

    await expect(
      gateway.uploadImage({
        providerKey: 'tmdb',
        providerImageId: '/poster.jpg',
        movieIdentity: { providerKey: 'tmdb', tmdbId: 1 },
        type: 'poster',
        originalUrl: 'https://image.tmdb.org/t/p/original/poster.jpg',
        width: 100,
        height: 150,
        language: 'en',
        rank: 1,
        attribution: 'TMDB',
      }),
    ).rejects.toThrow('DatoCMS upload permission is unavailable.');
  });

  it('applies form values through the provided setter', async () => {
    const calls: Array<[string, unknown]> = [];
    const gateway = createDatoGateway({
      client: {},
      ctx: {
        setFieldValue: async (fieldPath: string, value: unknown) => {
          calls.push([fieldPath, value]);
        },
      },
    });

    await gateway.applyFormValues([{ fieldPath: 'title.en', value: 'Example Movie' }]);

    expect(calls).toEqual([['title.en', 'Example Movie']]);
  });

  it('throws when form updates are unavailable', async () => {
    const gateway = createDatoGateway({ client: {}, ctx: {} });

    await expect(gateway.applyFormValues([])).rejects.toThrow('DatoCMS form update API is unavailable.');
  });
});
