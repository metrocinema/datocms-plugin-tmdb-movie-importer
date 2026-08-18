# Changelog

All notable changes to Movie Importer are documented here.

## Unreleased

### Added

- Added optional native Trailer import for official English YouTube trailers, mapped to a DatoCMS External Video field without embedding or uploading video.
- Added an editor-controlled trailer picker with full candidate cards, the current DatoCMS trailer as a choice, matching-trailer deduplication, and arrow-key, Home, and End navigation.

### Changed

- Made artwork imports fully opt-in. Poster, Hero image, and Other images now start unselected; explicit Poster and Hero **Do not import** options start selected when those destinations are configured.
- Consolidated Hero image and Other images into one mutually exclusive backdrop grid while keeping Poster separate.
- Replaced first-ten truncation with independent ten-at-a-time reveal controls for posters and backdrops.
- Reduced Review changes image cost with smaller preview URLs, lazy asynchronous decoding, and offscreen card containment while retaining original-resolution uploads.
- Prioritized 3840x2160 backdrops before other backdrop candidates while preserving TMDB rank order inside each group.
- Simplified image preparation to preserve TMDB-ranked candidates without browser-side visual fingerprinting.
- Standardized the public product name as Movie Importer while retaining the existing technical package, repository, and deployment identifiers.
- Refreshed the Marketplace cover with a thumbnail-first Movie Importer logotype and updated the preview to show the current trailer picker and opt-in image state.

### Fixed

- Corrected Review and Confirm draft Person counts and names when the same automatically matched TMDB person appears in multiple roles.
- Kept the Poster and Hero **Do not import** options visible when TMDB returns no candidates for those destinations.
- Hardened private release operations with a documented, least-privileged local Wrangler recovery path.

### Maintenance

- Stopped tracking local `.impeccable` critique and live-review artifacts.

## 0.1.0-next.0 - 2026-07-30

### Added

- A manually triggered, verified GitHub Actions deployment path for the private Cloudflare Pages installation.
- Release-ready Marketplace package metadata and portable build settings.
- Public installation and release-operation documentation.
- Required TMDB attribution and an approved TMDB logo in the configuration credits area.

## License and third-party content

The MIT license applies to this plugin's code. TMDB data, artwork, logos, and other TMDB content are not covered by that license and remain subject to TMDB's terms and the rights of their respective owners.
