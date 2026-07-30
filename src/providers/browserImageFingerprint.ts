import type { NormalizedImageCandidate } from '../domain/movie';
import {
  differenceHashFromRgba,
  type ImageFingerprint,
} from './imageFingerprint';

type FingerprintDependencies = {
  fetchImage: (url: string) => Promise<Blob>;
  decodeImage: (blob: Blob) => Promise<ImageBitmap>;
  createCanvas: () => HTMLCanvasElement;
};

const browserDependencies: FingerprintDependencies = {
  async fetchImage(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Image analysis request failed.');
    }
    return response.blob();
  },
  decodeImage: (blob) => createImageBitmap(blob),
  createCanvas: () => document.createElement('canvas'),
};

export async function loadBrowserImageFingerprint(
  candidate: NormalizedImageCandidate,
  dependencies = browserDependencies,
): Promise<ImageFingerprint> {
  const url = candidate.analysisUrl ?? candidate.previewUrl ?? candidate.originalUrl;
  const blob = await dependencies.fetchImage(url);
  const bitmap = await dependencies.decodeImage(blob);

  try {
    const canvas = dependencies.createCanvas();
    canvas.width = 9;
    canvas.height = 8;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('Image analysis canvas is unavailable.');
    }
    context.drawImage(bitmap, 0, 0, 9, 8);
    const rgba = context.getImageData(0, 0, 9, 8).data;
    return {
      hash: differenceHashFromRgba(rgba, 9, 8),
      aspectRatio: bitmap.height > 0 ? bitmap.width / bitmap.height : null,
    };
  } finally {
    bitmap.close();
  }
}
