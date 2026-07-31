import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { verifyMatchingPackedFiles, verifyPackedFiles, verifyRelativeAssets } from './package-verifier.mjs';

const requiredPackedFiles = [
  'package.json',
  'README.md',
  'LICENSE',
  'CHANGELOG.md',
  'docs/release-guide.md',
  'dist/index.html',
  'dist/assets/index.js',
  'dist/assets/index.css',
  'docs/marketplace/cover.webp',
  'docs/marketplace/preview.webp',
].map((path) => ({ path }));

describe('package verifier', () => {
  it('rejects a package that omits the release operations guide linked from the README', () => {
    expect(() => verifyPackedFiles(requiredPackedFiles.filter(({ path }) => path !== 'docs/release-guide.md')))
      .toThrow('package is missing required file: docs/release-guide.md');
  });

  it('rejects a source file in the package manifest', () => {
    expect(() => verifyPackedFiles([...requiredPackedFiles, { path: 'src/main.tsx' }]))
      .toThrow('package contains forbidden file: src/main.tsx');
  });

  it('rejects a tarball file list that differs from its dry-run manifest', () => {
    expect(() => verifyMatchingPackedFiles(
      requiredPackedFiles,
      [...requiredPackedFiles, { path: 'src/main.tsx' }],
    )).toThrow('npm pack dry-run and tarball file lists differ: added src/main.tsx');
  });

  it('rejects absolute built asset references', async () => {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), 'package-verifier-test-'));
    try {
      const packageDirectory = join(temporaryDirectory, 'package');
      await mkdir(join(packageDirectory, 'dist'), { recursive: true });
      await writeFile(
        join(packageDirectory, 'dist/index.html'),
        '<link rel="stylesheet" href="/assets/index.css"><script type="module" src="./assets/index.js"></script>',
      );

      await expect(verifyRelativeAssets(packageDirectory, requiredPackedFiles))
        .rejects.toThrow('built asset is not relative: /assets/index.css');
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  });
});
