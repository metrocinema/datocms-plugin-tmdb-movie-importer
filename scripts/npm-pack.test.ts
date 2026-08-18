import { access, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createPackageTarball } from './npm-pack.mjs';

describe('npm package tarball creation', () => {
  it('creates a tarball when an outer npm command enables dry-run mode', async () => {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), 'npm-pack-test-'));
    try {
      const packageDirectory = join(temporaryDirectory, 'package');
      const destination = join(temporaryDirectory, 'packed');
      await mkdir(packageDirectory);
      await mkdir(destination);
      await writeFile(
        join(packageDirectory, 'package.json'),
        JSON.stringify({ name: 'package-verifier-fixture', version: '1.0.0', files: ['index.js'] }),
      );
      await writeFile(join(packageDirectory, 'index.js'), 'export default true;\n');

      const { manifest, tarballPath } = await createPackageTarball({
        destination,
        environment: { ...process.env, npm_config_dry_run: 'true' },
        repositoryRoot: packageDirectory,
      });

      expect(manifest.filename).toBe('package-verifier-fixture-1.0.0.tgz');
      await expect(access(tarballPath)).resolves.toBeUndefined();
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  });
});
