import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function createPackageTarball({ destination, environment, repositoryRoot }) {
  const packEnvironment = { ...environment, npm_config_dry_run: 'false' };
  const { stdout } = await execFileAsync(
    'npm',
    ['pack', '--json', '--ignore-scripts', '--pack-destination', destination],
    { cwd: repositoryRoot, env: packEnvironment },
  );
  const [manifest] = JSON.parse(stdout);
  if (!manifest?.filename) throw new Error('npm pack did not return a tarball filename');
  return { manifest, tarballPath: join(destination, manifest.filename) };
}
