import React from 'react';
import ReactDOM from 'react-dom/client';
import { buildClient } from '@datocms/cma-client';
import { connect } from 'datocms-plugin-sdk';
import { Canvas } from 'datocms-react-ui';
import 'datocms-react-ui/styles.css';
import { App, type PluginScreen } from './App';
import { executeImportPlan } from './dato/importExecutor';
import { createDatoGateway, type GatewayClient } from './dato/datoGateway';
import type { CurrentMovieValues } from './domain/fieldComparison';
import type { ImportPlan } from './domain/importPlanning';
import type { MovieFieldKey } from './domain/movie';
import { parsePluginParameters } from './plugin/parameters';
import { loadSchemaForRuntimeValidation, validateRuntimeConfiguration } from './plugin/runtimeValidation';
import { executorOptionsForMappedFields, mappedFieldMetadata, valuesForMappedFields } from './plugin/mappedFields';
import { TmdbClient } from './providers/tmdbClient';
import { normalizeTmdbMovie } from './providers/tmdbNormalizer';

function render(screen: PluginScreen, ctx: unknown) {
  const root = ReactDOM.createRoot(document.getElementById('root')!);
  root.render(
    <React.StrictMode>
      <Canvas ctx={ctx as never}>
        <App screen={screen} />
      </Canvas>
    </React.StrictMode>,
  );
}

connect({
  renderConfigScreen(ctx) {
    render(
      {
        type: 'config',
        parameters: ctx.plugin.attributes.parameters,
        onSave: async (params) => {
          await ctx.updatePluginParameters(params as Record<string, unknown>);
          ctx.notice('Configuration saved');
        },
      },
      ctx,
    );
  },
  renderFieldExtension(_fieldExtensionId, ctx) {
    const params = parsePluginParameters(ctx.plugin.attributes.parameters);
    const configurationIssues = validateRuntimeConfiguration(params);
    render(
      {
        type: 'fieldAddon',
        tmdbId: ctx.formValues[ctx.fieldPath] as number | string | null,
        configurationIssues,
        onOpen: async (mode) => {
          const params = parsePluginParameters(ctx.plugin.attributes.parameters);
          const schema = await loadSchemaForRuntimeValidation(params, ctx);
          const currentIssues = validateRuntimeConfiguration(params, schema);
          if (currentIssues.length > 0) {
            ctx.alert(`Configure the importer before using it: ${currentIssues.map((issue) => issue.message).join(' ')}`);
            return;
          }
          const fieldMetadata = mappedFieldMetadata(params.movieFields, ctx.fields);
          const mappedFields = fieldMetadata.map((field) => field.key);
          const currentValues = valuesForMappedFields(ctx.formValues, params.targetLocale, fieldMetadata);
          const plan = await ctx.openModal({
            id: 'tmdbMovieImport',
            title: mode === 'refresh' ? 'Refresh from TMDB' : 'Find movie',
            width: 'l',
            parameters: {
              mode,
              currentValues,
              mappedFields,
              initialTitle: typeof currentValues.title === 'string' ? currentValues.title : '',
              initialYear: typeof currentValues.yearReleased === 'number' ? currentValues.yearReleased : null,
              initialTmdbId: mode === 'refresh' ? validTmdbId(currentValues.tmdbId) : null,
            },
          });

          if (!isImportPlan(plan)) {
            return;
          }

          const latestParams = parsePluginParameters(ctx.plugin.attributes.parameters);
          const latestSchema = await loadSchemaForRuntimeValidation(latestParams, ctx);
          const executionIssues = validateRuntimeConfiguration(latestParams, latestSchema);
          if (executionIssues.length > 0) {
            ctx.alert(`Import did not run because the configuration is incomplete: ${executionIssues.map((issue) => issue.message).join(' ')}`);
            return;
          }

          const result = await executeImportPlan(plan, latestParams, gatewayFor(ctx, latestParams.targetLocale), executorOptionsForMappedFields(fieldMetadata));
          if (result.status === 'success') {
            ctx.notice('TMDB import applied to the unsaved movie.');
          } else {
            ctx.alert(result.message);
          }
        },
      },
      ctx,
    );
  },
  renderModal(_modalId, ctx) {
    const params = parsePluginParameters(ctx.plugin.attributes.parameters);
    const configurationIssues = validateRuntimeConfiguration(params);
    const mappedFields = modalMappedFields(ctx.parameters.mappedFields);
    const currentValues = modalCurrentValues(ctx.parameters.currentValues);
    const tmdb = new TmdbClient({ readToken: params.tmdbReadToken });
    const gateway = gatewayFor(ctx, params.targetLocale);

    render({
      type: 'modal',
      configurationIssues,
      initialTitle: typeof ctx.parameters.initialTitle === 'string' ? ctx.parameters.initialTitle : '',
      initialYear: typeof ctx.parameters.initialYear === 'number' ? ctx.parameters.initialYear : null,
      initialTmdbId: typeof ctx.parameters.initialTmdbId === 'number' ? ctx.parameters.initialTmdbId : null,
      currentValues,
      mappedFields,
      searchMovies: (query) => tmdb.searchMovies(query),
      loadMovie: async (tmdbId) => normalizeTmdbMovie(await tmdb.getMoviePackage(tmdbId), params.actorLimit),
      tmdbIdFieldConfigured: Boolean(params.personTmdbIdFieldApiKey),
      resolvePeople: (people) => gateway.findPeople({
        modelApiKey: params.personModelApiKey,
        nameFieldApiKey: params.personNameFieldApiKey,
        tmdbIdFieldApiKey: params.personTmdbIdFieldApiKey,
        names: people.map((person) => person.name),
        tmdbIds: people.map((person) => person.tmdbId),
      }),
      execute: async (plan) => ctx.resolve(plan),
    }, ctx);
  },
});

function gatewayFor(ctx: { currentUserAccessToken?: string; cmaBaseUrl: string; environment: string; setFieldValue?: (path: string, value: unknown) => Promise<void> }, targetLocale: 'en') {
  const client = buildClient({
    apiToken: ctx.currentUserAccessToken ?? null,
    baseUrl: ctx.cmaBaseUrl,
    environment: ctx.environment,
  });

  return createDatoGateway({
    client: {
      items: {
        create: async (payload) => client.items.create(payload as never),
        list: async (query) => client.items.list(query as never) as Promise<Array<Record<string, unknown>>>,
      },
      uploads: {
        createFromUrl: async ({ url, default_field_metadata }) => client.uploads.create({ path: url, default_field_metadata: default_field_metadata as never }),
      },
    } satisfies GatewayClient,
    ctx,
    targetLocale,
  });
}

function modalMappedFields(value: unknown): MovieFieldKey[] {
  const knownKeys: MovieFieldKey[] = ['title', 'yearReleased', 'mpaaRating', 'runtime', 'tmdbId', 'tagline', 'description', 'poster', 'backdrops', 'directors', 'actors'];
  return Array.isArray(value) ? value.filter((key): key is MovieFieldKey => typeof key === 'string' && knownKeys.includes(key as MovieFieldKey)) : [];
}

function modalCurrentValues(value: unknown): CurrentMovieValues {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as CurrentMovieValues : {};
}

function isImportPlan(value: unknown): value is ImportPlan {
  return typeof value === 'object' && value !== null && ['fieldChanges', 'directors', 'actors', 'peopleToCreate', 'peopleToReuse', 'assetsToUpload'].every((key) => Array.isArray((value as Record<string, unknown>)[key]));
}

function validTmdbId(value: unknown): number | null {
  const id = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
