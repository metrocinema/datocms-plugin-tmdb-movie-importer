import { FormValuesApplyError, type DatoGateway } from './datoGateway';
import type { ImportPlan } from '../domain/importPlanning';
import type { MovieFieldKey, NormalizedImageCandidate } from '../domain/movie';
import type { PluginParameters } from '../plugin/parameters';
import { assetReference, fieldPathForMovieField, itemReference } from '../plugin/datoFieldMapping';
import { matchPerson } from '../domain/personMatching';

export type ImportResult =
  | { status: 'success'; createdPeople: string[]; uploadedAssets: string[]; appliedFields: string[] }
  | { status: 'dependency_failed'; message: string; createdPeople: string[]; uploadedAssets: string[] }
  | { status: 'form_failed'; message: string; createdPeople: string[]; uploadedAssets: string[]; appliedFields: string[] };

export type ImportExecutorOptions = {
  localizedMovieFields?: Partial<Record<MovieFieldKey, boolean>>;
  movieFieldTypes?: Partial<Record<MovieFieldKey, string>>;
};

type UploadedAsset = {
  image: NormalizedImageCandidate;
  id: string;
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
  const personIdsByTmdb = new Map<number, string>();

  try {
    for (const person of plan.peopleToReuse) {
      personIdsByTmdb.set(person.candidateTmdbId, person.recordId);
    }

    const peopleToCreate = plan.peopleToCreate.filter((person) => !personIdsByTmdb.has(person.candidateTmdbId));
    const existingPeople = peopleToCreate.length > 0
      ? await gateway.findPeople({
        modelApiKey: params.personModelApiKey,
        nameFieldApiKey: params.personNameFieldApiKey,
        tmdbIdFieldApiKey: params.personTmdbIdFieldApiKey,
        names: peopleToCreate.map((person) => person.name),
        tmdbIds: peopleToCreate.map((person) => person.candidateTmdbId),
      })
      : [];

    for (const person of peopleToCreate) {
      const decision = matchPerson(
        { tmdbId: person.candidateTmdbId, name: person.name, order: 0, role: 'actor' },
        existingPeople,
        Boolean(params.personTmdbIdFieldApiKey),
      );
      if (decision.type === 'reuse') {
        personIdsByTmdb.set(person.candidateTmdbId, decision.recordId);
        continue;
      }

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
      uploadedAssetsByImage.push({ image, id: upload.id });
    }
  } catch (error) {
    return {
      status: 'dependency_failed',
      message: importFailureMessage(error, 'The import could not finish while creating people or uploading images. Some drafts or uploads may already exist in DatoCMS.'),
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
      value: plan.directors.map((person) => personIdsByTmdb.get(person.tmdbId)).filter((id): id is string => Boolean(id)).map(itemReference),
    });
  }

  const actorField = params.movieFields.actors;
  if (actorField && plan.actors.length > 0) {
    changes.push({
      fieldPath: movieFieldPath('actors', actorField, params, options),
      value: plan.actors.map((person) => personIdsByTmdb.get(person.tmdbId)).filter((id): id is string => Boolean(id)).map(itemReference),
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
  const heroImage = backdrops[0];
  if (heroImageField && heroImage) {
    changes.push({ fieldPath: movieFieldPath('heroImage', heroImageField, params, options), value: assetReference(heroImage.id) });
  }

  if (backdropField && backdrops.length > 0) {
    changes.push({
      fieldPath: movieFieldPath('backdrops', backdropField, params, options),
      value: backdrops.map((asset) => assetReference(asset.id)),
    });
  }

  try {
    await gateway.applyFormValues(changes);
  } catch (error) {
    return {
      status: 'form_failed',
      message: importFailureMessage(error, 'The import could not finish while updating the movie form. Created people and uploaded images may already exist in DatoCMS.'),
      createdPeople,
      uploadedAssets,
      appliedFields: error instanceof FormValuesApplyError ? error.appliedFields : [],
    };
  }

  return {
    status: 'success',
    createdPeople,
    uploadedAssets,
    appliedFields: changes.map((change) => change.fieldPath),
  };
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
    return structuredTextDocument(String(value));
  }

  return value;
}

function structuredTextDocument(value: string): { schema: 'dast'; document: { type: 'root'; children: Array<{ type: 'paragraph'; children: Array<{ type: 'span'; value: string }> }> } } {
  return {
    schema: 'dast',
    document: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'span', value }],
        },
      ],
    },
  };
}
