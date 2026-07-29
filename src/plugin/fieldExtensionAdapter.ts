import type { Modal } from 'datocms-plugin-sdk';
import type {
  ImportExecutorOptions,
  ImportResult,
  PreparedImport,
} from '../dato/importExecutor';
import type { PluginParameters } from './parameters';
import { activeTargetLocale, parsePluginParameters } from './parameters';
import {
  executorOptionsForMappedFields,
  mappedFieldMetadata,
  valuesForMappedFields,
} from './mappedFields';
import { isPreparedImport } from './modalRuntime';
import {
  loadSchemaForRuntimeValidation,
  validateRuntimeConfiguration,
} from './runtimeValidation';

type FieldAddonMode = 'find' | 'refresh';
type FieldAddonStatusReporter = (status: 'opening' | 'applying') => void;

export type FieldExtensionAdapterContext = {
  plugin: { attributes: { parameters: unknown } };
  formValues: Record<string, unknown>;
  locale: string;
  fields: Parameters<typeof mappedFieldMetadata>[1];
  openModal: (modal: Modal) => Promise<unknown>;
  alert: (message: string) => void | Promise<void>;
  notice: (message: string) => void | Promise<void>;
};

type FieldExtensionAdapterDependencies<TGateway> = {
  createGateway: (
    ctx: FieldExtensionAdapterContext,
    targetLocale: string,
  ) => TGateway;
  applyPrepared: (
    prepared: PreparedImport,
    params: PluginParameters,
    gateway: TGateway,
    options: ImportExecutorOptions,
  ) => Promise<ImportResult>;
};

export async function runFieldExtensionImport<TGateway>(
  mode: FieldAddonMode,
  reportStatus: FieldAddonStatusReporter,
  ctx: FieldExtensionAdapterContext,
  dependencies: FieldExtensionAdapterDependencies<TGateway>,
): Promise<void> {
  try {
    await runFieldExtensionImportUnchecked(
      mode,
      reportStatus,
      ctx,
      dependencies,
    );
  } catch {
    await ctx.alert(
      'The TMDB importer could not finish. No movie values were applied.',
    );
  }
}

async function runFieldExtensionImportUnchecked<TGateway>(
  mode: FieldAddonMode,
  reportStatus: FieldAddonStatusReporter,
  ctx: FieldExtensionAdapterContext,
  dependencies: FieldExtensionAdapterDependencies<TGateway>,
): Promise<void> {
  const params = parsePluginParameters(ctx.plugin.attributes.parameters);
  const schema = await loadSchemaForRuntimeValidation(params, ctx);
  const currentIssues = validateRuntimeConfiguration(params, schema);
  if (currentIssues.length > 0) {
    ctx.alert(
      `Configure the importer before using it: ${currentIssues
        .map((issue) => issue.message)
        .join(' ')}`,
    );
    return;
  }

  const targetLocale = activeTargetLocale(params, ctx.locale);
  const fieldMetadata = mappedFieldMetadata(params.movieFields, ctx.fields);
  const mappedFields = fieldMetadata.map((field) => field.key);
  const currentValues = valuesForMappedFields(
    ctx.formValues,
    targetLocale,
    fieldMetadata,
  );
  const prepared = await ctx.openModal({
    id: 'tmdbMovieImport',
    title: mode === 'refresh' ? 'Refresh from TMDB' : 'Find movie',
    width: 'fullWidth',
    initialHeight: 860,
    parameters: {
      mode,
      currentValues,
      mappedFields,
      targetLocale,
      initialTitle:
        typeof currentValues.title === 'string' ? currentValues.title : '',
      initialYear:
        typeof currentValues.yearReleased === 'number'
          ? currentValues.yearReleased
          : null,
      initialTmdbId:
        mode === 'refresh' ? validTmdbId(currentValues.tmdbId) : null,
    },
  });

  if (!isPreparedImport(prepared)) {
    return;
  }

  const latestParams = parsePluginParameters(
    ctx.plugin.attributes.parameters,
  );
  const latestSchema = await loadSchemaForRuntimeValidation(latestParams, ctx);
  const executionIssues = validateRuntimeConfiguration(
    latestParams,
    latestSchema,
  );
  if (executionIssues.length > 0) {
    ctx.alert(
      `Import did not run because the configuration is incomplete: ${executionIssues
        .map((issue) => issue.message)
        .join(' ')}`,
    );
    return;
  }

  const executionLocale = activeTargetLocale(latestParams, ctx.locale);
  const latestFieldMetadata = mappedFieldMetadata(
    latestParams.movieFields,
    ctx.fields,
  );
  reportStatus('applying');

  const result = await dependencies.applyPrepared(
    prepared,
    { ...latestParams, targetLocale: executionLocale },
    dependencies.createGateway(ctx, executionLocale),
    executorOptionsForMappedFields(latestFieldMetadata),
  );
  if (result.status === 'success') {
    ctx.notice('TMDB import applied to the unsaved movie.');
  } else {
    ctx.alert(result.message);
  }
}

function validTmdbId(value: unknown): number | null {
  const id =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
