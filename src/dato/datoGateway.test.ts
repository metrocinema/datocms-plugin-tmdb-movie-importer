import { createDatoGateway } from './datoGateway';

describe('DatoGateway', () => {
  it('finds configured people by name and maps their records', async () => {
    const list = async (params: Record<string, unknown>) => {
      expect(params).toEqual({
        filter: {
          type: 'person',
          name: { in: ['Director Name', 'Actor Name'] },
        },
      });

      return [
        { id: 'person-1', name: 'Director Name', tmdb_id: '77' },
        { id: 'person-2', name: 'Actor Name' },
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
      { id: 'person-2', name: 'Actor Name', tmdbId: null },
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
});
