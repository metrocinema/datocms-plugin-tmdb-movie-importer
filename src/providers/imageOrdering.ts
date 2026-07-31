import type { NormalizedImageCandidate } from '../domain/movie';

export function compareRankResolutionThenIdentity(
  left: NormalizedImageCandidate,
  right: NormalizedImageCandidate,
) {
  return left.rank - right.rank ||
    pixelArea(right) - pixelArea(left) ||
    imageIdentity(left).localeCompare(imageIdentity(right));
}

function pixelArea(candidate: NormalizedImageCandidate): number {
  if (
    candidate.width === null ||
    candidate.height === null ||
    candidate.width <= 0 ||
    candidate.height <= 0
  ) {
    return -1;
  }

  return candidate.width * candidate.height;
}

function imageIdentity(candidate: NormalizedImageCandidate): string {
  return `${candidate.providerKey}:${candidate.providerImageId}`;
}
