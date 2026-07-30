import { differenceHashFromRgba, hammingDistance } from './imageFingerprint';

function rgbaFromLuminance(values: number[]) {
  return new Uint8ClampedArray(values.flatMap((value) => [value, value, value, 255]));
}

describe('image fingerprints', () => {
  it('computes one comparison bit for each horizontal pixel pair', () => {
    const row = [0, 20, 10, 30, 20, 40, 30, 50, 40];
    const rgba = rgbaFromLuminance(Array.from({ length: 8 }, () => row).flat());

    expect(differenceHashFromRgba(rgba, 9, 8)).toBe(0xaaaaaaaaaaaaaaaan);
  });

  it('counts differing hash bits', () => {
    expect(hammingDistance(0b1010n, 0b0011n)).toBe(2);
  });

  it('rejects a sample that is not 9 by 8 pixels', () => {
    expect(() => differenceHashFromRgba(new Uint8ClampedArray(4), 1, 1))
      .toThrow('Difference hash requires a 9 × 8 RGBA sample.');
  });
});
