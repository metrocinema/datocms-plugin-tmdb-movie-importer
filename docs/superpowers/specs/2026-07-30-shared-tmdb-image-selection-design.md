# Shared TMDB Image Selection and Duplicate Suppression

**Date:** 2026-07-30
**Status:** Implemented with later revisions; retained as design history

## Current implementation revisions

The shared backdrop grid, mutually exclusive Hero image and Other images assignments, English-poster filtering, and independent ten-at-a-time reveal controls are implemented.

Three approved ideas below were intentionally superseded:

- Artwork is now fully opt-in. No poster or backdrop candidate starts selected; the explicit Poster and Hero **Do not import** cards start selected when those destinations are configured.
- The Review changes flow no longer downloads and fingerprints artwork for visual duplicate suppression. It preserves normalized TMDB candidates and avoids browser-side deduplication. The existing `checking_artwork` activity now covers lightweight sorting and filtering only; it does not represent fingerprint downloads.
- Image ordering now keeps English posters in TMDB rank order, while backdrops prioritize exact 3840x2160 candidates before applying TMDB rank, resolution, and stable-identity tie-breakers.

The grid uses smaller, lazily decoded preview images and offscreen rendering containment, while selected assets still upload from their original-resolution URLs. The remaining sections preserve the original approved design and should not override the root README or current source.

## Purpose

Replace the duplicated Hero Image and Other Images backdrop lanes with one shared backdrop grid. Each backdrop appears once and can be assigned to Hero Image, Other Images, or neither.

Remove the current first-ten data truncation. Instead, suppress visually identical TMDB images and reveal unique results in batches of ten.

## Product Decisions

- Poster remains a separate image section.
- Hero Image and Other Images share one Backdrops grid.
- A backdrop cannot be assigned to both destinations.
- Hero Image allows at most one backdrop.
- Other Images allows multiple backdrops.
- A backdrop may remain unassigned.
- Visually identical images are collapsed silently.
- The highest-resolution version represents each duplicate group.
- Duplicate alternatives are not displayed.
- Poster and backdrop results reveal ten unique candidates at a time.
- The plugin continues preselecting artwork.
- The feature remains frontend-only and does not change the DatoCMS schema or import payload.

## User Experience

### Poster

The Poster section keeps the existing native-inspired media cards and English-language filtering. It initially displays the first ten unique English posters in TMDB rank order.

If more unique posters exist, a muted `Show 10 more` button reveals the next ten. The current single-poster selection behavior remains unchanged.

### Shared Backdrops

The existing Hero Image and Other Images lanes become one Backdrops grid. Each card displays:

1. the complete, uncropped preview;
2. provider, dimensions, and language metadata;
3. a Hero Image radio control when that destination is mapped;
4. an Other Images checkbox when that destination is mapped.

When both destinations are mapped, both controls remain visible on every card. They are mutually exclusive for that card:

- choosing Hero Image removes that backdrop from Other Images;
- choosing Other Images clears that backdrop as Hero Image;
- clearing an Other Images checkbox leaves that backdrop unassigned;
- choosing `Do not import` clears the current Hero Image assignment.

Choosing Hero Image also moves the single global Hero assignment from the previously selected card. Other unrelated gallery selections remain unchanged.

The explicit `Do not import` Hero Image option remains available. When only one backdrop destination is mapped, cards show only the applicable control.

Selected cards retain the established DatoCMS-inspired selected border, surface, and ink. A card has only one destination status, so the UI no longer needs “Also Hero Image” or “Also in Other Images” chips.

### Defaults

When the corresponding DatoCMS destination is empty:

- preselect the highest-ranked unique English poster;
- preselect the highest-ranked unique backdrop as Hero Image;
- preselect the next five unique backdrops as Other Images, excluding the Hero Image.

Existing destination-value safeguards remain unchanged: the importer does not preselect replacements for populated DatoCMS image destinations.

### Incremental Reveal

Poster and backdrop sections each track their own visible count, beginning at ten. `Show 10 more` increases that section’s count by ten and disappears when every unique candidate is visible.

Assigned candidates remain rendered even if they fall outside the current visible batch. This prevents a selection from disappearing when returning from Confirm Import or when selection state changes.

This is incremental client-side reveal, not server pagination. TMDB already returns the image collection in the movie package.

## Duplicate Detection

### Definition

Duplicate suppression targets the same artwork encoded at different dimensions or compression levels. It does not attempt to group alternate crops, similar compositions, or different frames from the same scene.

Candidates may be grouped only when:

- they have the same image type;
- their aspect ratios differ by no more than one percent; and
- their 64-bit perceptual difference hashes have a Hamming distance of two or less.

The conservative threshold reduces the chance of hiding distinct stills.

### Fingerprinting

Add a browser-side artwork processor with a narrow interface:

- accept normalized image candidates;
- load a low-resolution analysis image;
- decode it into a fixed grayscale sample;
- compute a 64-bit difference hash;
- return the unique candidates in the existing rank order.

`NormalizedImageCandidate` gains an optional low-bandwidth analysis URL. TMDB supplies an appropriately small image URL for fingerprinting while preserving the existing preview and original URLs. Future image providers may supply their own analysis URL; candidates without one fall back to the preview URL.

The processor handles at most four image downloads or decodes concurrently. Hashes live only for the current modal session and are not written to DatoCMS or browser storage.

### Canonical Candidate

Within a duplicate group, choose the representative deterministically:

1. highest pixel area when dimensions are available;
2. best existing TMDB rank when areas match or cannot be compared;
3. provider key and provider image ID as a stable final tie-breaker.

The representative keeps its original normalized candidate identity and URLs. Downstream selection and import planning therefore continue using the existing `NormalizedImageCandidate` contract.

The duplicate group keeps the best rank among its members for display ordering. Choosing a higher-resolution representative must not push an otherwise highly ranked artwork group lower in the grid.

## Data Flow

1. Load the complete TMDB movie package.
2. Normalize and rank all posters and backdrops as today.
3. Filter posters to English-language candidates.
4. Fingerprint and deduplicate posters and backdrops independently.
5. Resolve Person matches and prepare artwork concurrently where practical.
6. Build default selections from the deduplicated candidates.
7. Render the Review Changes step using the deduplicated collection.
8. Build the existing import plan from the selected canonical candidates.
9. Upload original-resolution assets through the existing import executor.

The import plan and executor keep their defensive upload deduplication. The UI prevents Hero Image and Other Images overlap, but downstream code should not assume every caller obeys that UI invariant.

## Progress and Failure Handling

Add a `checking_artwork` search activity rendered as:

`Checking artwork…`

Artwork preparation and Person matching begin together as soon as the normalized movie is available. While artwork preparation is pending, the modal shows `Checking artwork…`. If Person matching remains pending afterward, the activity changes to the existing Person-matching label. This preserves a real artwork phase without serializing the two independent tasks.

Failure behavior is intentionally conservative:

- if one image cannot be fetched, decoded, or hashed, keep that candidate;
- do not group an unhashable candidate with another image;
- if the artwork processor fails as a whole, log a token-safe diagnostic and fall back to the ranked, non-deduplicated candidates;
- allow the movie to continue to Review Changes;
- preserve the existing blocking behavior for TMDB movie-load and Person-matching failures.

The safe fallback may show an occasional duplicate, but it must never hide artwork or block an import.

## Component Boundaries

### Artwork processor

A provider-facing module owns bounded image loading, fingerprinting, duplicate comparison, and canonical-candidate selection. Its pixel-loading dependency is injectable so grouping logic can be tested without browser image decoding.

### Default selection

`defaultImageSelection` consumes the processed candidate list and enforces the new exclusive defaults. It does not perform network or image work.

### Import modal orchestration

`ImportModal` coordinates movie loading, Person matching, artwork preparation, progress labels, and exclusive selection updates. Selection handlers enforce the destination invariant at the state boundary.

### Image picker

`ImagePicker` owns section-level reveal counts and presentation. A shared backdrop-card component renders the available destination controls without duplicating the preview.

The component must not embed provider-specific hashing or ranking rules.

## Accessibility

- Group the shared backdrop controls under a descriptive Backdrops heading.
- Give each Hero Image radio and Other Images checkbox a complete accessible name containing the destination, option number, provider, dimensions, language, and current status.
- Do not wrap both controls in one ambiguous clickable label.
- Preserve native inputs, keyboard operation, visible focus, and the existing minimum target size.
- Announce `Checking artwork…` through the existing search activity status.
- Give each `Show 10 more` button a section-specific accessible name.
- Preserve complete preview alternative text and fallback messaging.

## Testing

### Unit tests

- Identical artwork at different dimensions groups into one candidate.
- The highest-resolution candidate wins.
- Equal-resolution candidates use rank and stable identity tie-breakers.
- Posters and backdrops never group together.
- Aspect-ratio or hash-distance thresholds preserve distinct images.
- Fetch, decode, and hash failures keep the affected candidate.
- Whole-processor failure returns the ranked fallback collection.
- Concurrency never exceeds four active analysis jobs.
- Default selection excludes the Hero Image from Other Images.
- Default selection still respects populated DatoCMS destinations.

### Component tests

- The shared backdrop grid renders each candidate once.
- Hero Image selection removes that candidate from Other Images.
- Other Images selection clears that candidate as Hero Image.
- Moving Hero Image preserves unrelated Other Images selections.
- Hero-only and Other-Images-only field mappings render the correct controls.
- `Do not import` clears Hero Image.
- Poster and backdrop sections reveal ten more unique candidates independently.
- Selected candidates outside the first batch remain visible.
- Search progress displays `Checking artwork…`.
- Accessible names and keyboard behavior remain correct.

### Regression and browser verification

- Existing import-plan and upload tests continue to pass.
- Review and Confirm summaries report the correct destination counts.
- Original-resolution image URLs reach the existing upload executor.
- Verify the shared grid in light and DatoCMS dark themes.
- Verify normal, intermediate, and narrow modal widths.
- Verify selected, unselected, hover, focus, failed-preview, and empty states.
- Verify the harness and the DatoCMS sandbox.

## Non-Goals

- Showing duplicate alternatives
- Grouping alternate crops or merely similar images
- Server-side image analysis or caching
- Numbered server pagination
- Image sorting or filtering controls
- Changing English-only poster filtering
- Changing TMDB ranking
- Changing the DatoCMS field schema
- Changing upload concurrency or import-executor behavior
- Recreating DatoCMS private Media Area components

## Success Criteria

The feature is complete when:

- each unique backdrop appears once in one shared grid;
- no backdrop can be assigned to both Hero Image and Other Images;
- the plugin keeps the highest-resolution version of conservatively detected duplicates;
- users can progressively reveal every unique poster and backdrop;
- the approved default selections remain useful and exclusive;
- image-analysis failures never block movie review or hide an unverified candidate;
- automated tests, production build, harness review, and DatoCMS sandbox review pass.
