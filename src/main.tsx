import React from 'react';
import { buildClient } from '@datocms/cma-client';
import { connect } from 'datocms-plugin-sdk';
import { Canvas } from 'datocms-react-ui';
import 'datocms-react-ui/styles.css';
import { App, type PluginScreen } from './App';
import { applyPreparedImport, prepareImport } from './dato/importExecutor';
import { createDatoGateway, type GatewayClient, type UploadStageTiming } from './dato/datoGateway';
import { activeTargetLocale, parsePluginParameters } from './plugin/parameters';
import { manualFieldExtensions } from './plugin/fieldExtensions';
import { modalCurrentValues, modalInitialTitle, modalInitialTmdbId, modalInitialYear, modalMappedFields } from './plugin/modalRuntime';
import { ImportConfigurationError, loadSchemaForRuntimeValidation, validateRuntimeConfiguration } from './plugin/runtimeValidation';
import { runFieldExtensionImport } from './plugin/fieldExtensionAdapter';
import { TmdbClient } from './providers/tmdbClient';
import { normalizeTmdbMovie } from './providers/tmdbNormalizer';
import { isDevHarnessRequest, renderDevHarness } from './devHarness';
import { renderIntoRoot } from './reactRoot';

type ErrorBoundaryState = {
  error: Error | null;
};

class PluginErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('MCS Movie Importer render failed', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" style={{ color: 'var(--color--danger-soft--ink, var(--color--ink))', fontFamily: 'sans-serif', padding: 16 }}>
          <h2>MCS Movie Importer failed to render</h2>
          <p>{this.state.error.message}</p>
          <p>Open the browser console for the full stack trace.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

function render(screen: PluginScreen, ctx: unknown) {
  renderIntoRoot(
    document.getElementById('root')!,
    <React.StrictMode>
      <PluginErrorBoundary>
        <Canvas ctx={ctx as never} noAutoResizer={screen.type === 'modal'}>
          <App screen={screen} />
        </Canvas>
      </PluginErrorBoundary>
    </React.StrictMode>,
  );
}

if (isDevHarnessRequest()) {
  renderDevHarness();
} else {
connect({
  manualFieldExtensions,
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
        onOpen: (mode, reportStatus) =>
          runFieldExtensionImport(mode, reportStatus, ctx, {
            createGateway: (_gatewayContext, targetLocale) =>
              gatewayFor(ctx, targetLocale),
            applyPrepared: applyPreparedImport,
          }),
      },
      ctx,
    );
  },
  renderModal(_modalId, ctx) {
    const params = parsePluginParameters(ctx.plugin.attributes.parameters);
    const configurationIssues = validateRuntimeConfiguration(params);
    const mappedFields = modalMappedFields(ctx.parameters);
    const currentValues = modalCurrentValues(ctx.parameters);
    const tmdb = new TmdbClient({ readToken: params.tmdbReadToken });

    render({
      type: 'modal',
      configurationIssues,
      initialTitle: modalInitialTitle(ctx.parameters),
      initialYear: modalInitialYear(ctx.parameters),
      initialTmdbId: modalInitialTmdbId(ctx.parameters),
      currentValues,
      mappedFields,
      searchMovies: (query) => tmdb.searchMovies(query),
      loadMovie: async (tmdbId) => normalizeTmdbMovie(await tmdb.getMoviePackage(tmdbId), params.actorLimit),
      tmdbIdFieldConfigured: Boolean(params.personTmdbIdFieldApiKey),
      resolvePeople: (people) => {
        const gateway = gatewayFor(ctx, params.targetLocale);

        return gateway.findPeople({
          modelApiKey: params.personModelApiKey,
          nameFieldApiKey: params.personNameFieldApiKey,
          tmdbIdFieldApiKey: params.personTmdbIdFieldApiKey,
          names: people.map((person) => person.name),
          tmdbIds: people.map((person) => person.tmdbId),
        });
      },
      prepare: async (plan, onProgress) => {
        const latestParams = parsePluginParameters(ctx.plugin.attributes.parameters);
        const latestSchema = await loadSchemaForRuntimeValidation(latestParams, ctx);
        const preparationIssues = validateRuntimeConfiguration(latestParams, latestSchema);
        if (preparationIssues.length > 0) {
          throw new ImportConfigurationError(preparationIssues);
        }

        const preparationLocale = activeTargetLocale(latestParams, ctx.parameters.targetLocale);
        return prepareImport(
          plan,
          { ...latestParams, targetLocale: preparationLocale },
          gatewayFor(
            {
              currentUserAccessToken: ctx.currentUserAccessToken,
              cmaBaseUrl: ctx.cmaBaseUrl,
              environment: ctx.environment,
            },
            preparationLocale,
            (timing) => console.info('MCS Movie Importer upload performance', timing),
          ),
          {
            personModelId: latestSchema?.models[latestParams.personModelApiKey]?.id,
            onProgress,
            onPhaseTiming: (timing) => console.info('MCS Movie Importer performance', timing),
          },
        );
      },
      resolve: (prepared) => ctx.resolve(prepared),
    }, ctx);
  },
});
}

function gatewayFor(
  ctx: { currentUserAccessToken?: string; cmaBaseUrl: string; environment: string; setFieldValue?: (path: string, value: unknown) => Promise<void> },
  targetLocale: string,
  onUploadStageTiming?: (timing: UploadStageTiming) => void,
) {
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
        listPagedIterator: (query, options) => client.items.listPagedIterator(query as never, options) as AsyncIterable<Record<string, unknown>>,
      },
      uploads: {
        create: async ({ path, default_field_metadata }) => client.uploads.create({ path, default_field_metadata: default_field_metadata as never }),
      },
      uploadRequest: {
        create: async (payload) => client.uploadRequest.create(payload as never),
      },
    } satisfies GatewayClient,
    ctx,
    targetLocale,
    onUploadStageTiming,
  });
}
