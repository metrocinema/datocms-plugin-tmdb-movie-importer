import type { NormalizedImageCandidate } from '../domain/movie';
import {
  hammingDistance,
  type ImageFingerprint,
  type ImageFingerprintLoader,
} from './imageFingerprint';

const DEFAULT_CONCURRENCY = 4;
const MAX_ASPECT_RATIO_DIFFERENCE = 0.01;
const MAX_HASH_DISTANCE = 2;

type FingerprintedCandidate = {
  candidate: NormalizedImageCandidate;
  fingerprint: ImageFingerprint | null;
};

type DuplicateGroup = {
  anchor: ImageFingerprint | null;
  members: FingerprintedCandidate[];
  bestRank: number;
  stableKey: string;
};

export async function deduplicateImageCandidates(
  candidates: NormalizedImageCandidate[],
  loadFingerprint: ImageFingerprintLoader,
  concurrency = DEFAULT_CONCURRENCY,
): Promise<NormalizedImageCandidate[]> {
  const ranked = [...candidates].sort(compareRankThenIdentity);
  const fingerprinted = await mapWithConcurrency(
    ranked,
    concurrency,
    async (candidate): Promise<FingerprintedCandidate> => ({
      candidate,
      fingerprint: await loadFingerprint(candidate).catch(() => null),
    }),
  );
  const groups: DuplicateGroup[] = [];

  for (const item of fingerprinted) {
    const matchingGroup = item.fingerprint
      ? groups.find((group) => group.anchor && isDuplicate(group.members[0], item))
      : undefined;

    if (matchingGroup) {
      matchingGroup.members.push(item);
      matchingGroup.bestRank = Math.min(matchingGroup.bestRank, item.candidate.rank);
      matchingGroup.stableKey = [
        matchingGroup.stableKey,
        imageIdentity(item.candidate),
      ].sort()[0];
    } else {
      groups.push({
        anchor: item.fingerprint,
        members: [item],
        bestRank: item.candidate.rank,
        stableKey: imageIdentity(item.candidate),
      });
    }
  }

  return groups
    .sort((left, right) =>
      left.bestRank - right.bestRank ||
      left.stableKey.localeCompare(right.stableKey),
    )
    .map((group) => [...group.members]
      .sort((left, right) =>
        pixelArea(right.candidate) - pixelArea(left.candidate) ||
        compareRankThenIdentity(left.candidate, right.candidate),
      )[0].candidate);
}

function isDuplicate(
  left: FingerprintedCandidate,
  right: FingerprintedCandidate,
) {
  if (
    left.candidate.type !== right.candidate.type ||
    !left.fingerprint ||
    !right.fingerprint ||
    left.fingerprint.aspectRatio === null ||
    right.fingerprint.aspectRatio === null
  ) {
    return false;
  }

  const ratioDifference =
    Math.abs(left.fingerprint.aspectRatio - right.fingerprint.aspectRatio) /
    Math.max(left.fingerprint.aspectRatio, right.fingerprint.aspectRatio);

  return ratioDifference <= MAX_ASPECT_RATIO_DIFFERENCE &&
    hammingDistance(left.fingerprint.hash, right.fingerprint.hash) <=
      MAX_HASH_DISTANCE;
}

async function mapWithConcurrency<Input, Output>(
  inputs: Input[],
  concurrency: number,
  worker: (input: Input) => Promise<Output>,
) {
  const output = new Array<Output>(inputs.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < inputs.length) {
      const index = nextIndex;
      nextIndex += 1;
      output[index] = await worker(inputs[index]);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), inputs.length) },
      runWorker,
    ),
  );
  return output;
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

function compareRankThenIdentity(
  left: NormalizedImageCandidate,
  right: NormalizedImageCandidate,
): number {
  return left.rank - right.rank || imageIdentity(left).localeCompare(imageIdentity(right));
}
