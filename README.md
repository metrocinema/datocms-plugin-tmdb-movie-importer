# MCS DatoCMS Plugin

TMDB movie import plugin for DatoCMS.

## Local development

Install dependencies and start the Vite development server:

    npm install
    npm run dev

Run the automated test suite and production checks:

    npm test
    npm run build

`npm run build` includes TypeScript checking. `npm run lint` currently runs the same TypeScript no-emit check as `npm run typecheck`.

## DatoCMS setup

1. Install the plugin in the DatoCMS project.
2. Configure the TMDB read token and the movie model API name.
3. Map the movie fields you want to import. Version one supports title, release year, MPAA rating, runtime, TMDB ID, tagline, description, poster, hero image, other images, directors, and actors.
4. Attach the field add-on to the mapped TMDB ID field on the movie model.
5. Configure the shared person model and its name field. A person TMDB ID field is optional but provides safer matching when available.
6. Configure the actor limit; it defaults to 10.

The importer validates required mappings before it runs. Optional unmapped movie fields are excluded from review and import. DatoCMS model and field API names are stable schema identifiers, not secret tokens.

## Security note

This frontend-only version exposes the TMDB read token to authenticated editors who can inspect the browser application. It never stores or requests a DatoCMS CMA token; DatoCMS permissions come from the current editor context.

## Editor flow

1. Open the field add-on on the TMDB ID field and choose **Find movie** or **Refresh from TMDB**.
2. Search by title and optional year, or retrieve a movie by TMDB ID.
3. Review the proposed changes and choose the fields, people, poster, and selected TMDB backdrop images to apply. Empty destination fields are selected by default; populated fields are not. Missing TMDB values cannot be selected and never clear existing content.
4. Confirm the import. The plugin creates required people as drafts, uploads selected images, and applies the approved values to the unsaved movie form.
5. Manually save or publish the movie in DatoCMS. The plugin does not save or publish the movie record.

## Verification

Run the local release checks:

    npm test
    npm run typecheck
    npm run lint
    npm run build

Normal automated tests use mocked DatoCMS interactions and sanitized TMDB fixtures; they do not call live DatoCMS or TMDB.
`npm run lint` currently repeats the TypeScript no-emit check run by `npm run typecheck`.

Before release, complete this manual acceptance checklist in a DatoCMS sandbox project. Use a movie model with the configured mappings, a shared person model with `name` and optional `tmdb_id`, an editor role that can create items and uploads, and a restricted role that lacks at least one required permission.

- [ ] An authorized editor can configure mappings.
- [ ] The field add-on opens from the TMDB ID field.
- [ ] Search by title and year works.
- [ ] Direct TMDB ID refresh works.
- [ ] Empty fields are selected by default and populated fields are unselected by default.
- [ ] Missing TMDB values cannot clear existing content.
- [ ] Ambiguous people require an editor choice.
- [ ] Missing people are created as drafts.
- [ ] The poster and selected TMDB backdrop images upload to DatoCMS Media.
- [ ] The first selected TMDB backdrop populates Hero image when that field is configured.
- [ ] The movie form changes, but the record is not saved or published.
- [ ] A restricted role receives a permission error before movie form updates.
