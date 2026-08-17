import type { FieldComparison } from './fieldComparison';
import type { NormalizedImageCandidate, PersonCandidate, MovieFieldKey } from './movie';
import type { ImageSelection } from '../providers/imageProvider';

export type PersonResolution =
  | { candidateTmdbId: number; candidateRole: PersonCandidate['role']; action: 'reuse'; recordId: string; name: string; source: 'tmdb-id' | 'exact-name' | 'manual' }
  | { candidateTmdbId: number; candidateRole: PersonCandidate['role']; action: 'create'; name: string; source: 'auto' | 'manual' };

export type ImportPlan = {
  fieldChanges: Array<{ key: MovieFieldKey; value: unknown }>;
  directors: PersonCandidate[];
  actors: PersonCandidate[];
  peopleToCreate: Array<{ candidateTmdbId: number; candidateRole: PersonCandidate['role']; name: string; source: 'auto' | 'manual' }>;
  peopleToReuse: Array<{ candidateTmdbId: number; candidateRole: PersonCandidate['role']; recordId: string; name: string; source: 'tmdb-id' | 'exact-name' | 'manual' }>;
  heroImageToUpload: NormalizedImageCandidate | null;
  otherImagesToUpload: NormalizedImageCandidate[];
  assetsToUpload: NormalizedImageCandidate[];
};

export type BuildImportPlanInput = {
  fieldComparisons: FieldComparison[];
  directors: PersonCandidate[];
  actors: PersonCandidate[];
  imageSelection: ImageSelection;
  personResolutions: PersonResolution[];
  mappedFields: MovieFieldKey[];
};

export function buildImportPlan(input: BuildImportPlanInput): ImportPlan {
  const mappedFields = new Set(input.mappedFields);
  const directors = mappedFields.has('directors') ? input.directors : [];
  const actors = mappedFields.has('actors') ? input.actors : [];
  const imageSelection = {
    poster: mappedFields.has('poster') ? input.imageSelection.poster : null,
    heroImage: mappedFields.has('heroImage') ? input.imageSelection.heroImage : null,
    backdrops: mappedFields.has('backdrops') ? input.imageSelection.backdrops : [],
  };
  const heroImage = imageSelection.heroImage;
  const otherImages = heroImage
    ? imageSelection.backdrops.filter((image) => !sameImage(image, heroImage))
    : imageSelection.backdrops;
  const fieldChanges = input.fieldComparisons
    .filter((comparison) => mappedFields.has(comparison.key))
    .filter((comparison) => comparison.selected && comparison.available && comparison.changed)
    .map((comparison) => ({ key: comparison.key, value: comparison.proposedValue }));

  const assetsToUpload = uniqueImages([
    imageSelection.poster,
    heroImage,
    ...otherImages,
  ]);
  const personResolutions = input.personResolutions.filter((resolution) => isMappedPersonRole(resolution.candidateRole, mappedFields));

  return {
    fieldChanges,
    directors: [...directors],
    actors: [...actors],
    peopleToCreate: personResolutions
      .filter((resolution): resolution is Extract<PersonResolution, { action: 'create' }> => resolution.action === 'create')
      .map((resolution) => ({ candidateTmdbId: resolution.candidateTmdbId, candidateRole: resolution.candidateRole, name: resolution.name, source: resolution.source })),
    peopleToReuse: personResolutions
      .filter((resolution): resolution is Extract<PersonResolution, { action: 'reuse' }> => resolution.action === 'reuse')
      .map((resolution) => ({ candidateTmdbId: resolution.candidateTmdbId, candidateRole: resolution.candidateRole, recordId: resolution.recordId, name: resolution.name, source: resolution.source })),
    heroImageToUpload: heroImage,
    otherImagesToUpload: [...otherImages],
    assetsToUpload,
  };
}

function sameImage(left: NormalizedImageCandidate, right: NormalizedImageCandidate) {
  return left.providerKey === right.providerKey && left.providerImageId === right.providerImageId;
}

function isMappedPersonRole(role: PersonCandidate['role'], mappedFields: Set<MovieFieldKey>) {
  return role === 'director' ? mappedFields.has('directors') : mappedFields.has('actors');
}

function uniqueImages(images: Array<NormalizedImageCandidate | null>): NormalizedImageCandidate[] {
  const seen = new Set<string>();
  return images.filter((image): image is NormalizedImageCandidate => {
    if (!image) return false;
    const key = `${image.providerKey}:${image.providerImageId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
