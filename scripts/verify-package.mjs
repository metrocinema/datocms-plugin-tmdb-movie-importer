import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import {
  verifyManifest,
  verifyMarketplaceMetadata,
  verifyMatchingPackedFiles,
  verifyPackedFiles,
  verifyRelativeAssets,
} from './package-verifier.mjs';

const execFileAsync = promisify(execFile);
const repositoryRoot = process.cwd();
async function packageDryRun(destination) {
  const { stdout } = await execFileAsync(
    'npm',
    ['pack', '--dry-run', '--json', '--ignore-scripts', '--pack-destination', destination],
    { cwd: repositoryRoot },
  );
  const [manifest] = JSON.parse(stdout);
  if (!manifest) throw new Error('npm pack --dry-run did not return package metadata');
  return manifest;
}

async function createTarball(destination) {
  const { stdout } = await execFileAsync(
    'npm',
    ['pack', '--json', '--ignore-scripts', '--pack-destination', destination],
    { cwd: repositoryRoot },
  );
  const [manifest] = JSON.parse(stdout);
  if (!manifest?.filename) throw new Error('npm pack did not return a tarball filename');
  return { manifest, tarballPath: join(destination, manifest.filename) };
}

function contentType(filePath) {
  return {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
  }[extname(filePath)] ?? 'application/octet-stream';
}

async function serveNestedEntryPoint(packageDirectory, references) {
  const pathPrefix = '/dato/plugins/tmdb-movie-importer/';
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    if (!pathname.startsWith(pathPrefix)) {
      response.writeHead(404).end();
      return;
    }

    const requestedPath = pathname.slice(pathPrefix.length);
    const filePath = resolve(packageDirectory, requestedPath);
    if (relative(packageDirectory, filePath).startsWith('..')) {
      response.writeHead(400).end();
      return;
    }

    try {
      const contents = await readFile(filePath);
      response.writeHead(200, { 'content-type': contentType(filePath) }).end(contents);
    } catch {
      response.writeHead(404).end();
    }
  });

  await new Promise((resolveServer, rejectServer) => {
    server.once('error', rejectServer);
    server.listen(0, '127.0.0.1', () => resolveServer());
  });

  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('nested package server did not provide a TCP port');
    const entryPoint = new URL(`${pathPrefix}dist/index.html`, `http://127.0.0.1:${address.port}`);
    const htmlResponse = await fetch(entryPoint);
    if (htmlResponse.status !== 200) throw new Error(`nested entry point returned ${htmlResponse.status}`);

    const assetStatuses = await Promise.all(references.map(async (reference) => {
      const response = await fetch(new URL(reference, entryPoint));
      return { reference, status: response.status };
    }));
    const missingAsset = assetStatuses.find((asset) => asset.status !== 200);
    if (missingAsset) throw new Error(`nested asset returned ${missingAsset.status}: ${missingAsset.reference}`);

    const jsStatus = assetStatuses.find((asset) => asset.reference.endsWith('.js'))?.status;
    const cssStatus = assetStatuses.find((asset) => asset.reference.endsWith('.css'))?.status;
    if (jsStatus !== 200) throw new Error('nested JavaScript asset did not load');
    if (cssStatus !== 200) throw new Error('nested CSS asset did not load');
    return { htmlStatus: htmlResponse.status, jsStatus, cssStatus };
  } finally {
    await new Promise((resolveServer, rejectServer) => server.close((error) => (error ? rejectServer(error) : resolveServer())));
  }
}

async function main() {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'tmdb-movie-importer-package-'));
  try {
    const dryRunManifest = await packageDryRun(temporaryDirectory);
    verifyManifest(dryRunManifest);
    verifyPackedFiles(dryRunManifest.files);

    const { manifest: tarballManifest, tarballPath } = await createTarball(temporaryDirectory);
    verifyManifest(tarballManifest);
    verifyPackedFiles(tarballManifest.files);
    verifyMatchingPackedFiles(dryRunManifest.files, tarballManifest.files);
    const extractDirectory = join(temporaryDirectory, 'extracted');
    await mkdir(extractDirectory);
    await execFileAsync('tar', ['-xzf', tarballPath, '-C', extractDirectory]);

    const packageDirectory = join(extractDirectory, 'package');
    const extractedManifest = JSON.parse(await readFile(join(packageDirectory, 'package.json'), 'utf8'));
    verifyMarketplaceMetadata(extractedManifest);
    const references = await verifyRelativeAssets(packageDirectory, tarballManifest.files);
    const nestedServe = await serveNestedEntryPoint(packageDirectory, references);

    console.log('Package verification passed');
    console.log(`Packed entries: ${tarballManifest.entryCount}`);
    console.log(`Nested serve: HTML ${nestedServe.htmlStatus}, JS ${nestedServe.jsStatus}, CSS ${nestedServe.cssStatus}`);
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
}

main().catch((error) => {
  console.error(`Package verification failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
