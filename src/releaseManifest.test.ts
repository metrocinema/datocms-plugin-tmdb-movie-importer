import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { resolveConfig } from 'vite';
import { describe, expect, it } from 'vitest';
import viteConfig from '../vite.config';

type PackageManifest = {
  name?: string;
  version?: string;
  private?: boolean;
  description?: string;
  homepage?: string;
  keywords?: string[];
  author?: string;
  publisher?: string;
  license?: string;
  repository?: { type?: string; url?: string };
  bugs?: { url?: string };
  files?: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  datoCmsPlugin?: {
    title?: string;
    entryPoint?: string;
    permissions?: string[];
    coverImage?: string;
    previewImage?: string;
  };
};

async function readManifest() {
  const content = await readFile(resolve(process.cwd(), 'package.json'), 'utf8');
  return JSON.parse(content) as PackageManifest;
}

async function readLicense() {
  return readFile(resolve(process.cwd(), 'LICENSE'), 'utf8');
}

describe('release package manifest', () => {
  it('declares the Marketplace package contract and excludes source files', async () => {
    const manifest = await readManifest();

    expect(manifest).toMatchObject({
      name: 'datocms-plugin-tmdb-movie-importer',
      version: '0.1.0-next.0',
      description: 'Import movie metadata, cast, crew, and images from TMDB into DatoCMS.',
      homepage: 'https://github.com/metrocinema/mcs-datocms-plugin',
      author: 'Metro Cinema',
      publisher: 'Metro Cinema',
      license: 'MIT',
      repository: {
        type: 'git',
        url: 'git+https://github.com/metrocinema/mcs-datocms-plugin.git',
      },
      bugs: {
        url: 'https://github.com/metrocinema/mcs-datocms-plugin/issues',
      },
      datoCmsPlugin: {
        title: 'TMDB Movie Importer',
        entryPoint: 'dist/index.html',
        permissions: ['currentUserAccessToken'],
        coverImage: 'docs/marketplace/cover.webp',
        previewImage: 'docs/marketplace/preview.webp',
      },
    });

    expect(manifest.private).toBeUndefined();
    expect(manifest.keywords).toContain('datocms-plugin');
    expect(manifest.files).toEqual([
      'dist',
      'README.md',
      'LICENSE',
      'CHANGELOG.md',
      'docs/release-guide.md',
      'docs/marketplace/cover.webp',
      'docs/marketplace/preview.webp',
    ]);
    expect(manifest.scripts).toMatchObject({
      'verify:package': 'node scripts/verify-package.mjs',
      'verify:release': 'npm run lint && npm test && npm run build && npm run verify:package',
      prepack: 'npm run verify:release',
    });
  });

  it('pins runtime packages and keeps the Vite React plugin build-only', async () => {
    const manifest = await readManifest();

    expect(manifest.dependencies).toMatchObject({
      '@datocms/cma-client': '5.5.5',
      'datocms-plugin-sdk': '2.2.6',
      'datocms-react-ui': '2.2.6',
      react: '19.2.8',
      'react-dom': '19.2.8',
    });
    expect(manifest.dependencies?.['@vitejs/plugin-react']).toBeUndefined();
    expect(manifest.devDependencies).toMatchObject({
      '@vitejs/plugin-react': '6.0.3',
      '@testing-library/jest-dom': '7.0.0',
      '@testing-library/react': '16.3.2',
      '@testing-library/user-event': '14.6.1',
      '@types/node': '26.1.1',
      '@types/react': '19.2.17',
      '@types/react-dom': '19.2.3',
      jsdom: '29.1.1',
      typescript: '7.0.2',
      vite: '8.1.5',
      vitest: '4.1.10',
    });
  });

  it('builds with relative asset paths and no source maps', async () => {
    const config = await resolveConfig(viteConfig, 'build', 'production');

    expect(config.base).toBe('./');
    expect(config.build.sourcemap).toBe(false);
  });

  it('keeps the MIT grant for plugin code while excluding bundled TMDB assets and content', async () => {
    const license = await readLicense();

    expect(license).toContain('Permission is hereby granted, free of charge');
    expect(license).toContain('The MIT license above applies only to original TMDB Movie Importer plugin code and documentation created by Metro Cinema.');
    expect(license).toContain('The bundled TMDB logo, TMDB trademarks, TMDB data, TMDB images, and other TMDB content are excluded from this MIT license.');
    expect(license).toContain('They remain governed by their respective owners and the TMDB API Terms of Use.');
  });
});
