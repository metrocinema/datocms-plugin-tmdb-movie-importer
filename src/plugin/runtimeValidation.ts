import type { ValidationIssue } from '../domain/movie';
import { validateFieldMappings, type DatoFieldSnapshot, type DatoSchemaSnapshot } from './datoFieldMapping';
import { validatePluginParameters, type PluginParameters } from './parameters';

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
  fields?: Record<string, unknown>;
};

export function schemaSnapshotFromPluginContext(context: unknown): DatoSchemaSnapshot | undefined {
  const source = context as SchemaContext;
  if (!source.itemTypes || !source.fields) {
    return undefined;
  }

  const fields = Object.values(source.fields).flatMap((entity) => {
    const record = entityRecord(entity);
    const attributes = entityRecord(record?.attributes);
    const id = typeof record?.id === 'string' ? record.id : null;
    const apiKey = typeof attributes?.api_key === 'string' ? attributes.api_key : null;
    const itemTypeId = typeof attributes?.item_type === 'string' ? attributes.item_type : null;
    const fieldType = typeof attributes?.field_type === 'string' ? attributes.field_type : null;
    if (!id || !apiKey || !itemTypeId || !fieldType) return [];
    return [{ id, itemTypeId, field: { apiKey, fieldType, localized: attributes?.localized === true, validators: validatorsFor(attributes?.validators) } }];
  });

  const models = Object.values(source.itemTypes).flatMap((entity) => {
    const record = entityRecord(entity);
    const attributes = entityRecord(record?.attributes);
    const id = typeof record?.id === 'string' ? record.id : null;
    const apiKey = typeof attributes?.api_key === 'string' ? attributes.api_key : null;
    if (!id || !apiKey) return [];
    return [[apiKey, {
      apiKey,
      fields: Object.fromEntries(fields.filter((field) => field.itemTypeId === id).map((field) => [field.field.apiKey, field.field])),
    }] as const];
  });

  return models.length > 0 ? { models: Object.fromEntries(models) } : undefined;
}

function entityRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined;
}

function validatorsFor(value: unknown): DatoFieldSnapshot['validators'] {
  return entityRecord(value) ?? {};
}
