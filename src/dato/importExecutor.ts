import { DuplicatePersonNameError, FormValuesApplyError, type DatoGateway } from './datoGateway';
import type { ImportPlan } from '../domain/importPlanning';
import type { MovieFieldKey, NormalizedImageCandidate } from '../domain/movie';
import type { PluginParameters } from '../plugin/parameters';
import { assetReference, fieldPathForMovieField, itemReference } from '../plugin/datoFieldMapping';
import { matchPerson, type ExistingPersonRecord } from '../domain/personMatching';
import { mapWithConcurrency } from '../utils/concurrency';

export type ImportResult =
  | { status: 'success'; createdPeople: string[]; uploadedAssets: string[]; appliedFields: string[] }
  | { status: 'dependency_failed'; message: string; createdPeople: string[]; uploadedAssets: string[] }
  | { status: 'form_failed'; message: string; createdPeople: string[]; uploadedAssets: string[]; appliedFields: string[] };

export type ImportExecutorOptions = {
  localizedMovieFields?: Partial<Record<MovieFieldKey, boolean>>;
  movieFieldTypes?: Partial<Record<MovieFieldKey, string>>;
  personModelId?: string;
  onPhaseTiming?: (timing: ImportPhaseTiming) => void;
  now?: () => number;
};

export type ImportPhaseTiming = {
  phase: 'people_lookup' | 'people_create' | 'images' | 'fields' | 'total';
  status: 'success' | 'failed';
  itemCount: number;
  durationMs: number;
};

type UploadedAsset = {
  image: NormalizedImageCandidate;
  id: string;
};

type PersonDraftResult = {
  id: string;
  created: boolean;
};

export async function executeImportPlan(
  plan: ImportPlan,
  params: PluginParameters,
  gateway: DatoGateway,
  options: ImportExecutorOptions = {},
): Promise<ImportResult> {
  const createdPeople: string[] = [];
  const uploadedAssets: string[] = [];
  const uploadedAssetsByImage: UploadedAsset[] = [];
  const completedUploads: Array<UploadedAsset | undefined> = [];
  const personIdsByCandidate = new Map<string, string>();
  const autoPersonIdsByTmdb = new Map<number, string>();
  const now = options.now ?? (() => globalThis.performance.now());
  const totalStartedAt = now();

  for (const person of plan.peopleToReuse) {
    personIdsByCandidate.set(personKey(person), person.recordId);
  }

  const processPeople = async () => {
    const peopleToCreate = plan.peopleToCreate.filter((person) => !personIdsByCandidate.has(personKey(person)));
    const autoPeopleToCreate = peopleToCreate.filter((person) => person.source === 'auto');
    const lookupStartedAt = now();
    let existingPeople: ExistingPersonRecord[];

    try {
      existingPeople = autoPeopleToCreate.length > 0
        ? await gateway.findPeople({
          modelApiKey: params.personModelApiKey,
          nameFieldApiKey: params.personNameFieldApiKey,
          tmdbIdFieldApiKey: params.personTmdbIdFieldApiKey,
          names: autoPeopleToCreate.map((person) => person.name),
          tmdbIds: autoPeopleToCreate.map((person) => person.candidateTmdbId),
        })
        : [];
    } catch (error) {
      reportPhaseTiming(options, now, 'people_lookup', 'failed', autoPeopleToCreate.length, lookupStartedAt);
      throw error;
    }
    reportPhaseTiming(options, now, 'people_lookup', 'success', autoPeopleToCreate.length, lookupStartedAt);

    const creationStartedAt = now();
    let creationCount = 0;
    try {
      for (const person of peopleToCreate) {
        if (person.source === 'auto') {
          const autoPersonId = autoPersonIdsByTmdb.get(person.candidateTmdbId);
          if (autoPersonId) {
            personIdsByCandidate.set(personKey(person), autoPersonId);
            continue;
          }

          const decision = matchPerson(
            { tmdbId: person.candidateTmdbId, name: person.name, order: 0, role: person.candidateRole },
            existingPeople,
            Boolean(params.personTmdbIdFieldApiKey),
          );
          if (decision.type === 'reuse') {
            personIdsByCandidate.set(personKey(person), decision.recordId);
            autoPersonIdsByTmdb.set(person.candidateTmdbId, decision.recordId);
            continue;
          }
        }

        creationCount += 1;
        const record = await createPersonDraftOrReuseDuplicate(person, params, gateway, options);
        if (record.created) {
          createdPeople.push(record.id);
        }
        personIdsByCandidate.set(personKey(person), record.id);
        if (person.source === 'auto') {
          autoPersonIdsByTmdb.set(person.candidateTmdbId, record.id);
        }
      }
    } catch (error) {
      reportPhaseTiming(options, now, 'people_create', 'failed', creationCount, creationStartedAt);
      throw error;
    }
    reportPhaseTiming(options, now, 'people_create', 'success', creationCount, creationStartedAt);
  };

  const processImages = async () => {
    const imagesStartedAt = now();
    try {
      await mapWithConcurrency(
        plan.assetsToUpload,
        5,
        (image) => gateway.uploadImage(image),
        (upload, image, index) => {
          completedUploads[index] = { image, id: upload.id };
        },
      );
    } catch (error) {
      reportPhaseTiming(options, now, 'images', 'failed', plan.assetsToUpload.length, imagesStartedAt);
      throw error;
    } finally {
      for (const asset of completedUploads) {
        if (!asset) continue;
        uploadedAssets.push(asset.id);
        uploadedAssetsByImage.push(asset);
      }
    }
    reportPhaseTiming(options, now, 'images', 'success', plan.assetsToUpload.length, imagesStartedAt);
  };

  const dependencyResults = await Promise.allSettled([processPeople(), processImages()]);
  const dependencyFailure = dependencyResults.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (dependencyFailure) {
    reportPhaseTiming(options, now, 'total', 'failed', plan.peopleToCreate.length + plan.assetsToUpload.length, totalStartedAt);
    return {
      status: 'dependency_failed',
      message: importFailureMessage(dependencyFailure.reason, 'The import could not finish while creating people or uploading images. Some drafts or uploads may already exist in DatoCMS.'),
      createdPeople,
      uploadedAssets,
    };
  }

  const changes = plan.fieldChanges
    .map((change) => {
      const fieldApiKey = params.movieFields[change.key];
      return fieldApiKey ? { fieldPath: movieFieldPath(change.key, fieldApiKey, params, options), value: valueForMovieField(change.key, change.value, options) } : null;
    })
    .filter((change): change is { fieldPath: string; value: unknown } => change !== null);

  const directorField = params.movieFields.directors;
  if (directorField && plan.directors.length > 0) {
    changes.push({
      fieldPath: movieFieldPath('directors', directorField, params, options),
      value: plan.directors.map((person) => personIdsByCandidate.get(personKey(person))).filter((id): id is string => Boolean(id)).map(itemReference),
    });
  }

  const actorField = params.movieFields.actors;
  if (actorField && plan.actors.length > 0) {
    changes.push({
      fieldPath: movieFieldPath('actors', actorField, params, options),
      value: plan.actors.map((person) => personIdsByCandidate.get(personKey(person))).filter((id): id is string => Boolean(id)).map(itemReference),
    });
  }

  const posterField = params.movieFields.poster;
  const poster = uploadedAssetsByImage.find((asset) => asset.image.type === 'poster');
  if (posterField && poster) {
    changes.push({ fieldPath: movieFieldPath('poster', posterField, params, options), value: assetReference(poster.id) });
  }

  const backdropField = params.movieFields.backdrops;
  const backdrops = uploadedAssetsByImage.filter((asset) => asset.image.type === 'backdrop');

  const heroImageField = params.movieFields.heroImage;
  const heroImage = plan.heroImageToUpload
    ? backdrops.find((asset) => plan.heroImageToUpload && sameImage(asset.image, plan.heroImageToUpload))
    : null;
  if (heroImageField && heroImage) {
    changes.push({ fieldPath: movieFieldPath('heroImage', heroImageField, params, options), value: assetReference(heroImage.id) });
  }

  if (backdropField && backdrops.length > 0) {
    const otherImagesToUpload = plan.otherImagesToUpload ?? backdrops.map((asset) => asset.image);
    const otherImages = otherImagesToUpload
      .map((image) => backdrops.find((asset) => sameImage(asset.image, image)))
      .filter((asset): asset is UploadedAsset => Boolean(asset));

    if (otherImages.length > 0) {
      changes.push({
        fieldPath: movieFieldPath('backdrops', backdropField, params, options),
        value: otherImages.map((asset) => assetReference(asset.id)),
      });
    }
  }

  const fieldsStartedAt = now();
  try {
    await gateway.applyFormValues(changes);
  } catch (error) {
    reportPhaseTiming(options, now, 'fields', 'failed', changes.length, fieldsStartedAt);
    reportPhaseTiming(options, now, 'total', 'failed', plan.peopleToCreate.length + plan.assetsToUpload.length + changes.length, totalStartedAt);
    return {
      status: 'form_failed',
      message: importFailureMessage(error, 'The import could not finish while updating the movie form. Created people and uploaded images may already exist in DatoCMS.'),
      createdPeople,
      uploadedAssets,
      appliedFields: error instanceof FormValuesApplyError ? error.appliedFields : [],
    };
  }
  reportPhaseTiming(options, now, 'fields', 'success', changes.length, fieldsStartedAt);
  reportPhaseTiming(options, now, 'total', 'success', plan.peopleToCreate.length + plan.assetsToUpload.length + changes.length, totalStartedAt);

  return {
    status: 'success',
    createdPeople,
    uploadedAssets,
    appliedFields: changes.map((change) => change.fieldPath),
  };
}

function reportPhaseTiming(
  options: ImportExecutorOptions,
  now: () => number,
  phase: ImportPhaseTiming['phase'],
  status: ImportPhaseTiming['status'],
  itemCount: number,
  startedAt: number,
) {
  try {
    options.onPhaseTiming?.({
      phase,
      status,
      itemCount,
      durationMs: Math.max(0, now() - startedAt),
    });
  } catch {
    // Diagnostics must never interrupt an import.
  }
}

async function createPersonDraftOrReuseDuplicate(
  person: ImportPlan['peopleToCreate'][number],
  params: PluginParameters,
  gateway: DatoGateway,
  options: ImportExecutorOptions,
): Promise<PersonDraftResult> {
  try {
    const record = await gateway.createPersonDraft({
      modelApiKey: params.personModelApiKey,
      modelId: options.personModelId,
      nameFieldApiKey: params.personNameFieldApiKey,
      tmdbIdFieldApiKey: params.personTmdbIdFieldApiKey,
      name: person.name,
      tmdbId: person.candidateTmdbId,
    });
    return { id: record.id, created: true };
  } catch (error) {
    if (!(error instanceof DuplicatePersonNameError)) {
      throw error;
    }

    const records = await gateway.findPeople({
      modelApiKey: params.personModelApiKey,
      nameFieldApiKey: params.personNameFieldApiKey,
      tmdbIdFieldApiKey: params.personTmdbIdFieldApiKey,
      names: [person.name],
      tmdbIds: [person.candidateTmdbId],
    });
    const decision = matchPerson(
      { tmdbId: person.candidateTmdbId, name: person.name, order: 0, role: person.candidateRole },
      records,
      Boolean(params.personTmdbIdFieldApiKey),
    );

    if (decision.type === 'reuse') {
      return { id: decision.recordId, created: false };
    }

    throw error;
  }
}

function sameImage(left: NormalizedImageCandidate, right: NormalizedImageCandidate) {
  return left.providerKey === right.providerKey && left.providerImageId === right.providerImageId;
}

function personKey(person: { candidateTmdbId: number; candidateRole: 'director' | 'actor' } | { tmdbId: number; role: 'director' | 'actor' }) {
  const tmdbId = 'candidateTmdbId' in person ? person.candidateTmdbId : person.tmdbId;
  const role = 'candidateRole' in person ? person.candidateRole : person.role;
  return `${role}:${tmdbId}`;
}

function importFailureMessage(error: unknown, prefix: string): string {
  const detail = error instanceof Error ? error.message : null;
  return detail ? `${prefix} ${detail}` : prefix;
}

function movieFieldPath(
  key: MovieFieldKey,
  fieldApiKey: string,
  params: PluginParameters,
  options: ImportExecutorOptions,
): string {
  return fieldPathForMovieField(fieldApiKey, Boolean(options.localizedMovieFields?.[key]), params.targetLocale);
}

function valueForMovieField(key: MovieFieldKey, value: unknown, options: ImportExecutorOptions): unknown {
  if (key === 'description' && options.movieFieldTypes?.description === 'structured_text') {
    return structuredTextEditorValue(String(value));
  }

  return value;
}

function structuredTextEditorValue(value: string): Array<{ type: 'paragraph'; children: Array<{ text: string }> }> {
  return [
    {
      type: 'paragraph',
      children: [{ text: value }],
    },
  ];
}
