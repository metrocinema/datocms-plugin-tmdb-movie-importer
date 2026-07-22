import type { DatoGateway } from './datoGateway';
import type { ImportPlan } from '../domain/importPlanning';
import type { PluginParameters } from '../plugin/parameters';
import { assetReference, itemReference } from '../plugin/datoFieldMapping';

export type ImportResult =
  | { status: 'success'; createdPeople: string[]; uploadedAssets: string[]; appliedFields: string[] }
  | { status: 'dependency_failed'; message: string; createdPeople: string[]; uploadedAssets: string[] }
  | { status: 'form_failed'; message: string; createdPeople: string[]; uploadedAssets: string[]; appliedFields: string[] };

export async function executeImportPlan(plan: ImportPlan, params: PluginParameters, gateway: DatoGateway): Promise<ImportResult> {
  const createdPeople: string[] = [];
  const uploadedAssets: string[] = [];
  const personIdsByTmdb = new Map<number, string>();

  try {
    for (const person of plan.peopleToReuse) {
      personIdsByTmdb.set(person.candidateTmdbId, person.recordId);
    }

    for (const person of plan.peopleToCreate) {
      const record = await gateway.createPersonDraft({
        modelApiKey: params.personModelApiKey,
        nameFieldApiKey: params.personNameFieldApiKey,
        tmdbIdFieldApiKey: params.personTmdbIdFieldApiKey,
        name: person.name,
        tmdbId: person.candidateTmdbId,
      });
      createdPeople.push(record.id);
      personIdsByTmdb.set(person.candidateTmdbId, record.id);
    }

    for (const image of plan.assetsToUpload) {
      const upload = await gateway.uploadImage(image);
      uploadedAssets.push(upload.id);
    }
  } catch (error) {
    return {
      status: 'dependency_failed',
      message: error instanceof Error ? error.message : 'Dependency write failed.',
      createdPeople,
      uploadedAssets,
    };
  }

  const changes = plan.fieldChanges
    .map((change) => {
      const fieldApiKey = params.movieFields[change.key];
      return fieldApiKey ? { fieldPath: fieldApiKey, value: change.value } : null;
    })
    .filter((change): change is { fieldPath: string; value: unknown } => change !== null);

  const directorField = params.movieFields.directors;
  if (directorField) {
    changes.push({
      fieldPath: directorField,
      value: plan.directors.map((person) => personIdsByTmdb.get(person.tmdbId)).filter((id): id is string => Boolean(id)).map(itemReference),
    });
  }

  const posterField = params.movieFields.poster;
  if (posterField && uploadedAssets[0]) {
    changes.push({ fieldPath: posterField, value: assetReference(uploadedAssets[0]) });
  }

  try {
    await gateway.applyFormValues(changes);
  } catch (error) {
    return {
      status: 'form_failed',
      message: error instanceof Error ? error.message : 'Form update failed.',
      createdPeople,
      uploadedAssets,
      appliedFields: [],
    };
  }

  return {
    status: 'success',
    createdPeople,
    uploadedAssets,
    appliedFields: changes.map((change) => change.fieldPath),
  };
}
