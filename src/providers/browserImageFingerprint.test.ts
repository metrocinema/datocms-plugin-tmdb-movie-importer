import type { NormalizedImageCandidate } from '../domain/movie';
import { loadBrowserImageFingerprint } from './browserImageFingerprint';

function candidate(overrides: Partial<NormalizedImageCandidate> = {}): NormalizedImageCandidate {
  return {
    providerKey: 'tmdb',
    providerImageId: '/image.jpg',
    movieIdentity: { providerKey: 'tmdb', tmdbId: 1 },
    type: 'poster',
    originalUrl: 'https://images.example/original.jpg',
    previewUrl: 'https://images.example/preview.jpg',
    analysisUrl: 'https://images.example/analysis.jpg',
    width: 100,
    height: 150,
    language: 'en',
    rank: 1,
    attribution: 'TMDB',
    ...overrides,
  };
}

function successfulDependencies() {
  const requestedUrls: string[] = [];
  const drawImage = vi.fn();
  const getImageData = vi.fn(() => ({ data: new Uint8ClampedArray(9 * 8 * 4) }));
  const close = vi.fn();
  const bitmap = { width: 180, height: 120, close } as unknown as ImageBitmap;
  const canvas = document.createElement('canvas');
  vi.spyOn(canvas, 'getContext').mockReturnValue({
    drawImage,
    getImageData,
  } as unknown as CanvasRenderingContext2D);

  return {
    requestedUrls,
    drawImage,
    close,
    canvas,
    dependencies: {
      fetchImage: async (url: string) => {
        requestedUrls.push(url);
        return new Blob(['image']);
      },
      decodeImage: async () => bitmap,
      createCanvas: () => canvas,
    },
  };
}

describe('loadBrowserImageFingerprint', () => {
  it('loads the analysis URL into a 9-by-8 canvas and closes the decoded bitmap', async () => {
    const { requestedUrls, drawImage, close, canvas, dependencies } = successfulDependencies();

    const fingerprint = await loadBrowserImageFingerprint(candidate(), dependencies);

    expect(requestedUrls).toEqual(['https://images.example/analysis.jpg']);
    expect(canvas.width).toBe(9);
    expect(canvas.height).toBe(8);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 9, 8);
    expect(fingerprint).toEqual({ hash: 0n, aspectRatio: 1.5 });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('closes the decoded bitmap when the canvas cannot provide a 2D context', async () => {
    const { close, dependencies } = successfulDependencies();
    dependencies.createCanvas = () => {
      const canvas = document.createElement('canvas');
      vi.spyOn(canvas, 'getContext').mockReturnValue(null);
      return canvas;
    };

    await expect(loadBrowserImageFingerprint(candidate(), dependencies))
      .rejects.toThrow('Image analysis canvas is unavailable.');
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('rejects unsuccessful browser requests with a generic image-analysis error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    await expect(loadBrowserImageFingerprint(candidate()))
      .rejects.toThrow('Image analysis request failed.');
  });

  it('falls back from the analysis URL to the preview URL and then original URL', async () => {
    const preview = successfulDependencies();
    const original = successfulDependencies();

    await loadBrowserImageFingerprint(candidate({ analysisUrl: undefined }), preview.dependencies);
    await loadBrowserImageFingerprint(candidate({ analysisUrl: undefined, previewUrl: undefined }), original.dependencies);

    expect(preview.requestedUrls).toEqual(['https://images.example/preview.jpg']);
    expect(original.requestedUrls).toEqual(['https://images.example/original.jpg']);
  });
});
