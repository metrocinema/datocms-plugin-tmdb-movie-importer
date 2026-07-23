# TMDB Movie Import Plugin Design

**Date:** 2026-07-21
**Status:** Approved design
**Scope:** Version-one DatoCMS plugin for importing and selectively refreshing movie data from TMDB

## Purpose

Build a DatoCMS field add-on that lets an editor find a movie on TMDB, review a field-by-field comparison, and apply only approved changes to the current movie form. The same workflow supports first-time imports and later refreshes.

TMDB is the canonical movie lookup and metadata provider. The plugin also defines a source-neutral image boundary so future providers can contribute posters and backdrops without changing the movie mapping, review interface, or DatoCMS upload pipeline. Version one ships only a TMDB image adapter.

## Product Principles

- An editor approves every change before the plugin writes it to the movie form.
- DatoCMS remains the permission and publishing authority.
- TMDB supplies candidate data; it does not automatically become published content.
- Existing editorial values are protected by default.
- Metadata and image sourcing have separate contracts.
- Version one stays frontend-only and does not introduce a separately deployed service.

## Version-One Scope

The plugin supports movie records only. It maps the following logical destinations, whose concrete DatoCMS fields are selected by an administrator:

| Destination | TMDB source | Expected DatoCMS shape |
| --- | --- | --- |
| Title | Movie `title` | String or localized string |
| Year released | Year from primary `release_date` | Integer |
| MPAA rating | Preferred non-empty US certification | String |
| Runtime | Movie `runtime` in minutes | Integer |
| TMDB ID | Movie `id` | Integer or compatible string |
| Tagline | Movie `tagline` | String or text, localized when configured |
| Description | Movie `overview` | Text or Structured Text, localized when configured |
| Poster | Selected normalized poster candidate | Single asset |
| Hero image | First selected normalized backdrop candidate | Single asset |
| Other images | Selected normalized backdrop candidates | Asset gallery |
| Directors | Crew members whose job is `Director` | Multiple links to the person model |
| Actors | Ordered cast, limited by configuration | Multiple links to the person model |

The content locale and TMDB language are fixed to US English for version one. When a mapped DatoCMS field is localized, the plugin writes only to the configured English locale and leaves other locales unchanged.

US certification selection prefers a non-empty certification attached to a theatrical release. If no theatrical certification exists, the normalizer falls back through other US release entries in a documented deterministic order. If no certification exists, MPAA rating is unavailable and the plugin does not invent one.

## Explicit Non-Goals

Version one does not include:

- TV series or episode imports
- Metadata providers other than TMDB
- Image providers other than TMDB
- A backend proxy
- Automatic movie saving or publishing
- Automatic publication of created person records
- Person profile-image imports
- Automatic deletion of records or uploads after a partial failure
- A dynamic third-party provider marketplace

## Architecture

The plugin uses TypeScript, React, the DatoCMS Plugin SDK, and DatoCMS React UI components. Data normalization, matching, mapping, and import planning remain plain TypeScript modules outside React.

### Field Add-on

A manual field add-on attaches to the mapped TMDB ID field. It reads the current movie form and presents one of two actions:

- **Find movie** when no TMDB ID is present
- **Refresh from TMDB** when a TMDB ID is present

The add-on seeds search with the current title and release year when available. It opens a large custom modal for the guided workflow.

### Guided Modal

The approved layout is a three-step flow:

1. **Search:** Search by title and optional year, or enter a TMDB ID directly. Show enough result context to distinguish similarly named movies.
2. **Review:** Compare current DatoCMS values with normalized TMDB values. Select fields, people, poster, and TMDB backdrop images for hero image and other images.
3. **Import:** Show the exact planned creates, uploads, links, and form changes. Require final confirmation before any DatoCMS side effect.

The modal returns an approved import result to the field add-on. The add-on applies final values through the form context. It does not save or publish the movie.

### Metadata Provider

The metadata-provider contract supplies one normalized movie package containing:

- TMDB movie ID
- Title
- Primary release date and derived year
- US certification data and selected rating
- Runtime
- Tagline
- Overview
- Ordered directors
- Ordered cast

The TMDB implementation searches movies and retrieves movie details with the required related resources, including credits, US release dates, and images. TMDB remains the canonical identity and metadata source even when future image providers are added.

### Image Provider Boundary

Each image provider returns normalized image candidates. A candidate contains:

- Provider key
- Provider-specific image ID or stable path
- Movie identity used for the lookup
- Image type: poster or backdrop
- Original image URL
- Width and height when available
- Language when available
- Provider ranking or ordering data
- Attribution or license information when supplied

The review UI, selection rules, deduplication strategy, and DatoCMS upload gateway consume only normalized candidates. Version one implements a TMDB adapter. A future adapter may add image candidates without changing metadata mapping or movie identity.

### DatoCMS Gateway

The gateway uses the current editor's DatoCMS access token and current environment. It performs schema reads, person queries and creates, and Media uploads under that editor's existing permissions.

The plugin requests the additional permission needed to receive the current-user access token. It does not store a separate project-wide DatoCMS API token.

Because version one calls TMDB directly from the browser, authenticated editors can inspect the configured TMDB read token. The configuration screen states this limitation plainly. A later server-side proxy may replace the TMDB transport without changing provider contracts or UI behavior.

## Plugin Configuration

An administrator configures:

- TMDB API read token
- Movie model
- TMDB ID field, which hosts the field add-on
- Destination field for every supported movie value
- English target locale when mapped fields are localized
- Shared person model
- Person name field
- Optional person TMDB ID field
- Default actor limit, initially 10

The configuration screen validates model relationships and field types. The plugin refuses to run when required mappings are missing or incompatible. Optional mappings may be omitted, in which case the corresponding TMDB value is excluded from review and import.

The directors and actors destinations must be multiple-link fields targeting the configured shared person model. The poster and hero image destinations must each accept one asset, and other images must accept multiple assets.

## Editor Behavior

### Search

Search uses the current title and release year as initial inputs when present. Editors can change either value or enter a TMDB ID. Adult results are excluded. Result selection does not write to DatoCMS.

### Field Review

Every mapped value displays its current DatoCMS value and proposed TMDB value.

- Empty destination fields are selected by default.
- Populated destination fields are unselected by default.
- A **Select all changes** control enables an intentional full refresh.
- Unchanged values remain visible but are not treated as writes.
- Missing TMDB values cannot be selected and never clear an existing DatoCMS value.

### Image Review

If the poster field is empty, the highest-ranked TMDB poster is preselected. If it is populated, no replacement poster is preselected.

If the other images field is empty, the five highest-ranked TMDB backdrops are preselected. If it is populated, no replacement backdrop images are preselected. Editors can preview candidates, change the selection, and select any number of available TMDB backdrops. When the hero image field is configured, the first selected backdrop also populates hero image.

Selected images are uploaded into DatoCMS Media and linked to the movie form. Uploads use stable source-aware filenames or metadata and DatoCMS duplicate detection where supported, allowing retries to reuse completed work.

### Person Matching

The shared person model currently requires only a name. The plugin supports an optional TMDB ID field as a safer upgrade path.

Matching follows this order:

1. Match by TMDB person ID when that field is configured and populated.
2. Otherwise match by exact normalized name. Normalization trims leading and trailing whitespace, collapses internal whitespace, applies Unicode normalization, and compares without case.
3. If one name match exists, propose reusing it and display the name-based-match warning.
4. If multiple name matches exist, require the editor to choose an existing record or create a new one.
5. If no match exists, propose a new draft person record.

After final confirmation, all approved missing people are created automatically as drafts. New records contain the name and, when configured, the TMDB person ID. They are not published automatically.

Directors retain TMDB crew order. Actors retain TMDB cast order and are truncated to the configured limit, which defaults to 10.

## Import Plan and Write Order

Before confirmation, the modal constructs an immutable import plan describing:

- Selected scalar and text field changes
- Existing person records to reuse
- Draft person records to create
- Image candidates to upload
- Final link and asset field values

No DatoCMS creates or uploads occur before the editor confirms this plan.

After confirmation, the importer executes in this order:

1. Revalidate required configuration and editor permissions.
2. Requery person matches to reduce race-condition duplicates.
3. Reuse existing people and create approved missing draft people.
4. Reuse or upload approved poster and backdrop assets.
5. Build final field values from resolved record and upload IDs.
6. Apply selected values to the unsaved movie form.
7. Show a completion summary and remind the editor that the movie is not yet saved or published.

Dependency side effects complete before movie-form updates begin. This prevents a form from receiving links to unresolved records or assets.

## Failure Handling and Retry Behavior

DatoCMS does not provide one transaction spanning record creation, Media uploads, and unsaved form state. The plugin therefore reports partial success instead of claiming atomic behavior.

- Configuration errors block the workflow before search.
- TMDB authentication failures identify the invalid-token problem.
- TMDB rate limits show a retryable message and preserve the current review state.
- Network failures preserve selections where possible and offer retry.
- Missing ratings, credits, or images remain unavailable rather than clearing existing content.
- Insufficient DatoCMS permissions block confirmation and identify the required operation.
- Person or image failures stop the import before movie-form updates.
- Form-update failures identify the fields already applied and those not applied.

The plugin does not automatically delete people or uploads created before a later failure. Deletion could remove content another editor has started using. The completion or failure summary lists created records and assets. A retry re-runs matching and duplicate detection so it can reuse completed work.

## Security and Permissions

- DatoCMS writes use the current editor's access token and are constrained by that editor's role.
- The plugin never requests or stores a separate DatoCMS CMA token.
- The TMDB read token is stored in plugin configuration and is visible to authenticated browser users in this frontend-only version.
- Error messages never print either access token.
- Logs omit tokens and avoid dumping raw authenticated request headers.
- Schema-edit permission is required to change plugin configuration or install its field add-on.

## Testing Strategy

### Unit Tests

Test plain TypeScript modules for:

- TMDB response normalization
- Primary release-year extraction
- Deterministic US certification selection
- Director extraction and ordering
- Actor ordering and configured limits
- Person-name normalization and matching decisions
- Image-candidate normalization
- Field comparison and default-selection rules
- Import-plan construction

### Contract and Fixture Tests

Use recorded, sanitized TMDB response fixtures for:

- Complete mainstream movie data
- Missing US certification
- Missing poster or backdrop images
- Empty or incomplete credits
- Multiple release certifications
- Localized and language-neutral image candidates
- Missing optional fields and malformed responses

Fixtures verify the provider contracts without relying on live TMDB availability in the normal test suite.

### Component Tests

Test:

- Search defaults and manual TMDB-ID lookup
- Three-step navigation
- Search-result selection
- Current-versus-proposed field display
- Empty-field and populated-field selection defaults
- Select-all behavior
- Poster and backdrop previews and selection
- Ambiguous person resolution
- Final confirmation and cancellation
- Permission, authentication, rate-limit, and partial-failure messages

### Integration Tests

With mocked TMDB and DatoCMS clients, prove that:

- No DatoCMS write occurs before final confirmation.
- Person resolution completes before asset and form references are built.
- Asset uploads complete before asset fields are updated.
- Only selected form fields change.
- Missing TMDB values never clear existing fields.
- Retry reuses existing people and duplicate assets.
- A dependency failure prevents movie-form updates.
- A form-update failure produces an accurate partial-result summary.

### Release Verification

Run type checking, linting, all automated tests, and a production build. Complete a manual acceptance pass in a DatoCMS sandbox project using a role that can create people and uploads, plus a restricted role that verifies permission failures.

## Acceptance Criteria

Version one is complete when an authorized editor can:

1. Configure compatible movie and person mappings without hard-coded API keys.
2. Launch the importer from the TMDB ID field.
3. Search by title and year or fetch directly by TMDB ID.
4. Review every mapped current and proposed value.
5. Select exactly which existing values to replace.
6. Reuse or create linked draft people safely.
7. Upload a selected poster and selected TMDB backdrops into DatoCMS Media.
8. Apply the approved values to the unsaved movie form.
9. Retry partial imports without unnecessary duplicate people or assets.
10. Complete the workflow without automatic movie saving or publishing.

The design is also successful when a second image-provider adapter can be implemented against the normalized image contract without changing TMDB metadata normalization, field mapping, the review flow, or DatoCMS upload behavior.

## Official API References

- [DatoCMS Plugin SDK field extensions](https://www.datocms.com/docs/plugin-sdk/field-extensions)
- [DatoCMS Plugin SDK modals](https://www.datocms.com/docs/plugin-sdk/modals)
- [DatoCMS form values](https://www.datocms.com/docs/plugin-sdk/working-with-form-values)
- [DatoCMS Content Management API record creation](https://www.datocms.com/docs/content-management-api/resources/item/create)
- [DatoCMS Content Management API uploads](https://www.datocms.com/docs/content-management-api/resources/upload/create)
- [TMDB movie search](https://developer.themoviedb.org/reference/search-movie)
- [TMDB append to response](https://developer.themoviedb.org/docs/append-to-response)
- [TMDB movie images](https://developer.themoviedb.org/reference/movie-images)
