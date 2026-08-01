import type { NormalizedImageCandidate } from '../domain/movie';

export function compareRankResolutionThenIdentity(
  left: NormalizedImageCandidate,
  right: NormalizedImageCandidate,
) {
  return left.rank - right.rank ||
    pixelArea(right) - pixelArea(left) ||
    imageIdentity(left).localeCompare(imageIdentity(right));
}

export function comparePreferredBackdropThenRank(
  left: NormalizedImageCandidate,
  right: NormalizedImageCandidate,
) {
  return preferredBackdropScore(right) - preferredBackdropScore(left) ||
    compareRankResolutionThenIdentity(left, right);
}

function preferredBackdropScore(candidate: NormalizedImageCandidate): number {
  return candidate.width === 3840 && candidate.height === 2160 ? 1 : 0;
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
