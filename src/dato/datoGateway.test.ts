import { createDatoGateway, DuplicatePersonNameError } from './datoGateway';

describe('DatoGateway', () => {
  it('finds configured people by normalized name and maps their records', async () => {
    const list = async (params: Record<string, unknown>) => {
      expect(params).toEqual({
        filter: {
          type: 'person',
          fields: {
            name: {
              in: ['Director Name', 'Actor Name'],
            },
          },
        },
        page: {
          limit: 500,
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

  it('finds configured people beyond the first DatoCMS item page', async () => {
    const iteratorCalls: Array<{ params: unknown; options: unknown }> = [];
    async function* listPagedIterator(params: unknown, options: unknown) {
      iteratorCalls.push({ params, options });
      if ((params as { filter?: { fields?: unknown } }).filter?.fields) {
        yield { id: 'person-2', name: 'Director Name', tmdb_id: '77' };
      }
    }

    const gateway = createDatoGateway({ client: { items: { listPagedIterator } }, ctx: {} });

    await expect(
      gateway.findPeople({
        modelApiKey: 'person',
        nameFieldApiKey: 'name',
        tmdbIdFieldApiKey: 'tmdb_id',
        names: ['Director Name'],
        tmdbIds: [77],
      }),
    ).resolves.toEqual([
      { id: 'person-2', name: 'Director Name', tmdbId: 77 },
    ]);
    expect(iteratorCalls).toEqual([
      {
        params: {
          filter: {
            type: 'person',
            fields: {
              name: {
                in: ['Director Name'],
              },
            },
          },
        },
        options: { perPage: 500 },
      },
      {
        params: {
          filter: {
            type: 'person',
            fields: {
              tmdb_id: {
                eq: 77,
              },
            },
          },
        },
        options: { perPage: 500 },
      },
    ]);
  });

  it('falls back to a normalized person scan when exact DatoCMS name filters miss editorial name variants', async () => {
    const iteratorCalls: Array<{ params: unknown; options: unknown }> = [];
    async function* listPagedIterator(params: unknown, options: unknown) {
      iteratorCalls.push({ params, options });
      const fields = (params as { filter?: { fields?: Record<string, unknown> } }).filter?.fields;
      if (fields?.name || fields?.tmdb_id) {
        return;
      }

      yield { id: 'person-1', name: ' actor   name ' };
      yield { id: 'person-2', name: 'Unrequested Person' };
    }

    const gateway = createDatoGateway({ client: { items: { listPagedIterator } }, ctx: {} });

    await expect(
      gateway.findPeople({
        modelApiKey: 'person',
        nameFieldApiKey: 'name',
        tmdbIdFieldApiKey: 'tmdb_id',
        names: ['Actor Name'],
        tmdbIds: [77],
      }),
    ).resolves.toEqual([
      { id: 'person-1', name: ' actor   name ', tmdbId: null },
    ]);
    expect(iteratorCalls).toContainEqual({
      params: {
        filter: {
          type: 'person',
        },
      },
      options: { perPage: 500 },
    });
  });

  it('skips the broad normalized person scan when TMDB ID already resolves the requested person', async () => {
    const iteratorCalls: Array<{ params: unknown; options: unknown }> = [];
    async function* listPagedIterator(params: unknown, options: unknown) {
      iteratorCalls.push({ params, options });
      const fields = (params as { filter?: { fields?: Record<string, unknown> } }).filter?.fields;
      if (fields?.tmdb_id) {
        yield { id: 'person-1', name: 'Editorial Display Name', tmdb_id: 77 };
      }
    }

    const gateway = createDatoGateway({ client: { items: { listPagedIterator } }, ctx: {} });

    await expect(
      gateway.findPeople({
        modelApiKey: 'person',
        nameFieldApiKey: 'name',
        tmdbIdFieldApiKey: 'tmdb_id',
        names: ['TMDB Director Name'],
        tmdbIds: [77],
      }),
    ).resolves.toEqual([
      { id: 'person-1', name: 'Editorial Display Name', tmdbId: 77 },
    ]);
    expect(iteratorCalls).not.toContainEqual({
      params: {
        filter: {
          type: 'person',
        },
      },
      options: { perPage: 500 },
    });
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

  it('creates draft people with the resolved DatoCMS model ID when available', async () => {
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

    await gateway.createPersonDraft({
      modelApiKey: 'person',
      modelId: 'person-id',
      nameFieldApiKey: 'name',
      tmdbIdFieldApiKey: null,
      name: 'Director Name',
      tmdbId: 77,
    });

    expect(created[0]).toMatchObject({
      item_type: { type: 'item_type', id: 'person-id' },
      name: 'Director Name',
    });
  });

  it('reports duplicate Person names from DatoCMS unique-field validation errors', async () => {
    const gateway = createDatoGateway({
      client: {
        items: {
          create: async () => {
            throw {
              response: {
                body: {
                  data: [{
                    attributes: {
                      code: 'INVALID_FIELD',
                      details: { field: 'name', code: 'VALIDATION_UNIQUE' },
                    },
                  }],
                },
              },
            };
          },
        },
      },
      ctx: { environment: 'main' },
    });

    await expect(
      gateway.createPersonDraft({
        modelApiKey: 'person',
        nameFieldApiKey: 'name',
        tmdbIdFieldApiKey: null,
        name: 'Director Name',
        tmdbId: 77,
      }),
    ).rejects.toThrow(DuplicatePersonNameError);
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

  it('uploads images through a DatoCMS upload request and applies localized metadata', async () => {
    const created: unknown[] = [];
    const requestedUploads: unknown[] = [];
    const putRequests: Array<{ url: string; init?: RequestInit }> = [];
    const gateway = createDatoGateway({
      client: {
        uploads: {
          create: async (payload) => {
            created.push(payload);
            return { id: 'upload-1' };
          },
        },
        uploadRequest: {
          create: async (payload) => {
            requestedUploads.push(payload);
            return {
              id: 'upload-request-1',
              url: 'https://uploads.example.com/signed-put',
              request_headers: { 'x-upload-token': 'token' },
            };
          },
        },
      },
      ctx: {},
      targetLocale: 'en-US',
      fetchImpl: async (url, init) => {
        if (init?.method === 'PUT') {
          putRequests.push({ url: String(url), init });
          return new Response(null, { status: 200 });
        }

        return new Response(new Blob(['image-bytes'], { type: 'image/jpeg' }), {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        });
      },
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

    expect(requestedUploads[0]).toEqual({ filename: 'poster.jpg' });
    expect(putRequests[0]).toMatchObject({
      url: 'https://uploads.example.com/signed-put',
      init: {
        method: 'PUT',
        headers: { 'x-upload-token': 'token', 'content-type': 'image/jpeg' },
      },
    });
    expect(created[0]).toMatchObject({
      path: 'upload-request-1',
      default_field_metadata: {
        alt: {
          'en-US': 'poster from tmdb',
        },
        title: {
          'en-US': '/poster.jpg',
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

  it('reports paths written before a later form value update fails', async () => {
    const gateway = createDatoGateway({
      client: {},
      ctx: {
        setFieldValue: async (fieldPath: string) => {
          if (fieldPath === 'runtime') {
            throw new Error('runtime validation failed');
          }
        },
      },
    });

    await expect(gateway.applyFormValues([
      { fieldPath: 'title', value: 'Example Movie' },
      { fieldPath: 'runtime', value: 125 },
    ])).rejects.toMatchObject({
      message: 'runtime validation failed',
      appliedFields: ['title'],
    });
  });
});
