# Task 1 Report: Package Manifest and Portable Build

## Status

Completed and ready to commit on `codex/release-packaging`.

## What changed

- Renamed the package to `datocms-plugin-tmdb-movie-importer` at version `0.1.0-next.0` and removed the private-package guard.
- Added Marketplace metadata, including the public title, DatoCMS entry point, required `currentUserAccessToken` permission, and future Marketplace image paths.
- Added npm discovery, ownership, repository, bug-reporting, and MIT-license metadata, plus an intentionally restricted package file list.
- Pinned every formerly `latest` dependency to the installed lockfile version and moved the Vite React plugin into `devDependencies`.
- Added `verify:release` and `prepack`; packaging now runs lint, the full test suite, and a production build before it creates an npm artifact.
- Set Vite `base` to `./` and disabled production source maps.
- Added a focused Vitest release-manifest regression suite that checks the Marketplace contract, dependency classification, resolved Vite config, and source-map setting.
- Updated `package-lock.json` and included the approved release-packaging plan.

## Commands and exact outcomes

- `npm install --package-lock-only --ignore-scripts` passed: `up to date`, `found 0 vulnerabilities`.
- `npm test -- --run src/releaseManifest.test.ts` initially failed as expected before the manifest and Vite changes: 3 failing tests for the missing Marketplace metadata, unpinned runtime dependencies, and `/` Vite base.
- `npm test -- --run src/releaseManifest.test.ts` passed after implementation: 1 test file, 3 tests.
- `npm run build` passed: typecheck passed; Vite emitted `dist/index.html`, one CSS asset, and one JS asset. The generated HTML refers to `./assets/...`, and no `.map` files were emitted.
- `npm run verify:release` passed: lint passed; 31 test files and 323 tests passed; production build passed.
- `npm pack --dry-run --json` passed and executed `prepack`, which reran the full release verification successfully. The current dry-run package contains only `README.md`, `dist/**`, and `package.json`; it contains no source maps.
- `git diff --check` passed.

## Files changed

- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `src/releaseManifest.test.ts`
- `docs/superpowers/plans/2026-07-30-release-packaging.md`
- `.superpowers/sdd/2026-07-30-release-packaging/task-1-report.md`

## Self-review

- Verified that all previously floating dependency declarations are pinned to their installed versions.
- Verified the Vite React integration is a build-only dependency and not shipped as a runtime dependency declaration.
- Verified the resolved Vite configuration and the real production artifact both use relative asset paths, which is the portability boundary for a versioned npm CDN path.
- Verified the package file allowlist excludes source code and source maps. The dry-run package has no `.map` entries.

## Concerns

- No task-local blocker. The declared `LICENSE`, `CHANGELOG.md`, and Marketplace image paths do not yet appear in the dry-run package because Tasks 2 and 3 create them. They must be present before the final release-package verification and publication.
