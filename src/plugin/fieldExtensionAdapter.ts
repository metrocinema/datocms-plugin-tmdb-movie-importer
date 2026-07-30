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
  const reviewedRuntime = await readRuntimeSnapshot(ctx);
  if (reviewedRuntime.issues.length > 0) {
    ctx.alert(
      `Configure the importer before using it: ${reviewedRuntime.issues
        .map((issue) => issue.message)
        .join(' ')}`,
    );
    return;
  }

  const mappedFields = reviewedRuntime.fieldMetadata.map((field) => field.key);
  const currentValues = valuesForMappedFields(
    ctx.formValues,
    reviewedRuntime.targetLocale,
    reviewedRuntime.fieldMetadata,
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
      targetLocale: reviewedRuntime.targetLocale,
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

  if (prepared === null || prepared === undefined) {
    return;
  }

  if (!isPreparedImport(prepared)) {
    ctx.alert(
      'The TMDB import data was invalid. Search for the movie again.',
    );
    return;
  }

  const executionRuntime = await readRuntimeSnapshot(ctx);
  if (executionRuntime.issues.length > 0) {
    ctx.alert(
      `Import did not run because the configuration is incomplete: ${executionRuntime.issues
        .map((issue) => issue.message)
        .join(' ')}`,
    );
    return;
  }

  if (executionRuntime.mappingFingerprint !== reviewedRuntime.mappingFingerprint) {
    ctx.alert(
      'Import did not run because the field mapping or target locale changed while the modal was open. Review the movie again.',
    );
    return;
  }
  reportStatus('applying');

  const result = await dependencies.applyPrepared(
    prepared,
    {
      ...executionRuntime.params,
      targetLocale: executionRuntime.targetLocale,
    },
    dependencies.createGateway(ctx, executionRuntime.targetLocale),
    executorOptionsForMappedFields(executionRuntime.fieldMetadata),
  );
  if (result.status === 'success') {
    ctx.notice('TMDB import applied to the unsaved movie.');
  } else {
    ctx.alert(result.message);
  }
}

async function readRuntimeSnapshot(ctx: FieldExtensionAdapterContext) {
  const params = parsePluginParameters(ctx.plugin.attributes.parameters);
  const schema = await loadSchemaForRuntimeValidation(params, ctx);
  const issues = validateRuntimeConfiguration(params, schema);
  const targetLocale = activeTargetLocale(params, ctx.locale);
  const fieldMetadata = mappedFieldMetadata(params.movieFields, ctx.fields);

  return {
    params,
    issues,
    targetLocale,
    fieldMetadata,
    mappingFingerprint: fieldMappingFingerprint(
      targetLocale,
      fieldMetadata,
    ),
  };
}

function fieldMappingFingerprint(
  targetLocale: string,
  fields: ReturnType<typeof mappedFieldMetadata>,
) {
  return JSON.stringify({
    targetLocale,
    fields: fields
      .map(({ key, apiKey, localized, fieldType }) => ({
        key,
        apiKey,
        localized,
        fieldType,
      }))
      .sort((left, right) => left.key.localeCompare(right.key)),
  });
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
