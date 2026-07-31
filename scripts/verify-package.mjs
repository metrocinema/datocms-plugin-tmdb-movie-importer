import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const repositoryRoot = process.cwd();
const requiredFiles = [
  'package.json',
  'README.md',
  'LICENSE',
  'CHANGELOG.md',
  'dist/index.html',
  'docs/marketplace/cover.webp',
  'docs/marketplace/preview.webp',
];
const forbiddenPathPatterns = [
  /^src\//,
  /^\.github\//,
  /^docs\/superpowers\//,
  /^\.env(?:\.|$)/,
  /^node_modules\//,
  /(^|\/)package-lock\.json$/,
  /(^|\/)[^/]+\.map$/,
  /(^|\/)\.DS_Store$/,
];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function packageDryRun(destination) {
  const { stdout } = await execFileAsync(
    'npm',
    ['pack', '--dry-run', '--json', '--ignore-scripts', '--pack-destination', destination],
    { cwd: repositoryRoot },
  );
  const [manifest] = JSON.parse(stdout);
  invariant(manifest, 'npm pack --dry-run did not return package metadata');
  return manifest;
}

async function createTarball(destination) {
  const { stdout } = await execFileAsync(
    'npm',
    ['pack', '--json', '--ignore-scripts', '--pack-destination', destination],
    { cwd: repositoryRoot },
  );
  const [manifest] = JSON.parse(stdout);
  invariant(manifest?.filename, 'npm pack did not return a tarball filename');
  return { manifest, tarballPath: join(destination, manifest.filename) };
}

function verifyManifest(manifest) {
  invariant(manifest.name === 'datocms-plugin-tmdb-movie-importer', 'package name is incorrect');
  invariant(manifest.version === '0.1.0-next.0', 'package version is incorrect');
}

function verifyPackedFiles(files) {
  const packedPaths = new Set(files.map((file) => file.path));

  for (const requiredFile of requiredFiles) {
    invariant(packedPaths.has(requiredFile), `package is missing required file: ${requiredFile}`);
  }

  invariant(
    [...packedPaths].some((filePath) => /^dist\/assets\/[^/]+\.js$/.test(filePath)),
    'package is missing a built JavaScript asset',
  );
  invariant(
    [...packedPaths].some((filePath) => /^dist\/assets\/[^/]+\.css$/.test(filePath)),
    'package is missing a built CSS asset',
  );

  const forbiddenPath = [...packedPaths].find((filePath) => forbiddenPathPatterns.some((pattern) => pattern.test(filePath)));
  invariant(!forbiddenPath, `package contains forbidden file: ${forbiddenPath}`);
}

function verifyMarketplaceMetadata(manifest) {
  invariant(
    manifest.description === 'Import movie metadata, cast, crew, and images from TMDB into DatoCMS.',
    'package description is incorrect',
  );
  invariant(manifest.homepage === 'https://github.com/metrocinema/mcs-datocms-plugin', 'package homepage is incorrect');
  invariant(manifest.author === 'Metro Cinema', 'package author is incorrect');
  invariant(manifest.publisher === 'Metro Cinema', 'package publisher is incorrect');
  invariant(manifest.license === 'MIT', 'package license is incorrect');
  invariant(Array.isArray(manifest.keywords) && manifest.keywords.includes('datocms-plugin'), 'package keywords omit datocms-plugin');
  invariant(
    manifest.repository?.type === 'git' && manifest.repository.url === 'git+https://github.com/metrocinema/mcs-datocms-plugin.git',
    'package repository is incorrect',
  );
  invariant(
    manifest.bugs?.url === 'https://github.com/metrocinema/mcs-datocms-plugin/issues',
    'package bug tracker is incorrect',
  );
  const plugin = manifest.datoCmsPlugin;
  invariant(plugin?.title === 'TMDB Movie Importer', 'datoCmsPlugin.title is incorrect');
  invariant(plugin?.entryPoint === 'dist/index.html', 'datoCmsPlugin.entryPoint is incorrect');
  invariant(
    Array.isArray(plugin?.permissions) && plugin.permissions.length === 1 && plugin.permissions[0] === 'currentUserAccessToken',
    'datoCmsPlugin.permissions must contain only currentUserAccessToken',
  );
  invariant(plugin?.coverImage === 'docs/marketplace/cover.webp', 'datoCmsPlugin.coverImage is incorrect');
  invariant(plugin?.previewImage === 'docs/marketplace/preview.webp', 'datoCmsPlugin.previewImage is incorrect');
}

function assetReferences(html) {
  return [...html.matchAll(/<(?:script|link)\b[^>]+(?:src|href)="([^"]+)"[^>]*>/g)]
    .map((match) => match[1])
    .filter((reference) => reference.includes('assets/'));
}

async function verifyRelativeAssets(packageDirectory, packedFiles) {
  const html = await readFile(join(packageDirectory, 'dist/index.html'), 'utf8');
  const references = assetReferences(html);
  invariant(references.length >= 2, 'built entry point does not reference both JavaScript and CSS assets');

  const packedPaths = new Set(packedFiles.map((file) => file.path));
  let hasJavaScript = false;
  let hasCss = false;
  for (const reference of references) {
    invariant(reference.startsWith('./assets/'), `built asset is not relative: ${reference}`);
    invariant(!reference.includes('..'), `built asset escapes its entry point: ${reference}`);
    const packagePath = `dist/${reference.slice(2)}`;
    invariant(packedPaths.has(packagePath), `built entry point references missing asset: ${packagePath}`);
    hasJavaScript ||= reference.endsWith('.js');
    hasCss ||= reference.endsWith('.css');
  }
  invariant(hasJavaScript, 'built entry point has no relative JavaScript asset reference');
  invariant(hasCss, 'built entry point has no relative CSS asset reference');
  return references;
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
    invariant(address && typeof address !== 'string', 'nested package server did not provide a TCP port');
    const entryPoint = new URL(`${pathPrefix}dist/index.html`, `http://127.0.0.1:${address.port}`);
    const htmlResponse = await fetch(entryPoint);
    invariant(htmlResponse.status === 200, `nested entry point returned ${htmlResponse.status}`);

    const assetStatuses = await Promise.all(references.map(async (reference) => {
      const response = await fetch(new URL(reference, entryPoint));
      return { reference, status: response.status };
    }));
    const missingAsset = assetStatuses.find((asset) => asset.status !== 200);
    invariant(!missingAsset, `nested asset returned ${missingAsset?.status}: ${missingAsset?.reference}`);

    const jsStatus = assetStatuses.find((asset) => asset.reference.endsWith('.js'))?.status;
    const cssStatus = assetStatuses.find((asset) => asset.reference.endsWith('.css'))?.status;
    invariant(jsStatus === 200, 'nested JavaScript asset did not load');
    invariant(cssStatus === 200, 'nested CSS asset did not load');
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
