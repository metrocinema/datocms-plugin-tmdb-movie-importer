import type { Modal } from 'datocms-plugin-sdk';
import type { PreparedImport } from '../dato/importExecutor';
import { runFieldExtensionImport } from './fieldExtensionAdapter';

const configuredParameters = {
  tmdbReadToken: 'tmdb-token',
  movieModelApiKey: 'movie',
  targetLocale: 'en',
  movieFields: { title: 'title', trailer: 'trailer' },
  personModelApiKey: 'person',
  personNameFieldApiKey: 'name',
  personTmdbIdFieldApiKey: 'tmdb_id',
  actorLimit: 10,
};

const preparedImport: PreparedImport = {
  fieldChanges: [{ key: 'title', value: 'The Example' }],
  directors: [],
  actors: [],
  people: [],
  images: [],
  heroImage: null,
  otherImages: [],
  createdPeople: [],
  uploadedAssets: [],
};

function fieldContext(openModal: (options: Modal) => Promise<unknown>) {
  return {
    plugin: {
      attributes: {
        parameters: {
          ...configuredParameters,
          movieFields: { ...configuredParameters.movieFields },
        },
      },
    },
    formValues: {
      title: { en: 'English title', fr: 'Titre français' },
      tmdb_id: 123,
    },
    fieldPath: 'tmdb_id',
    locale: 'en',
    fields: {
      title: {
        attributes: {
          api_key: 'title',
          localized: true,
          field_type: 'string',
        },
      },
      alternateTitle: {
        attributes: {
          api_key: 'alternate_title',
          localized: true,
          field_type: 'string',
        },
      },
      trailer: {
        attributes: {
          api_key: 'trailer',
          localized: false,
          field_type: 'video',
        },
      },
      alternateTrailer: {
        attributes: {
          api_key: 'alternate_trailer',
          localized: false,
          field_type: 'video',
        },
      },
    },
    openModal,
    notice: vi.fn(),
    alert: vi.fn(),
  };
}

describe('field extension adapter', () => {
  it.each([null, undefined])('treats %s modal results as cancellation', async (modalResult) => {
    const ctx = fieldContext(async () => modalResult);
    const createGateway = vi.fn();
    const applyPrepared = vi.fn();

    await runFieldExtensionImport('find', vi.fn(), ctx, {
      createGateway,
      applyPrepared,
    });

    expect(createGateway).not.toHaveBeenCalled();
    expect(applyPrepared).not.toHaveBeenCalled();
    expect(ctx.notice).not.toHaveBeenCalled();
    expect(ctx.alert).not.toHaveBeenCalled();
  });

  it('alerts without applying an invalid modal result', async () => {
    const ctx = fieldContext(async () => ({ status: 'success' }));
    const createGateway = vi.fn();
    const applyPrepared = vi.fn();

    await runFieldExtensionImport('find', vi.fn(), ctx, {
      createGateway,
      applyPrepared,
    });

    expect(createGateway).not.toHaveBeenCalled();
    expect(applyPrepared).not.toHaveBeenCalled();
    expect(ctx.notice).not.toHaveBeenCalled();
    expect(ctx.alert).toHaveBeenCalledWith(
      'The TMDB import data was invalid. Search for the movie again.',
    );
  });

  it('reports an unexpected modal failure without applying values', async () => {
    const ctx = fieldContext(async () => {
      throw new Error('Dato modal failed to open');
    });
    const applyPrepared = vi.fn();

    await runFieldExtensionImport('find', vi.fn(), ctx, {
      createGateway: vi.fn(),
      applyPrepared,
    });

    expect(applyPrepared).not.toHaveBeenCalled();
    expect(ctx.alert).toHaveBeenCalledWith(
      'The TMDB importer could not finish. No movie values were applied.',
    );
  });

  it('revalidates changed configuration after the modal closes', async () => {
    const ctx = fieldContext(async () => {
      ctx.plugin.attributes.parameters.movieModelApiKey = '';
      return preparedImport;
    });
    const applyPrepared = vi.fn();

    await runFieldExtensionImport('find', vi.fn(), ctx, {
      createGateway: vi.fn(),
      applyPrepared,
    });

    expect(applyPrepared).not.toHaveBeenCalled();
    expect(ctx.alert).toHaveBeenCalledWith(
      'Import did not run because the configuration is incomplete: Movie model is required.',
    );
  });

  it('does not apply if a field mapping changes while the modal is open', async () => {
    const ctx = fieldContext(async () => {
      ctx.plugin.attributes.parameters.movieFields.title = 'alternate_title';
      return preparedImport;
    });
    const applyPrepared = vi.fn();
    const reportStatus = vi.fn();

    await runFieldExtensionImport('find', reportStatus, ctx, {
      createGateway: vi.fn(),
      applyPrepared,
    });

    expect(applyPrepared).not.toHaveBeenCalled();
    expect(reportStatus).not.toHaveBeenCalledWith('applying');
    expect(ctx.alert).toHaveBeenCalledWith(
      'Import did not run because the field mapping or target locale changed while the modal was open. Review the movie again.',
    );
  });

  it('does not apply if the trailer destination changes while the modal is open', async () => {
    const ctx = fieldContext(async () => {
      ctx.plugin.attributes.parameters.movieFields.trailer = 'alternate_trailer';
      return preparedImport;
    });
    const applyPrepared = vi.fn();

    await runFieldExtensionImport('find', vi.fn(), ctx, {
      createGateway: vi.fn(),
      applyPrepared,
    });

    expect(applyPrepared).not.toHaveBeenCalled();
    expect(ctx.alert).toHaveBeenCalledWith(
      'Import did not run because the field mapping or target locale changed while the modal was open. Review the movie again.',
    );
  });

  it.each([
    {
      name: 'localization',
      changeField: (ctx: ReturnType<typeof fieldContext>) => {
        ctx.fields.title.attributes.localized = false;
      },
    },
    {
      name: 'field type',
      changeField: (ctx: ReturnType<typeof fieldContext>) => {
        ctx.fields.title.attributes.field_type = 'text';
      },
    },
  ])('does not apply if mapped field $name changes while the modal is open', async ({ changeField }) => {
    const ctx = fieldContext(async () => {
      changeField(ctx);
      return preparedImport;
    });
    const applyPrepared = vi.fn();

    await runFieldExtensionImport('find', vi.fn(), ctx, {
      createGateway: vi.fn(),
      applyPrepared,
    });

    expect(applyPrepared).not.toHaveBeenCalled();
    expect(ctx.alert).toHaveBeenCalledWith(
      'Import did not run because the field mapping or target locale changed while the modal was open. Review the movie again.',
    );
  });

  it('does not apply if the target locale changes while the modal is open', async () => {
    const openModal = vi.fn(async () => {
      ctx.locale = 'fr';
      return preparedImport;
    });
    const ctx = fieldContext(openModal);
    const applyPrepared = vi.fn();
    const reportStatus = vi.fn();

    await runFieldExtensionImport('refresh', reportStatus, ctx, {
      createGateway: vi.fn(),
      applyPrepared,
    });

    expect(applyPrepared).not.toHaveBeenCalled();
    expect(reportStatus).not.toHaveBeenCalledWith('applying');
    expect(ctx.alert).toHaveBeenCalledWith(
      'Import did not run because the field mapping or target locale changed while the modal was open. Review the movie again.',
    );
  });

  it('applies with the reviewed mapping and reports success', async () => {
    const openModal = vi.fn(async () => preparedImport);
    const ctx = fieldContext(openModal);
    const gateway = {};
    const createGateway = vi.fn(() => gateway);
    const applyPrepared = vi.fn(async () => ({
      status: 'success' as const,
      createdPeople: [],
      uploadedAssets: [],
      appliedFields: ['title.fr'],
    }));
    const reportStatus = vi.fn();

    await runFieldExtensionImport('refresh', reportStatus, ctx, {
      createGateway,
      applyPrepared,
    });

    expect(openModal).toHaveBeenCalledWith(expect.objectContaining({
      parameters: expect.objectContaining({
        targetLocale: 'en',
        currentValues: { title: 'English title' },
      }),
    }));
    expect(createGateway).toHaveBeenCalledWith(ctx, 'en');
    expect(applyPrepared).toHaveBeenCalledWith(
      preparedImport,
      expect.objectContaining({ targetLocale: 'en' }),
      gateway,
      {
        localizedMovieFields: { title: true, trailer: false },
        movieFieldTypes: { title: 'string', trailer: 'video' },
      },
    );
    expect(reportStatus).toHaveBeenCalledWith('applying');
    expect(ctx.notice).toHaveBeenCalledWith(
      'TMDB import applied to the unsaved movie.',
    );
    expect(ctx.alert).not.toHaveBeenCalled();
  });

  it('reports an application failure as an alert', async () => {
    const ctx = fieldContext(async () => preparedImport);
    const applyPrepared = vi.fn(async () => ({
      status: 'form_failed' as const,
      message: 'The movie form could not be updated.',
      createdPeople: [],
      uploadedAssets: [],
      appliedFields: [],
    }));

    await runFieldExtensionImport('find', vi.fn(), ctx, {
      createGateway: vi.fn(() => ({})),
      applyPrepared,
    });

    expect(ctx.alert).toHaveBeenCalledWith(
      'The movie form could not be updated.',
    );
    expect(ctx.notice).not.toHaveBeenCalled();
  });
});
