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
};

export function buildImportPlan(input: BuildImportPlanInput): ImportPlan {
  const fieldChanges = input.fieldComparisons
    .filter((comparison) => comparison.selected && comparison.available && comparison.changed)
    .map((comparison) => ({ key: comparison.key, value: comparison.proposedValue }));

  const assetsToUpload = uniqueImages([
    input.imageSelection.poster,
    input.imageSelection.heroImage,
    ...input.imageSelection.backdrops,
  ]);

  return {
    fieldChanges,
    directors: [...input.directors],
    actors: [...input.actors],
    peopleToCreate: input.personResolutions
      .filter((resolution): resolution is Extract<PersonResolution, { action: 'create' }> => resolution.action === 'create')
      .map((resolution) => ({ candidateTmdbId: resolution.candidateTmdbId, candidateRole: resolution.candidateRole, name: resolution.name, source: resolution.source })),
    peopleToReuse: input.personResolutions
      .filter((resolution): resolution is Extract<PersonResolution, { action: 'reuse' }> => resolution.action === 'reuse')
      .map((resolution) => ({ candidateTmdbId: resolution.candidateTmdbId, candidateRole: resolution.candidateRole, recordId: resolution.recordId, name: resolution.name, source: resolution.source })),
    heroImageToUpload: input.imageSelection.heroImage,
    otherImagesToUpload: [...input.imageSelection.backdrops],
    assetsToUpload,
  };
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
