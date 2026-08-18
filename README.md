# Movie Importer

Movie Importer is a Metro Cinema plugin for DatoCMS. It lets editors find a movie, review selected TMDB metadata, people, an optional trailer, and images, then apply the approved values to the current unsaved movie form.

## Current implementation

The package is currently version `0.1.0-next.0`. The plugin provides configuration, a TMDB ID field add-on, a guided Find movie → Review changes → Confirm import modal, phase-specific preparation progress, draft Person creation or reuse, selected image uploads, optional native Trailer field updates, and unsaved movie-form updates.

Artwork selection is opt-in. No poster or backdrop candidate starts selected. When Poster or Hero image is configured, the explicit **Do not import** card starts selected. Poster candidates are limited to English-language artwork. Posters are revealed ten at a time in TMDB rank order, while backdrops prioritize 3840x2160 candidates before falling back to TMDB rank order. A backdrop can be assigned to Hero image or Other images, but never both.

Trailer import presents every eligible official English YouTube trailer returned by TMDB in a single-choice card grid. The existing DatoCMS trailer, or an explicit empty-field option, starts selected so an import never changes the Trailer field without an editor choosing a TMDB candidate. A matching current trailer is deduplicated from the TMDB choices. The cards support arrow keys plus Home and End, open preview links on YouTube, and never embed or upload video.

The trailer picker is covered by the automated release gate. A deployed DatoCMS sandbox replacement flow also confirmed that one selected trailer and selected metadata persisted in the unsaved movie form without importing images, creating people, saving, or publishing. That evidence applies to deployed commit `094dc0934e004b62fb80185a2d912bcf70dabcdb`. The later **Movie Importer** rename is merged only into local `main` as of August 18, 2026; it has not been pushed, deployed, or accepted in DatoCMS. The current-only/no-alternatives case, matching-trailer deduplication, restricted-role behavior, image imports, and the rest of the Marketplace acceptance matrix remain pending.

The repository contains a manually triggered Cloudflare Pages deployment workflow, but source, build, push, deployment, DatoCMS installation, and sandbox acceptance are separate states. A checkout or passing test suite does not prove that a Pages deployment or DatoCMS installation is current.

## Installation

### Private installation

Use the private Cloudflare Pages deployment only after it has been manually deployed and tested in a DatoCMS sandbox. Add the approved Pages URL as a private plugin in the intended DatoCMS project, configure its settings, and attach the field add-on to the movie model's TMDB ID field.

### Marketplace installation

When the package is published, install `datocms-plugin-tmdb-movie-importer` from DatoCMS Marketplace or Developer Zone. Use the released package version approved for the project.

Private and Marketplace installations are distinct. Do not remove or assume the private installation is replaced when you install from Marketplace. Treat the migration as a separate, tested reinstall: record settings, install the Marketplace package in a sandbox, re-enter configuration, reattach the field add-on if required, verify imports, then schedule removal of the private installation.

## Permissions and schema setup

The plugin declares the DatoCMS `currentUserAccessToken` permission and uses the current editor's DatoCMS access. It does not store or request a separate DatoCMS CMA token. Editors need the project permissions required to read the configured schema, create draft Person records, upload selected images, and update the current movie form.

Configure these stable DatoCMS API names in the plugin settings:

1. A movie model and the desired movie fields. Version one supports title, release year, MPAA rating, runtime, TMDB ID, tagline, description, Trailer, poster, Hero image, Other images, directors, and actors. If you map Trailer, use a DatoCMS External Video (`video`) field.
2. A shared Person model and its name field. A Person TMDB ID field is optional but gives safer matching when available.
3. An actor limit, which defaults to 10.
4. The TMDB ID field add-on on the movie model. It supports string, integer, and float fields so existing schemas need not change solely for the plugin.

Required mappings are validated before an import begins. Unmapped optional fields stay out of the review and import flow.

## TMDB token visibility

This is a frontend-only plugin. Its TMDB read token is stored in the plugin settings and can be inspected through browser tools by editors who can use the plugin. Use a token with the narrowest appropriate TMDB access, rotate it if an editor should no longer have access, and do not treat it as a server-side secret.

## Current limits

- The plugin does not provide a native DatoCMS Media Area asset source. That feature remains planned but is not part of the current package.
- The review grid does not download or fingerprint artwork to detect visually identical files. TMDB can therefore return visually similar candidates. The plugin preserves TMDB ordering for posters and non-preferred backdrops, prioritizes 3840x2160 backdrops, and uses resolution and stable identity as tie-breakers when ranks match.
- The plugin uploads original-resolution images only after an editor selects them. Smaller preview URLs and lazy loading keep the Review changes grid responsive without reducing upload quality.

## Editor flow and unsaved-form contract

1. Open the TMDB ID field add-on and choose **Find movie** or **Refresh from TMDB**.
2. Search by title and optional year, or load a known TMDB ID.
3. Review each proposed value and choose the fields, optional trailer, people, poster, Hero image, and Other images to prepare. No artwork is selected automatically.
4. Confirm the import. The modal stays open while the plugin matches or creates selected people, uploads selected images, and prepares movie-field values. After successful preparation, it closes and applies the prepared values to the current DatoCMS movie form.
5. Save or publish the movie yourself in DatoCMS.

The plugin never saves or publishes the movie record. If a later import phase fails after people or images were created, those drafts or uploads can remain in DatoCMS and need intentional review.

## Local development

Install dependencies with `npm install`, then start the Vite server with `npm run dev`. For standalone UI review outside the DatoCMS iframe, open `http://localhost:5174/?impeccable=modal`.

The harness uses sanitized fixture data and resolves the import plan in the browser only. It does not write to DatoCMS or call TMDB. Add `&theme=dato-dark` to inspect the captured DatoCMS dark token set.

Run `npm test` for the automated suite and `npm run verify:release` for the full local release gate. Automated tests use mocked DatoCMS interactions and sanitized TMDB fixtures; they do not call live DatoCMS or TMDB.

## Manual sandbox acceptance

Before any release, use a DatoCMS sandbox with configured mappings, a shared Person model with `name` and optional `tmdb_id`, an editor role that can create items and uploads, and a restricted role that lacks at least one required permission.

- [ ] An authorized editor can configure mappings.
- [ ] The field add-on opens from the TMDB ID field.
- [ ] Search by title and year works.
- [ ] Direct TMDB ID refresh works.
- [ ] Empty metadata fields are selected by default and populated metadata fields are unselected by default.
- [ ] Missing TMDB values cannot clear existing content.
- [ ] An empty Trailer field starts with **Keep trailer empty** selected, and the editor can choose one eligible TMDB trailer.
- [ ] An existing Trailer appears as the selected **Keep current trailer** card, and the editor can choose a different eligible TMDB trailer.
- [ ] A TMDB trailer that matches the current Trailer is deduplicated; if it is the only match, the UI says no alternatives are available.
- [ ] Arrow keys move through trailer choices, and Home and End move to the first and last choices.
- [ ] No eligible TMDB trailer leaves the current Trailer value untouched.
- [ ] Trailer preview opens on YouTube in a new tab, and no trailer embed or upload appears in the modal.
- [ ] Ambiguous people require an editor choice.
- [ ] Missing people are created as drafts.
- [ ] No poster or backdrop starts selected, and **Do not import** starts selected for Poster and Hero image.
- [ ] Poster and backdrop results initially show ten candidates and reveal additional candidates ten at a time.
- [ ] A backdrop cannot be selected for both Hero image and Other images.
- [ ] The selected poster, Hero image, and Other images upload to DatoCMS Media.
- [ ] The explicit Hero image selection populates Hero image when that field is configured.
- [ ] The movie form changes, but the record is not saved or published.
- [ ] A restricted role receives a permission error before movie form updates.

## Release operations

Read [the release guide](docs/release-guide.md) before a private deployment, Marketplace canary, promotion, rollback, or support handoff. Those activities require separate release authority.

## TMDB attribution and license

This product uses the TMDB API but is not endorsed or certified by TMDB.

TMDB attribution and an approved logo appear in the plugin configuration credits area. The logo is used only to identify TMDB as the API and content source; it does not imply TMDB endorsement, certification, or approval.

MIT covers this plugin's code. It does not cover TMDB data, images, trademarks, or logo assets. Those materials remain subject to [TMDB's API Terms of Use](https://www.themoviedb.org/api-terms-of-use) and the rights of their respective owners.
