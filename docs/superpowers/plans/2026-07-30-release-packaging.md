# TMDB Movie Importer Release Packaging

## Goal

Prepare the existing plugin for both a stable Cloudflare Pages private installation and a public DatoCMS Marketplace release. The branch makes the repository release-ready but must not change GitHub visibility, deploy, publish to npm, or alter DatoCMS.

## Global Constraints

- Work on branch `codex/release-packaging` from the approved `main` baseline.
- Public product title: `TMDB Movie Importer`.
- npm package name: `datocms-plugin-tmdb-movie-importer`.
- Prepare version: `0.1.0-next.0`; the accepted public release will later become `0.1.0`.
- Public code license: MIT.
- DatoCMS package entry point: `dist/index.html`.
- DatoCMS additional permission: `currentUserAccessToken`.
- Cloudflare Pages project name: `tmdb-movie-importer`; initial production URL uses the generated `pages.dev` hostname.
- Releases are manually gated. CI validates but does not deploy or publish.
- Do not change importer behavior, the plugin configuration schema, or saved field mappings.
- Do not include tokens, environment files, production content, source maps, planning documents, or private identifiers in the npm package.
- Marketplace media must use sanitized harness fixtures.
- Do not make the GitHub repository public, deploy to Cloudflare, publish to npm, or change any DatoCMS installation during implementation.

## Task 1: Package Manifest and Portable Build

- Rename the package and add npm metadata: description, homepage, keywords including `datocms-plugin`, author/publisher, MIT license, repository, bugs URL, and restricted `files`.
- Add `datoCmsPlugin` metadata with the exact title, entry point, permission, cover path, and preview path.
- Remove `private`, set version `0.1.0-next.0`, and add release verification/prepack scripts.
- Pin all dependencies currently declared as `latest` to their installed lockfile versions and move build-only packages to `devDependencies`.
- Configure Vite with `base: './'` so the same build works at a Pages root and under DatoCMS's versioned CDN path.
- Disable production source maps so they cannot enter the package.
- Update the lockfile and add focused tests or verification for the manifest and relative build paths.
- Commit the task.

## Task 2: Public Identity, License, and Documentation

- Standardize user-facing product references on `TMDB Movie Importer`, retaining Metro Cinema as publisher.
- Add `LICENSE`, `CHANGELOG.md`, and a release guide covering private deployment, canary publication, promotion, rollback, and support.
- Expand the README with Marketplace and private installation, permissions and schema setup, frontend TMDB token visibility, the unsaved-form contract, and the private-to-Marketplace reinstall warning.
- Add TMDB's approved attribution/logo and required notice to the plugin configuration or credits area and documentation without implying endorsement.
- State that MIT covers plugin code, not TMDB data or imagery.
- Add or update focused tests for visible identity and attribution.
- Commit the task.

## Task 3: Sanitized Marketplace Media

- Create `docs/marketplace/cover.webp` and `docs/marketplace/preview.webp` from the fixture-based harness.
- Use only sanitized fixture data. Do not expose tokens, Metro Cinema project IDs, production records, browser chrome, or local paths.
- Ensure the images clearly communicate search, review, and import while remaining legible in Marketplace cards/details.
- Confirm both files are valid WebP assets and match the manifest paths.
- Commit the task.

## Task 4: Package Verification and CI

- Add a deterministic package verifier that checks required Marketplace metadata, required included files, relative built asset references, and forbidden package contents.
- Add GitHub Actions CI for clean install, tests, lint/typecheck, production build, package verification, and `npm pack --dry-run --json`.
- Keep CI free of deployment and npm publication credentials or steps.
- Run the full release checks.
- Create an npm tarball, inspect its manifest, extract it into a temporary directory, and serve the packaged entry point from a nested path to reproduce DatoCMS CDN behavior.
- Perform light and dark harness smoke checks.
- Commit the task.

## Final Review and Release Handoff

- Run a whole-branch code review against the starting `main` commit and fix all release-blocking findings.
- Do not merge automatically.
- Present the verified branch using the finishing-development-branch workflow.
- The later, separately approved rollout is:
  1. Merge the branch.
  2. Manually deploy the tagged build to Cloudflare Pages.
  3. Test the Pages-hosted private plugin in the DatoCMS sandbox.
  4. Audit Git history and packaged files, then make GitHub public.
  5. Publish `0.1.0-next.0` with npm tag `next` and validate through DatoCMS Developer Zone.
  6. Promote source to `0.1.0`, tag the matching commit, publish on `latest`, and verify the Marketplace listing.
  7. Keep Metro Cinema's private installation until a separately tested Marketplace migration is complete.
