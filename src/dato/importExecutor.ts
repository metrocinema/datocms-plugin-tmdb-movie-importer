import { DuplicatePersonNameError, FormValuesApplyError, type DatoGateway } from './datoGateway';
import type { ImportPlan } from '../domain/importPlanning';
import type { MovieFieldKey, NormalizedImageCandidate } from '../domain/movie';
import type { PluginParameters } from '../plugin/parameters';
import { assetReference, fieldPathForMovieField, itemReference } from '../plugin/datoFieldMapping';
import { matchPerson, type ExistingPersonRecord } from '../domain/personMatching';
import { mapWithConcurrency } from '../utils/concurrency';

export type ImportResult =
  | { status: 'success'; createdPeople: string[]; uploadedAssets: string[]; appliedFields: string[] }
  | { status: 'dependency_failed'; failedPhase: DependencyFailurePhase; message: string; createdPeople: string[]; uploadedAssets: string[] }
  | { status: 'form_failed'; message: string; createdPeople: string[]; uploadedAssets: string[]; appliedFields: string[] };

export type ImportExecutorOptions = {
  localizedMovieFields?: Partial<Record<MovieFieldKey, boolean>>;
  movieFieldTypes?: Partial<Record<MovieFieldKey, string>>;
  personModelId?: string;
  onPhaseTiming?: (timing: ImportPhaseTiming) => void;
  onProgress?: (event: ImportProgressEvent) => void;
  now?: () => number;
};

export type ImportPhaseTiming = {
  phase: 'people_lookup' | 'people_create' | 'images' | 'fields' | 'total';
  status: 'success' | 'failed';
  itemCount: number;
  durationMs: number;
};

export type ImportProgressPhase =
  | 'people_lookup'
  | 'people_create'
  | 'images'
  | 'fields_prepare';

export type ImportProgressEvent = {
  phase: ImportProgressPhase;
  state: 'waiting' | 'active' | 'complete' | 'failed';
  completed: number;
  total: number;
  message?: string;
};

export type DependencyFailurePhase = Extract<ImportProgressPhase, 'people_lookup' | 'people_create' | 'images'>;

export type PreparedImageReference = {
  providerKey: string;
  providerImageId: string;
  type: NormalizedImageCandidate['type'];
  uploadId: string;
};

export type PreparedPersonReference = {
  candidateTmdbId: number;
  candidateRole: 'director' | 'actor';
  recordId: string;
};

export type PreparedImport = {
  fieldChanges: ImportPlan['fieldChanges'];
  directors: ImportPlan['directors'];
  actors: ImportPlan['actors'];
  people: PreparedPersonReference[];
  images: PreparedImageReference[];
  heroImage: Pick<NormalizedImageCandidate, 'providerKey' | 'providerImageId'> | null;
  otherImages: Array<Pick<NormalizedImageCandidate, 'providerKey' | 'providerImageId'>>;
  createdPeople: string[];
  uploadedAssets: string[];
};

export type PrepareImportResult =
  | { status: 'success'; prepared: PreparedImport }
  | {
      status: 'dependency_failed';
      failedPhase: DependencyFailurePhase;
      message: string;
      createdPeople: string[];
      uploadedAssets: string[];
    };

type UploadedAsset = {
  image: NormalizedImageCandidate;
  id: string;
};

type PersonDraftResult = {
  id: string;
  created: boolean;
};

class DependencyPreparationFailure extends Error {
  constructor(
    readonly phase: DependencyFailurePhase,
    readonly originalError: unknown,
  ) {
    super(`Dependency preparation failed during ${phase}`);
  }
}

const preparationTimings = new WeakMap<PreparedImport, { startedAt: number; dependencyItemCount: number }>();

export async function prepareImport(
  plan: ImportPlan,
  params: PluginParameters,
  gateway: DatoGateway,
  options: ImportExecutorOptions = {},
): Promise<PrepareImportResult> {
  const createdPeople: string[] = [];
  const uploadedAssets: string[] = [];
  const completedUploads: Array<UploadedAsset | undefined> = [];
  const personIdsByCandidate = new Map<string, string>();
  const autoPersonIdsByTmdb = new Map<number, string>();
  const now = options.now ?? (() => globalThis.performance.now());
  const totalStartedAt = now();
  let firstDependencyFailure: DependencyPreparationFailure | null = null;

  const failDependency = (phase: DependencyFailurePhase, error: unknown) => {
    const failure = new DependencyPreparationFailure(phase, error);
    firstDependencyFailure ??= failure;
    return failure;
  };
  const firstRecordedDependencyFailure = (): DependencyPreparationFailure | null => firstDependencyFailure;

  for (const person of plan.peopleToReuse) {
    personIdsByCandidate.set(personKey(person), person.recordId);
  }

  const processPeople = async () => {
    const peopleToCreate = plan.peopleToCreate.filter((person) => !personIdsByCandidate.has(personKey(person)));
    const autoPeopleToCreate = peopleToCreate.filter((person) => person.source === 'auto');
    const lookupStartedAt = now();
    let existingPeople: ExistingPersonRecord[];
    reportProgress(options, {
      phase: 'people_lookup',
      state: 'active',
      completed: 0,
      total: autoPeopleToCreate.length,
    });

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
      reportProgress(options, {
        phase: 'people_lookup',
        state: 'failed',
        completed: 0,
        total: autoPeopleToCreate.length,
        message: importFailureMessage(error, 'Person lookup failed.'),
      });
      throw failDependency('people_lookup', error);
    }
    reportPhaseTiming(options, now, 'people_lookup', 'success', autoPeopleToCreate.length, lookupStartedAt);
    reportProgress(options, {
      phase: 'people_lookup',
      state: 'complete',
      completed: autoPeopleToCreate.length,
      total: autoPeopleToCreate.length,
    });

    const creationStartedAt = now();
    let creationCount = 0;
    let completedPersonCount = 0;
    reportProgress(options, {
      phase: 'people_create',
      state: 'active',
      completed: 0,
      total: peopleToCreate.length,
    });
    try {
      for (const person of peopleToCreate) {
        if (person.source === 'auto') {
          const autoPersonId = autoPersonIdsByTmdb.get(person.candidateTmdbId);
          if (autoPersonId) {
            personIdsByCandidate.set(personKey(person), autoPersonId);
            completedPersonCount += 1;
            reportProgress(options, {
              phase: 'people_create',
              state: 'active',
              completed: completedPersonCount,
              total: peopleToCreate.length,
            });
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
            completedPersonCount += 1;
            reportProgress(options, {
              phase: 'people_create',
              state: 'active',
              completed: completedPersonCount,
              total: peopleToCreate.length,
            });
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
        completedPersonCount += 1;
        reportProgress(options, {
          phase: 'people_create',
          state: 'active',
          completed: completedPersonCount,
          total: peopleToCreate.length,
        });
      }
    } catch (error) {
      reportPhaseTiming(options, now, 'people_create', 'failed', creationCount, creationStartedAt);
      reportProgress(options, {
        phase: 'people_create',
        state: 'failed',
        completed: completedPersonCount,
        total: peopleToCreate.length,
        message: importFailureMessage(error, 'Person creation failed.'),
      });
      throw failDependency('people_create', error);
    }
    reportPhaseTiming(options, now, 'people_create', 'success', creationCount, creationStartedAt);
    reportProgress(options, {
      phase: 'people_create',
      state: 'complete',
      completed: peopleToCreate.length,
      total: peopleToCreate.length,
    });
  };

  const processImages = async () => {
    const imagesStartedAt = now();
    let completedImageCount = 0;
    reportProgress(options, {
      phase: 'images',
      state: 'active',
      completed: 0,
      total: plan.assetsToUpload.length,
    });
    try {
      await mapWithConcurrency(
        plan.assetsToUpload,
        5,
        (image) => gateway.uploadImage(image),
        (upload, image, index) => {
          completedUploads[index] = { image, id: upload.id };
          completedImageCount += 1;
          reportProgress(options, {
            phase: 'images',
            state: 'active',
            completed: completedImageCount,
            total: plan.assetsToUpload.length,
          });
        },
      );
    } catch (error) {
      reportPhaseTiming(options, now, 'images', 'failed', plan.assetsToUpload.length, imagesStartedAt);
      reportProgress(options, {
        phase: 'images',
        state: 'failed',
        completed: completedImageCount,
        total: plan.assetsToUpload.length,
        message: importFailureMessage(error, 'Image upload failed.'),
      });
      throw failDependency('images', error);
    } finally {
      for (const asset of completedUploads) {
        if (!asset) continue;
        uploadedAssets.push(asset.id);
      }
    }
    reportPhaseTiming(options, now, 'images', 'success', plan.assetsToUpload.length, imagesStartedAt);
    reportProgress(options, {
      phase: 'images',
      state: 'complete',
      completed: plan.assetsToUpload.length,
      total: plan.assetsToUpload.length,
    });
  };

  const dependencyResults = await Promise.allSettled([processPeople(), processImages()]);
  const dependencyFailure = dependencyResults.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (dependencyFailure) {
    const actualFailure = firstRecordedDependencyFailure();
    if (!actualFailure) {
      throw dependencyFailure.reason;
    }

    reportPhaseTiming(options, now, 'total', 'failed', plan.peopleToCreate.length + plan.assetsToUpload.length, totalStartedAt);
    return {
      status: 'dependency_failed',
      failedPhase: actualFailure.phase,
      message: importFailureMessage(actualFailure.originalError, 'The import could not finish while creating people or uploading images. Some drafts or uploads may already exist in DatoCMS.'),
      createdPeople,
      uploadedAssets,
    };
  }

  reportProgress(options, {
    phase: 'fields_prepare',
    state: 'active',
    completed: 0,
    total: 1,
  });
  const prepared: PreparedImport = {
    fieldChanges: plan.fieldChanges,
    directors: plan.directors,
    actors: plan.actors,
    people: [...personIdsByCandidate.entries()].map(([key, recordId]) => {
      const [candidateRole, candidateTmdbId] = key.split(':');
      return {
        candidateRole: candidateRole as PreparedPersonReference['candidateRole'],
        candidateTmdbId: Number(candidateTmdbId),
        recordId,
      };
    }),
    images: completedUploads.flatMap((asset) => asset ? [{
      providerKey: asset.image.providerKey,
      providerImageId: asset.image.providerImageId,
      type: asset.image.type,
      uploadId: asset.id,
    }] : []),
    heroImage: plan.heroImageToUpload ? imageIdentity(plan.heroImageToUpload) : null,
    otherImages: plan.otherImagesToUpload.map(imageIdentity),
    createdPeople,
    uploadedAssets,
  };
  preparationTimings.set(prepared, {
    startedAt: totalStartedAt,
    dependencyItemCount: plan.peopleToCreate.length + plan.assetsToUpload.length,
  });
  reportProgress(options, {
    phase: 'fields_prepare',
    state: 'complete',
    completed: 1,
    total: 1,
  });

  return { status: 'success', prepared };
}

export async function applyPreparedImport(
  prepared: PreparedImport,
  params: PluginParameters,
  gateway: DatoGateway,
  options: ImportExecutorOptions = {},
): Promise<ImportResult> {
  const now = options.now ?? (() => globalThis.performance.now());
  const preparationTiming = preparationTimings.get(prepared);
  const totalStartedAt = preparationTiming?.startedAt ?? now();
  const dependencyItemCount = preparationTiming?.dependencyItemCount
    ?? prepared.createdPeople.length + prepared.uploadedAssets.length;

  const changes = prepared.fieldChanges
    .map((change) => {
      const fieldApiKey = params.movieFields[change.key];
      return fieldApiKey ? { fieldPath: movieFieldPath(change.key, fieldApiKey, params, options), value: valueForMovieField(change.key, change.value, options) } : null;
    })
    .filter((change): change is { fieldPath: string; value: unknown } => change !== null);

  const directorField = params.movieFields.directors;
  if (directorField && prepared.directors.length > 0) {
    changes.push({
      fieldPath: movieFieldPath('directors', directorField, params, options),
      value: prepared.directors.map((person) => preparedPersonId(prepared, person)).filter((id): id is string => Boolean(id)).map(itemReference),
    });
  }

  const actorField = params.movieFields.actors;
  if (actorField && prepared.actors.length > 0) {
    changes.push({
      fieldPath: movieFieldPath('actors', actorField, params, options),
      value: prepared.actors.map((person) => preparedPersonId(prepared, person)).filter((id): id is string => Boolean(id)).map(itemReference),
    });
  }

  const posterField = params.movieFields.poster;
  const poster = prepared.images.find((asset) => asset.type === 'poster');
  if (posterField && poster) {
    changes.push({ fieldPath: movieFieldPath('poster', posterField, params, options), value: assetReference(poster.uploadId) });
  }

  const backdropField = params.movieFields.backdrops;
  const backdrops = prepared.images.filter((asset) => asset.type === 'backdrop');

  const heroImageField = params.movieFields.heroImage;
  const heroImageIdentity = prepared.heroImage;
  const heroImage = heroImageIdentity
    ? backdrops.find((asset) => sameImage(asset, heroImageIdentity))
    : null;
  if (heroImageField && heroImage) {
    changes.push({ fieldPath: movieFieldPath('heroImage', heroImageField, params, options), value: assetReference(heroImage.uploadId) });
  }

  if (backdropField && backdrops.length > 0) {
    const otherImages = prepared.otherImages
      .map((image) => backdrops.find((asset) => sameImage(asset, image)))
      .filter((asset): asset is PreparedImageReference => Boolean(asset));

    if (otherImages.length > 0) {
      changes.push({
        fieldPath: movieFieldPath('backdrops', backdropField, params, options),
        value: otherImages.map((asset) => assetReference(asset.uploadId)),
      });
    }
  }

  const fieldsStartedAt = now();
  try {
    await gateway.applyFormValues(changes);
  } catch (error) {
    reportPhaseTiming(options, now, 'fields', 'failed', changes.length, fieldsStartedAt);
    reportPhaseTiming(options, now, 'total', 'failed', dependencyItemCount + changes.length, totalStartedAt);
    return {
      status: 'form_failed',
      message: importFailureMessage(error, 'The import could not finish while updating the movie form. Created people and uploaded images may already exist in DatoCMS.'),
      createdPeople: prepared.createdPeople,
      uploadedAssets: prepared.uploadedAssets,
      appliedFields: error instanceof FormValuesApplyError ? error.appliedFields : [],
    };
  }
  reportPhaseTiming(options, now, 'fields', 'success', changes.length, fieldsStartedAt);
  reportPhaseTiming(options, now, 'total', 'success', dependencyItemCount + changes.length, totalStartedAt);

  return {
    status: 'success',
    createdPeople: prepared.createdPeople,
    uploadedAssets: prepared.uploadedAssets,
    appliedFields: changes.map((change) => change.fieldPath),
  };
}

export async function executeImportPlan(
  plan: ImportPlan,
  params: PluginParameters,
  gateway: DatoGateway,
  options: ImportExecutorOptions = {},
): Promise<ImportResult> {
  const preparation = await prepareImport(plan, params, gateway, options);

  if (preparation.status === 'dependency_failed') {
    return preparation;
  }

  return applyPreparedImport(preparation.prepared, params, gateway, options);
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

function reportProgress(
  options: ImportExecutorOptions,
  event: ImportProgressEvent,
) {
  try {
    const callback = options.onProgress as ((progressEvent: ImportProgressEvent) => unknown) | undefined;
    const result = callback?.(event);
    if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
      void Promise.resolve(result).catch(() => {
        // Presentation feedback must never interrupt an import.
      });
    }
  } catch {
    // Presentation feedback must never interrupt an import.
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

function imageIdentity(image: NormalizedImageCandidate): Pick<NormalizedImageCandidate, 'providerKey' | 'providerImageId'> {
  return {
    providerKey: image.providerKey,
    providerImageId: image.providerImageId,
  };
}

function sameImage(
  left: Pick<NormalizedImageCandidate, 'providerKey' | 'providerImageId'>,
  right: Pick<NormalizedImageCandidate, 'providerKey' | 'providerImageId'>,
) {
  return left.providerKey === right.providerKey && left.providerImageId === right.providerImageId;
}

function preparedPersonId(
  prepared: PreparedImport,
  person: ImportPlan['directors'][number] | ImportPlan['actors'][number],
) {
  return prepared.people.find((reference) => (
    reference.candidateTmdbId === person.tmdbId
    && reference.candidateRole === person.role
  ))?.recordId;
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
