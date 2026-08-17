# TMDB Trailer Import Design

**Date:** 2026-08-17

**Status:** Implemented; sandbox acceptance pending

**Scope:** Import one best official English YouTube trailer from TMDB into a mapped DatoCMS External Video field

## Purpose

Extend the existing TMDB movie importer so an editor can review and apply one canonical trailer alongside movie metadata, people, and artwork. The feature must preserve the current editor-controlled workflow: no DatoCMS form value changes before confirmation, no automatic movie save or publish, and no new server-side service.

## Goals

- Retrieve trailer metadata as part of the existing TMDB movie-details request.
- Select one deterministic official English YouTube trailer.
- Map the result into DatoCMS's native External Video field shape.
- Show the recommendation in a compact, media-appropriate review section.
- Select the recommendation automatically only when the mapped DatoCMS field is empty.
- Leave the current movie value untouched when no qualifying trailer exists or the editor does not select the proposal.
- Keep the feature compatible with localized movie fields and the existing prepared-import boundary.

## Non-goals

- Importing multiple videos.
- Letting editors choose among several TMDB video candidates.
- Falling back to unofficial trailers, non-English trailers, teasers, clips, featurettes, or behind-the-scenes videos.
- Supporting Vimeo, Facebook, or other providers in the first version.
- Downloading or uploading video files into DatoCMS Media.
- Calling the YouTube API or YouTube oEmbed service.
- Saving or publishing the movie record.

## Current-system fit

The importer already loads a movie package with TMDB's `append_to_response`, normalizes provider data, compares mapped values, builds a reviewed import plan, prepares dependencies while the modal remains open, and applies prepared values to the unsaved DatoCMS form after the modal closes.

Trailer import extends those existing boundaries. It does not introduce a second network workflow, a new DatoCMS write path, or a new import phase.

## User decisions

- Import one best official trailer.
- If no official English YouTube trailer exists, do not fall back; leave the DatoCMS field unchanged.
- Select the proposed trailer automatically only when the current field is empty.
- Present the trailer in a compact section between **Field changes** and **Images**.
- Open the trailer on YouTube in a new browser tab instead of embedding playback in the modal.
- Use a native DatoCMS External Video field rather than a string or JSON field.

## Architecture

### TMDB request

Add `videos` to the existing movie-details `append_to_response` list. The request remains a single TMDB call:

`credits,release_dates,images,videos`

The movie package accepts a missing `videos` property for defensive compatibility. Missing or malformed video data normalizes to no trailer rather than failing the movie import.

### Provider response contract

The TMDB response adapter needs only these video-result properties:

- `id`
- `iso_639_1`
- `iso_3166_1`
- `key`
- `name`
- `official`
- `published_at`
- `site`
- `size`
- `type`

Unknown properties remain ignored.

### Normalized trailer contract

Add a provider-neutral normalized trailer value with:

- provider key
- provider video ID
- movie identity
- external provider
- external provider ID
- title
- watch URL
- thumbnail URL
- width
- height
- language
- country
- resolution
- publication date
- official status
- attribution

The first implementation produces only YouTube candidates from TMDB, but the normalized contract keeps TMDB identity separate from the external playback provider.

### Eligibility and ranking

A result is eligible only when all conditions are true:

1. `official` is `true`.
2. `iso_639_1` is `en`.
3. `site` is `YouTube`.
4. `type` is `Trailer`.
5. `id`, `key`, and `name` are non-empty strings.
6. The YouTube `key` contains only ASCII letters, digits, underscores, and hyphens.
7. `size` is a positive integer.

Do not restrict `iso_3166_1`; an official English trailer can qualify regardless of publishing country.

Sort eligible results by:

1. larger `size` first;
2. newer valid `published_at` first, with missing or invalid dates last;
3. TMDB video `id` in ascending lexical order as the stable final tie-breaker.

The first result after sorting is the proposed trailer. No alternate candidate list appears in the editor interface.

### DatoCMS External Video value

Convert the normalized winner into the native DatoCMS value:

- `provider`: `youtube`
- `provider_uid`: validated YouTube key
- `url`: `https://www.youtube.com/watch?v={key}`
- `title`: TMDB video name
- `thumbnail_url`: `https://i.ytimg.com/vi/{key}/hqdefault.jpg`
- `height`: TMDB `size`
- `width`: the nearest integer to `size × 16 ÷ 9`

The 16:9 dimensions describe the YouTube player frame. The embedded video may contain letterboxing for wider source material.

### Plugin configuration

Add an optional **Trailer field API name** mapping to the Movie model configuration.

- The mapping is valid only when the target field type is DatoCMS `video`.
- Localized video fields use the existing target-locale path behavior.
- If the mapping is absent, the plugin does not show or apply trailer data.
- If the mapping exists but targets an incompatible field, existing runtime configuration validation blocks the import with a field-specific error.

### Comparison and selection

Add `trailer` to the movie field keys and reviewed comparison model, but render it outside the scalar field table.

- `null` and `undefined` current values are empty.
- Two video values match when their provider and provider ID match. Differences in title, thumbnail URL, or dimensions alone do not create a proposed replacement.
- When the current field is empty and the candidate differs, select the proposal automatically.
- When the current field contains another video, leave the proposal unselected.
- When the current field already contains the same YouTube video, mark it unchanged and disable selection.
- Unchecking the proposed trailer leaves the current form value untouched.

### Import plan and prepared result

The selected trailer travels through the existing field-change collection, modal result serialization, mapping fingerprint validation, and prepared import. It does not create a dependency, an upload, or a new preparation phase.

After successful confirmation and preparation, the field extension applies the native External Video object to the unsaved movie form with the other selected values. The editor must still save or publish the movie in DatoCMS.

## Editor experience

### Review changes

Show **Trailer** between **Field changes** and **Images** only when the Trailer mapping is configured.

For an eligible proposed trailer, show a compact card containing:

- a 16:9 thumbnail or neutral fallback;
- trailer title;
- Official status;
- English language;
- resolution;
- publication date when available;
- current-value context;
- a selection checkbox;
- a **Preview on YouTube** link.

The thumbnail and preview link open the validated YouTube watch URL in a new tab with `noopener` and `noreferrer`. The modal does not embed a YouTube player.

When the current field has a different video, show its title and provider so the editor can understand the replacement. When the same YouTube video is already assigned, show **Already current trailer** and disable the proposal.

When no eligible result exists, show **No official English YouTube trailer found.** Do not show a disabled empty card or a fallback candidate.

If the thumbnail fails to load, replace it with a neutral **Preview unavailable** state while retaining the external preview link and selection control.

### Confirm import and sticky footer

Present the selected trailer separately from scalar fields and uploaded images. A representative footer is:

`7 fields · 1 trailer · 3 images · 2 new people · 1 reused person`

The Confirm import summary names the selected trailer and identifies the destination as the Trailer field. If no trailer is selected, omit the trailer segment rather than displaying a zero count.

### Progress

Trailer import adds no new progress phase. It is part of field preparation and the final form application. Existing search and import progress labels remain unchanged.

## Error handling

- A missing, empty, or malformed TMDB `videos` response becomes no proposal and does not block other movie data.
- An ineligible or malformed candidate is ignored.
- A failed thumbnail request affects only the preview presentation.
- A field-type mismatch is a configuration error detected before import.
- A DatoCMS form update failure uses the existing `form_failed` result and partial-application warning.
- If trailer application fails after Person creation or image uploads, those existing partial side effects remain covered by the current warning and recovery behavior.
- No error path may clear an existing trailer automatically.

## Security, privacy, and performance

- Reuse the existing frontend-visible TMDB read token and single movie-details request.
- Do not introduce a YouTube credential, YouTube API call, proxy, or downloaded video.
- Validate the YouTube key before constructing URLs.
- External links use safe new-tab attributes.
- Use one lazy-loaded thumbnail and the same offscreen-rendering discipline as other media previews where applicable.
- Do not load YouTube scripts, cookies, or embeds inside the plugin modal.

## Testing

### Provider and normalization tests

- The movie request appends `videos` without adding a second request.
- Missing `videos`, missing `results`, and malformed results do not throw.
- Eligibility requires official, English, YouTube, and Trailer values.
- Unofficial, non-English, non-YouTube, teaser, clip, and malformed-key candidates are excluded.
- Ranking prefers larger resolution, then newer publication date, then stable TMDB ID.
- DatoCMS URLs, thumbnail URL, width, and height are derived correctly.

### Configuration and comparison tests

- Trailer mapping accepts `video` and rejects incompatible field types.
- Localized and nonlocalized field paths are correct.
- Empty current values preselect a changed proposal.
- Existing different videos do not preselect replacement.
- Matching provider and provider ID produce an unchanged disabled state even when display metadata differs.
- Missing candidate data never clears a current value.

### Planning and execution tests

- Selected trailer data survives import-plan and modal serialization.
- Unselected, unchanged, missing, and unmapped trailers stay out of prepared field changes.
- The mapping fingerprint includes the Trailer destination.
- Applying a selected trailer produces the exact native External Video value at the correct field path.
- Existing Person and image planning, preparation, upload, and form application remain unchanged.

### UI tests

- The Trailer section appears in the correct location only when mapped.
- Empty, replacement, identical, no-result, and broken-thumbnail states render correctly.
- Selection follows the empty-field rule and remains keyboard accessible.
- Preview controls open the validated URL in a new tab with safe link attributes.
- Footer and confirmation summaries include a selected trailer without double-counting it as a scalar field.
- Light and dark DatoCMS themes remain readable.

### Manual DatoCMS sandbox acceptance

- Import into an empty External Video field and verify the native DatoCMS editor renders the result.
- Review a populated field and confirm replacement starts unselected.
- Select a replacement and verify it applies only after confirmation.
- Verify an already-current trailer is unchanged.
- Test a movie without an eligible official English YouTube trailer.
- Verify the preview opens YouTube without closing or resetting the modal.
- Verify localized mapping in the active target locale.
- Confirm the movie remains unsaved and unpublished until the editor saves it.

## Documentation impact

Implementation must update:

- the root README's supported field list, configuration instructions, editor flow, limits, and sandbox checklist;
- the Unreleased changelog;
- the documentation map if this design's status changes;
- sanitized TMDB fixtures and harness scenarios without production content or credentials.

## References

- [TMDB movie videos endpoint](https://developer.themoviedb.org/reference/movie-videos)
- [TMDB append-to-response guide](https://developer.themoviedb.org/docs/append-to-response)
- [DatoCMS External Video field type](https://www.datocms.com/docs/content-management-api/resources/field)
- [DatoCMS External Video value format](https://www.datocms.com/docs/content-management-api/resources/item)
