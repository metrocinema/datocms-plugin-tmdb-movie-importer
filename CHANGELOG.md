# Changelog

All notable changes to TMDB Movie Importer are documented here.

## Unreleased

### Changed

- Made artwork imports fully opt-in. Poster, Hero image, and Other images now start unselected; the explicit Hero **Do not import** option starts selected when that destination is configured.
- Consolidated Hero image and Other images into one mutually exclusive backdrop grid while keeping Poster separate.
- Replaced first-ten truncation with independent ten-at-a-time reveal controls for posters and backdrops.
- Reduced Review changes image cost with smaller preview URLs, lazy asynchronous decoding, and offscreen card containment while retaining original-resolution uploads.
- Simplified image preparation to preserve TMDB-ranked candidates without browser-side visual fingerprinting.

### Fixed

- Kept the Hero **Do not import** option visible when TMDB returns no backdrop candidates.
- Hardened private release operations with a documented, least-privileged local Wrangler recovery path.

### Maintenance

- Stopped tracking local `.impeccable` critique and live-review artifacts.

## 0.1.0-next.0 - 2026-07-30

### Added

- A manually triggered, verified GitHub Actions deployment path for the private Cloudflare Pages installation.
- Release-ready Marketplace package metadata and portable build settings.
- Public installation and release-operation documentation.
- Required TMDB attribution and an approved TMDB logo in the configuration credits area.

### Changed

- Standardized the public product name as TMDB Movie Importer.

## License and third-party content

The MIT license applies to this plugin's code. TMDB data, artwork, logos, and other TMDB content are not covered by that license and remain subject to TMDB's terms and the rights of their respective owners.
