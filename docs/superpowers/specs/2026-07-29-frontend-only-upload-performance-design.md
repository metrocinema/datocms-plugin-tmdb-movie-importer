# Frontend-Only Upload Performance Design

**Date:** 2026-07-29  
**Status:** Approved

## Decision

Keep the movie importer frontend-only. Retain the guided, one-click import flow and allow at most five DatoCMS image uploads to run concurrently.

Do not add a serverless image-transfer service. Do not replace the guided image import with DatoCMS' separate Asset Source workflow.

## Context

The importer currently downloads selected TMDB artwork in the browser, transfers each file through a DatoCMS upload request, and waits for DatoCMS to finish asset processing before applying the resulting upload IDs to the movie form.

Observed timing showed:

- With three concurrent uploads, five images completed in roughly 19–20 seconds across two waves.
- With five concurrent uploads, the same shape of import completed in roughly 12–16 seconds in one wave.
- DatoCMS asset processing remained the dominant stage, taking roughly 8–12.5 seconds per image in the five-upload run.

The DatoCMS Content Management API requires a binary upload flow for normal uploads. Remote URL ingestion is available through the Plugin SDK's Asset Source hook, but that is a separate editor workflow and does not replace uploads inside the guided movie importer.

## Architecture

The existing boundaries remain unchanged:

1. The TMDB provider returns source-neutral image candidates.
2. The review step records the editor's poster, Hero image, and Other Images selections.
3. The import executor sends selected candidates to the Dato gateway with a concurrency limit of five.
4. The Dato gateway downloads, transfers, and waits for processing of each image.
5. The import executor preserves candidate order and applies completed upload IDs to the unsaved movie form.

The concurrency limit stays bounded. A sixth image waits until one of the five active uploads completes.

## Error Handling

- A failed image upload stops new work from being scheduled.
- Uploads already completed remain recorded in the partial-failure result.
- The plugin continues to warn that uploaded assets or created Person drafts may remain after a later failure.
- Performance reporting must never include credentials, source URLs, filenames, movie titles, or DatoCMS asset IDs.

## Performance Reporting

Keep the existing phase and per-image timing events for sandbox diagnostics:

- download
- upload request
- transfer
- asset processing
- total

The timings are diagnostic only. They do not change import behavior and callback failures must not interrupt an import.

## Testing

Automated coverage must prove:

- Five independent image uploads can start concurrently.
- A sixth image waits for a worker slot.
- Completed upload IDs retain the original candidate order.
- Partial successful uploads remain reported when another upload fails.
- Timing callbacks cannot cause an import to fail.

Final acceptance requires a sandbox import with five selected images and no upload errors. Performance is considered improved when the images complete in one wave. Exact duration is not a release gate because DatoCMS asset-processing time varies between runs.

## Deferred Options

Two alternatives remain intentionally deferred:

- A serverless transfer service, because it adds deployment, authentication, abuse-prevention, and observability work while DatoCMS processing remains the main delay.
- A TMDB Asset Source, because it is useful as a separate Media Area feature but would require editors to select images outside the guided movie-import flow.

## References

- [DatoCMS Content Management API: create an upload](https://www.datocms.com/docs/content-management-api/resources/upload/create)
- [DatoCMS Plugin SDK: Asset sources](https://www.datocms.com/docs/plugin-sdk/asset-sources)
