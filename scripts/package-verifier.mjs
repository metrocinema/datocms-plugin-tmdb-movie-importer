import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const requiredFiles = [
  'package.json',
  'README.md',
  'LICENSE',
  'CHANGELOG.md',
  'docs/release-guide.md',
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

export function verifyManifest(manifest) {
  invariant(manifest.name === 'datocms-plugin-tmdb-movie-importer', 'package name is incorrect');
  invariant(manifest.version === '0.1.0-next.0', 'package version is incorrect');
}

export function verifyPackedFiles(files) {
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

export function verifyMatchingPackedFiles(dryRunFiles, tarballFiles) {
  const dryRunPaths = new Set(dryRunFiles.map((file) => file.path));
  const tarballPaths = new Set(tarballFiles.map((file) => file.path));
  const differences = [
    ...[...tarballPaths]
      .filter((path) => !dryRunPaths.has(path))
      .sort()
      .map((path) => `added ${path}`),
    ...[...dryRunPaths]
      .filter((path) => !tarballPaths.has(path))
      .sort()
      .map((path) => `removed ${path}`),
  ];

  invariant(
    differences.length === 0,
    `npm pack dry-run and tarball file lists differ: ${differences.join(', ')}`,
  );
}

export function verifyMarketplaceMetadata(manifest) {
  invariant(
    manifest.description === 'Import movie metadata, cast, crew, images, and trailers from TMDB into DatoCMS.',
    'package description is incorrect',
  );
  invariant(manifest.homepage === 'https://github.com/metrocinema/datocms-plugin-tmdb-movie-importer', 'package homepage is incorrect');
  invariant(manifest.author === 'Metro Cinema', 'package author is incorrect');
  invariant(manifest.publisher === 'Metro Cinema', 'package publisher is incorrect');
  invariant(manifest.license === 'MIT', 'package license is incorrect');
  invariant(Array.isArray(manifest.keywords) && manifest.keywords.includes('datocms-plugin'), 'package keywords omit datocms-plugin');
  invariant(
    manifest.repository?.type === 'git' && manifest.repository.url === 'git+https://github.com/metrocinema/datocms-plugin-tmdb-movie-importer.git',
    'package repository is incorrect',
  );
  invariant(
    manifest.bugs?.url === 'https://github.com/metrocinema/datocms-plugin-tmdb-movie-importer/issues',
    'package bug tracker is incorrect',
  );
  const plugin = manifest.datoCmsPlugin;
  invariant(plugin?.title === 'Movie Importer', 'datoCmsPlugin.title is incorrect');
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

export async function verifyRelativeAssets(packageDirectory, packedFiles) {
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
