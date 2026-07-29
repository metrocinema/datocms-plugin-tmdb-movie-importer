# Import Progress States Design

**Date:** 2026-07-29
**Status:** Approved

## Decision

Add visible, phase-based progress feedback to TMDB search, movie loading, and import preparation.

Use the indeterminate `Spinner` provided by `datocms-react-ui`. Do not display estimated percentages or elapsed-time predictions. Import phases and completed-image counts must come from real operations.

Keep the import modal open while the slow DatoCMS work runs. Split import execution so the modal prepares people and assets, then the field-extension context applies the prepared values to the unsaved movie form after the modal closes.

## Context

The current Find Movie screen disables controls and changes button labels while requests are pending, but it does not provide a prominent loading state in the results area.

The current confirmation flow resolves the modal with an import plan before the slow import begins. The field-extension context then creates people, uploads images, and updates the form. This preserves access to `setFieldValue`, but it means the modal closes before most of the work starts.

DatoCMS' modal context does not expose item-form methods such as `setFieldValue`. The design must therefore keep form updates in the field-extension context while moving the slower, independently executable work into the modal.

## Find Movie Progress

### Title and year search

When a valid search starts:

1. Clear stale results.
2. Disable title search, TMDB ID lookup, and result-selection controls.
3. Show the native DatoCMS spinner in the results area.
4. Announce `Searching TMDB for “{title}”…` through an accessible live status.
5. Replace the loading state with results, the existing empty state, or a safe error.

### Movie loading

When an editor selects a result or loads a TMDB ID:

1. Replace the results area with the native spinner.
2. Show `Loading movie details…` while retrieving the TMDB movie package.
3. Show `Matching directors and actors…` while checking existing DatoCMS Person records.
4. Continue to Review Changes only after both operations succeed.

The interface must not leave stale, disabled results visible while a selected movie is loading.

## Import Progress

After the editor chooses Start Import, the confirmation content becomes a dedicated progress view within the same modal.

The progress view keeps:

- the existing modal frame and active Confirm Import step;
- the native indeterminate DatoCMS spinner;
- the sticky footer at its existing height;
- the left-side import summary;
- accessible live phase announcements.

The progress view reports these real phases:

- Matching existing people
- Creating draft people
- Uploading images
- Preparing movie field values

Person work and image work remain concurrent. The UI may therefore show more than one active phase. Image progress includes an actual completion count, such as `3 of 5 images uploaded`.

Once writes begin, Back and Start Import are unavailable. The footer must not resize when controls become disabled or are replaced with progress text.

## Execution Architecture

Split the existing executor into two explicit operations.

### Prepare import

`prepareImport` runs within the modal context and:

1. rechecks automatically matched people;
2. creates required draft Person records;
3. downloads and uploads selected images;
4. waits for DatoCMS asset processing;
5. returns a typed prepared result containing the original plan, resolved Person record IDs, and uploaded asset IDs keyed to their source image candidates.

The prepared result must not contain access tokens, TMDB credentials, source URLs, or other secrets.

### Apply prepared import

`applyPreparedImport` runs within the original field-extension context and:

1. revalidates the current plugin configuration and mapped fields;
2. converts prepared Person and asset IDs into current DatoCMS field values;
3. applies those values to the unsaved movie form with `setFieldValue`;
4. returns the existing success or form-failure result.

While this short final stage runs, the field add-on shows `Applying imported values…`. On success, the existing DatoCMS notice confirms that the import was applied to the unsaved movie.

## Progress Contract

Preparation emits typed progress events. Each event contains:

- a stable phase identifier;
- a state of `waiting`, `active`, `complete`, or `failed`;
- completed and total item counts when available;
- safe user-facing failure text when a phase fails.

Events must reflect actual operation boundaries. They must not estimate percentages.

Progress callbacks are presentation and diagnostic hooks. A callback failure must never interrupt an import.

## Completion and Error Handling

### Successful preparation

When preparation succeeds:

1. mark all modal preparation phases complete;
2. resolve and close the modal with the typed prepared result;
3. show `Applying imported values…` in the field add-on;
4. apply prepared values to the unsaved form;
5. show the existing success notice.

### Preparation failure

If Person creation or image upload fails:

- keep the progress modal open;
- mark the responsible phase failed;
- explain that draft people or uploaded assets may already exist;
- provide a safe Close action;
- do not automatically retry.

### Form-application failure

If applying prepared values fails after the modal closes:

- use the existing DatoCMS alert;
- report which values were applied when that information is available;
- explain that created drafts or uploaded assets may remain;
- do not automatically retry.

## Accessibility

- Loading and phase text uses an appropriate polite live region.
- Errors continue to use alert semantics.
- Spinner graphics are accompanied by meaningful text; the spinner alone is never the status.
- Pending controls are disabled to prevent duplicate requests and duplicate writes.
- Focus moves to the progress heading when import preparation begins.
- Reduced-motion preferences do not remove the status text or phase list.

## Testing

Automated coverage must prove:

- stale search results clear when a new search begins;
- the search spinner and live status remain visible until the request settles;
- movie-loading and Person-matching labels follow their actual operations;
- duplicate search and import actions are disabled while pending;
- preparation progress supports concurrent Person and image phases;
- image completion counts advance from actual completed uploads;
- preparation success returns a typed prepared result without applying form values in the modal;
- the field extension applies prepared values after the modal closes;
- preparation failures remain visible in the modal without automatic retry;
- form-application failures use the field-context error path;
- progress callback failures do not interrupt preparation.

Final verification includes the complete test suite, production build, and browser review of search, import progress, success, and failure states in light and dark DatoCMS themes.

## Non-Goals

- Determinate percentage progress
- Time-remaining estimates
- Cancellation after DatoCMS writes begin
- Automatic retry after partial writes
- Moving unsaved form updates into the modal context
- Changing the five-image upload concurrency limit
