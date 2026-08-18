# Documentation map

Use this index to distinguish current operating documentation from implementation history and future work. When a dated plan or specification conflicts with the current application, [`README.md`](../README.md), [`CHANGELOG.md`](../CHANGELOG.md), the current source, and automated tests are authoritative.

## Current documentation

- [`README.md`](../README.md): current product behavior, schema setup, local development, known limits, and the manual DatoCMS sandbox checklist.
- [`CHANGELOG.md`](../CHANGELOG.md): user-facing and operational changes by release state.
- [`release-guide.md`](release-guide.md): active private-deployment, Marketplace, rollback, and support runbook. It prepares release work but does not authorize it.
- [`marketplace/cover.webp`](marketplace/cover.webp) and [`marketplace/preview.webp`](marketplace/preview.webp): sanitized package-listing artwork. The cover uses a thumbnail-first Movie Importer logotype. The preview shows the current trailer picker with no image destinations selected.
- [`marketplace/cover-source.svg`](marketplace/cover-source.svg): editable source for the rasterized Marketplace cover. DatoCMS does not accept SVG cover files, so the packaged cover remains WebP.

## Implemented design records

- [`TMDB Trailer Import Design`](superpowers/specs/2026-08-17-tmdb-trailer-import-design.md): original design record for importing an official English YouTube trailer into a native DatoCMS External Video field. The current implementation extends it with an editor-controlled multi-candidate picker.
- [`TMDB Trailer Import Implementation Plan`](superpowers/plans/2026-08-17-tmdb-trailer-import.md): implementation record for trailer import verification and release evidence. One deployed replacement flow passed sandbox acceptance; the README lists the remaining cases.

## Planned work

- [`TMDB Asset Source Implementation Plan`](superpowers/plans/2026-07-25-tmdb-asset-source.md): planned native DatoCMS Media Area source. It is not implemented and may require a separately approved server-side image path if direct TMDB URLs fail the DatoCMS CORS requirement.

## Historical implementation records

These plans and specifications preserve product decisions and implementation context. They are not a checklist of current deployment or live-acceptance status.

### Core importer and modal

- [`TMDB Movie Import Plugin Design`](superpowers/specs/2026-07-21-tmdb-movie-import-plugin-design.md)
- [`TMDB Movie Import Plugin Plan`](superpowers/plans/2026-07-21-tmdb-movie-import-plugin.md)
- [`Find Movie Modal UI Redesign`](superpowers/specs/2026-07-23-find-movie-modal-ui-redesign.md)
- [`Find Movie Modal UI Redesign Plan`](superpowers/plans/2026-07-23-find-movie-modal-ui-redesign.md)
- [`Field Review Table Layout Plan`](superpowers/plans/2026-07-24-field-review-table-layout.md)

### Feedback, progress, and performance

- [`Import Progress States Design`](superpowers/specs/2026-07-29-import-progress-states-design.md)
- [`Import Progress States Plan`](superpowers/plans/2026-07-29-import-progress-states.md)
- [`Import Feedback, Search Actions, and Mobile Review Plan`](superpowers/plans/2026-07-29-import-feedback-search-mobile-repairs.md)
- [`Frontend-Only Upload Performance Design`](superpowers/specs/2026-07-29-frontend-only-upload-performance-design.md)
- [`Frontend-Only Upload Performance Plan`](superpowers/plans/2026-07-29-frontend-only-upload-performance.md)

### DatoCMS-native modal and media presentation

- [`Native Media Preview Design`](superpowers/specs/2026-07-30-native-media-preview-design.md)
- [`Native Media Preview Plan`](superpowers/plans/2026-07-30-native-media-preview.md)
- [`Native Media Card Density Design`](superpowers/specs/2026-07-30-native-media-card-density-design.md)
- [`Native Media Card Density Plan`](superpowers/plans/2026-07-30-native-media-card-density.md)
- [`Modal Step Header Layout Design`](superpowers/specs/2026-07-30-modal-step-header-layout-design.md)
- [`Modal Step Header Layout Plan`](superpowers/plans/2026-07-30-modal-step-header-layout.md)
- [`Modal Step Header Typesetting Design`](superpowers/specs/2026-07-30-modal-step-header-typesetting-design.md)
- [`Modal Step Header Typesetting Plan`](superpowers/plans/2026-07-30-modal-step-header-typesetting.md)
- [`Shared TMDB Image Selection Design`](superpowers/specs/2026-07-30-shared-tmdb-image-selection-design.md): implemented with later revisions; see the document's current-implementation note.
- [`Shared TMDB Image Selection Plan`](superpowers/plans/2026-07-30-shared-tmdb-image-selection.md)

### Packaging and private deployment

- [`Release Packaging Plan`](superpowers/plans/2026-07-30-release-packaging.md)
- [`Manual Cloudflare Pages Deployment Design`](superpowers/specs/2026-07-31-manual-cloudflare-pages-deployment-design.md)
- [`Manual Cloudflare Pages Deployment Plan`](superpowers/plans/2026-07-31-manual-cloudflare-pages-deployment.md)

## Living-doc surfaces not currently used

This project does not currently have `CURRENT_STATE.md`, `TODO.md`, or `DECISIONS.md`. Their responsibilities remain intentionally compact:

- current behavior and known limits live in the root README;
- release history lives in the changelog;
- active release operations live in the release guide;
- planned work and historical decisions live in this indexed plan/spec library.
