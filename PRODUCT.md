# Product

## Register

product

## Platform

web

## Users

The primary users are DatoCMS editors importing or refreshing movie records while they are already in a content-entry workflow. They need to identify the right TMDB movie, inspect proposed metadata, choose which values to apply, and keep editorial control before anything affects the unsaved movie form.

Secondary users are site admins and maintainers who configure the plugin: TMDB access, movie-field mappings, person-model matching, actor limits, and field add-on placement. Their job is to make the editor workflow safe and predictable without requiring custom code for each movie record.

## Product Purpose

This plugin safely imports and refreshes TMDB movie data inside DatoCMS. It helps editors move faster on repetitive movie metadata entry while protecting existing editorial values, DatoCMS permissions, and the normal save/publish workflow.

Success means an editor can confidently find a movie, review field changes, resolve people, choose poster and backdrop images, apply approved values to the unsaved DatoCMS movie form, and still decide when the movie record is saved or published.

## Positioning

A DatoCMS-native movie importer that treats TMDB as a source of candidates, not as automatic published truth.

## Brand Personality

Native, calm, and precise. The interface should feel like it belongs inside DatoCMS: quiet, task-focused, and trustworthy. It should reduce anxiety around external data, partial side effects, and unsaved editorial work without becoming wordy or hand-holdy.

## Anti-references

Do not make the plugin feel like a separate SaaS product embedded in DatoCMS. Avoid decorative dashboards, marketing-style cards, loud visual branding, custom controls that fight DatoCMS React UI patterns, and wizard chrome that draws attention away from the editor’s content decision.

Avoid hiding important data-flow rules behind clever interactions. Hero image selection must be explicit rather than a side effect of backdrop selection order.

## Design Principles

- **Feel native first.** Prefer DatoCMS React UI components, tokens, spacing, and interaction vocabulary before inventing custom presentation.
- **Make editorial control visible.** Every write should feel reviewed, intentional, and reversible until the editor chooses to save or publish the movie.
- **Expose side effects honestly.** People and uploads can be created before form updates complete; copy should explain that without panic.
- **Separate choices that editors think of separately.** Hero image and Other images both come from backdrops today, but the editor should choose them as distinct content destinations.
- **Design for evidence, not hope.** Add a standalone visual review harness before deep polish so browser critique, accessibility checks, and screenshots can inspect real UI states without relying on the production DatoCMS iframe.

## Accessibility & Inclusion

Target WCAG AA for contrast, focus visibility, keyboard access, and understandable error recovery. Support reduced-motion expectations by avoiding decorative motion. Keep warnings close to the action they affect, and do not rely on color alone to communicate selected, disabled, warning, or error states.
