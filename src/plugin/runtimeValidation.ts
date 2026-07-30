import type { ValidationIssue } from '../domain/movie';
import { validateFieldMappings, type DatoFieldSnapshot, type DatoSchemaSnapshot } from './datoFieldMapping';
import { validatePluginParameters, type PluginParameters } from './parameters';

export class ImportConfigurationError extends Error {
  constructor(readonly issues: ValidationIssue[]) {
    super(
      `Import did not run because the configuration is incomplete: ${issues
        .map((issue) => issue.message)
        .join(' ')}`,
    );
    this.name = 'ImportConfigurationError';
  }
}

export function validateRuntimeConfiguration(
  parameters: PluginParameters,
  schema?: DatoSchemaSnapshot,
): ValidationIssue[] {
  return [
    ...validatePluginParameters(parameters),
    ...(schema ? validateFieldMappings(parameters, schema) : []),
  ];
}

type SchemaContext = {
  itemTypes?: Record<string, unknown>;
  loadItemTypeFields?: (itemTypeId: string) => Promise<unknown[]>;
};

export async function loadSchemaForRuntimeValidation(
  parameters: PluginParameters,
  context: unknown,
): Promise<DatoSchemaSnapshot | undefined> {
  const source = context as SchemaContext;
  if (!source.itemTypes || typeof source.loadItemTypeFields !== 'function') {
    return undefined;
  }

  const models = [parameters.movieModelApiKey, parameters.personModelApiKey]
    .map((apiKey) => modelForApiKey(source.itemTypes!, apiKey));
  if (models.some((model) => !model)) {
    return undefined;
  }

  try {
    const fieldsByModel = await Promise.all(models.map((model) => source.loadItemTypeFields!(model!.id)));
    if (fieldsByModel.some((fields) => !Array.isArray(fields))) {
      return undefined;
    }
    return schemaSnapshotFromLoadedFields(source.itemTypes, fieldsByModel.flat());
  } catch {
    return undefined;
  }
}

function schemaSnapshotFromLoadedFields(
  itemTypes: Record<string, unknown>,
  loadedFields: unknown[],
): DatoSchemaSnapshot | undefined {
  const fields = loadedFields.flatMap((entity) => {
    const record = entityRecord(entity);
    const attributes = entityRecord(record?.attributes);
    const id = typeof record?.id === 'string' ? record.id : null;
    const apiKey = typeof attributes?.api_key === 'string' ? attributes.api_key : null;
    const itemTypeId = record ? itemTypeIdForField(record, attributes) : null;
    const fieldType = typeof attributes?.field_type === 'string' ? attributes.field_type : null;
    if (!id || !apiKey || !itemTypeId || !fieldType) return [];
    return [{ id, itemTypeId, field: { apiKey, fieldType, localized: attributes?.localized === true, validators: validatorsFor(attributes?.validators) } }];
  });

  const models = Object.values(itemTypes).flatMap((entity) => {
    const record = entityRecord(entity);
    const attributes = entityRecord(record?.attributes);
    const id = typeof record?.id === 'string' ? record.id : null;
    const apiKey = typeof attributes?.api_key === 'string' ? attributes.api_key : null;
    if (!id || !apiKey) return [];
    return [[apiKey, {
      id,
      apiKey,
      fields: Object.fromEntries(fields.filter((field) => field.itemTypeId === id).map((field) => [field.field.apiKey, field.field])),
    }] as const];
  });

  return models.length > 0 ? { models: Object.fromEntries(models) } : undefined;
}

function modelForApiKey(itemTypes: Record<string, unknown>, apiKey: string): { id: string } | undefined {
  return Object.values(itemTypes).flatMap((entity) => {
    const record = entityRecord(entity);
    const attributes = entityRecord(record?.attributes);
    return typeof record?.id === 'string' && attributes?.api_key === apiKey ? [{ id: record.id }] : [];
  })[0];
}

function entityRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined;
}

function itemTypeIdForField(record: Record<string, unknown>, attributes: Record<string, unknown> | undefined): string | null {
  if (typeof attributes?.item_type === 'string') {
    return attributes.item_type;
  }

  const topLevelItemType = entityRecord(record.item_type);
  if (typeof topLevelItemType?.id === 'string') {
    return topLevelItemType.id;
  }

  const relationships = entityRecord(record.relationships);
  const relationshipItemType = entityRecord(relationships?.item_type);
  const relationshipData = entityRecord(relationshipItemType?.data);
  return typeof relationshipData?.id === 'string' ? relationshipData.id : null;
}

function validatorsFor(value: unknown): DatoFieldSnapshot['validators'] {
  return entityRecord(value) ?? {};
}
