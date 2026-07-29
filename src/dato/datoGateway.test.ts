import { createDatoGateway, DuplicatePersonNameError, type UploadStageTiming } from './datoGateway';

describe('DatoGateway', () => {
  it('looks up at most three Person TMDB IDs at a time', async () => {
    const started: number[] = [];
    const pending = new Map<number, (records: Array<Record<string, unknown>>) => void>();
    const gateway = createDatoGateway({
      client: {
        items: {
          list: async (params) => {
            const fields = (params as { filter?: { fields?: { tmdb_id?: { eq?: number } } } }).filter?.fields;
            const tmdbId = fields?.tmdb_id?.eq;
            if (tmdbId === undefined) {
              return [];
            }

            started.push(tmdbId);
            return new Promise((resolve) => pending.set(tmdbId, resolve));
          },
        },
      },
      ctx: {},
    });
    const lookup = gateway.findPeople({
      modelApiKey: 'person',
      nameFieldApiKey: 'name',
      tmdbIdFieldApiKey: 'tmdb_id',
      names: ['Person 1', 'Person 2', 'Person 3', 'Person 4'],
      tmdbIds: [1, 2, 3, 4],
    });

    await vi.waitFor(() => expect(started).toEqual([1, 2, 3]));
    expect(started).not.toContain(4);

    pending.get(1)?.([{ id: 'person-1', name: 'Person 1', tmdb_id: 1 }]);
    await vi.waitFor(() => expect(started).toContain(4));
    pending.get(2)?.([{ id: 'person-2', name: 'Person 2', tmdb_id: 2 }]);
    pending.get(3)?.([{ id: 'person-3', name: 'Person 3', tmdb_id: 3 }]);
    pending.get(4)?.([{ id: 'person-4', name: 'Person 4', tmdb_id: 4 }]);

    await expect(lookup).resolves.toHaveLength(4);
  });

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
        'en-US': {
          alt: 'poster from tmdb',
          title: '/poster.jpg',
        },
      },
    });
  });

  it('reports safe timing for each image upload stage', async () => {
    const timings: UploadStageTiming[] = [];
    const gateway = createDatoGateway({
      client: {
        uploads: {
          create: async () => ({ id: 'upload-1' }),
        },
        uploadRequest: {
          create: async () => ({
            id: 'upload-request-1',
            url: 'https://uploads.example.com/signed-put',
            request_headers: {},
          }),
        },
      },
      ctx: {},
      fetchImpl: async (_url, init) => {
        return init?.method === 'PUT'
          ? new Response(null, { status: 200 })
          : new Response(new Uint8Array([1, 2, 3]), {
            status: 200,
            headers: { 'content-type': 'image/jpeg' },
          });
      },
      onUploadStageTiming: (timing) => timings.push(timing),
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

    expect(timings.map(({ uploadNumber, imageType, stage, status, byteSize }) => ({
      uploadNumber,
      imageType,
      stage,
      status,
      byteSize,
    }))).toEqual([
      { uploadNumber: 1, imageType: 'poster', stage: 'download', status: 'success', byteSize: 3 },
      { uploadNumber: 1, imageType: 'poster', stage: 'upload_request', status: 'success', byteSize: 3 },
      { uploadNumber: 1, imageType: 'poster', stage: 'transfer', status: 'success', byteSize: 3 },
      { uploadNumber: 1, imageType: 'poster', stage: 'asset_processing', status: 'success', byteSize: 3 },
      { uploadNumber: 1, imageType: 'poster', stage: 'total', status: 'success', byteSize: 3 },
    ]);
    expect(timings.every(({ durationMs }) => typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs >= 0)).toBe(true);
  });

  it('does not fail an upload when the timing observer throws', async () => {
    const gateway = createDatoGateway({
      client: {
        uploads: {
          create: async () => ({ id: 'upload-1' }),
        },
        uploadRequest: {
          create: async () => ({
            id: 'upload-request-1',
            url: 'https://uploads.example.com/signed-put',
            request_headers: {},
          }),
        },
      },
      ctx: {},
      fetchImpl: async (_url, init) => {
        return init?.method === 'PUT'
          ? new Response(null, { status: 200 })
          : new Response(new Uint8Array([1, 2, 3]), { status: 200 });
      },
      onUploadStageTiming() {
        throw new Error('observer failed');
      },
    });

    await expect(gateway.uploadImage({
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
    })).resolves.toEqual({ id: 'upload-1' });
  });

  it('reports the failed upload stage and total without continuing asset processing', async () => {
    const timings: UploadStageTiming[] = [];
    const gateway = createDatoGateway({
      client: {
        uploads: {
          create: async () => {
            throw new Error('asset processing must not run');
          },
        },
        uploadRequest: {
          create: async () => ({
            id: 'upload-request-1',
            url: 'https://uploads.example.com/signed-put',
            request_headers: {},
          }),
        },
      },
      ctx: {},
      fetchImpl: async (_url, init) => {
        return init?.method === 'PUT'
          ? new Response(null, { status: 500 })
          : new Response(new Uint8Array([1, 2, 3]), { status: 200 });
      },
      onUploadStageTiming: (timing) => timings.push(timing),
    });
    const upload = gateway.uploadImage({
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

    await expect(upload).rejects.toThrow('DatoCMS upload request failed: 500');
    expect(timings.map(({ stage, status }) => ({ stage, status }))).toEqual([
      { stage: 'download', status: 'success' },
      { stage: 'upload_request', status: 'success' },
      { stage: 'transfer', status: 'failed' },
      { stage: 'total', status: 'failed' },
    ]);
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
