import type { NormalizedImageCandidate } from '../domain/movie';

export type ImageFingerprint = {
  hash: bigint;
  aspectRatio: number | null;
};

export type ImageFingerprintLoader = (
  candidate: NormalizedImageCandidate,
) => Promise<ImageFingerprint>;

export function differenceHashFromRgba(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): bigint {
  if (width !== 9 || height !== 8 || data.length !== width * height * 4) {
    throw new Error('Difference hash requires a 9 × 8 RGBA sample.');
  }

  let hash = 0n;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const left = luminanceAt(data, y * width + x);
      const right = luminanceAt(data, y * width + x + 1);
      hash = (hash << 1n) | (left < right ? 1n : 0n);
    }
  }

  return hash;
}

export function hammingDistance(left: bigint, right: bigint): number {
  let value = left ^ right;
  let count = 0;

  while (value !== 0n) {
    count += 1;
    value &= value - 1n;
  }

  return count;
}

function luminanceAt(data: Uint8ClampedArray, pixelIndex: number) {
  const offset = pixelIndex * 4;
  return data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
}
