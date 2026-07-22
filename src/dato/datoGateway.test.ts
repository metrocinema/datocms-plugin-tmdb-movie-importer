import { createDatoGateway } from './datoGateway';

describe('DatoGateway', () => {
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
