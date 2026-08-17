/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(process.cwd(), 'src/ui/ImportModal.css'), 'utf8');

function ruleFor(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{(?<body>[^}]*)\\}`));

  return match?.groups?.body ?? '';
}

function rulesFor(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return Array.from(css.matchAll(new RegExp(`${escapedSelector}\\s*\\{(?<body>[^}]*)\\}`, 'g')))
    .map((match) => match.groups?.body ?? '');
}

function mediaBodyFor(condition: string) {
  const start = css.indexOf(`@media ${condition}`);
  if (start === -1) {
    return '';
  }

  const openingBrace = css.indexOf('{', start);
  let depth = 0;

  for (let index = openingBrace; index < css.length; index += 1) {
    if (css[index] === '{') {
      depth += 1;
    } else if (css[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return css.slice(openingBrace + 1, index);
      }
    }
  }

  return '';
}

function ruleInMedia(condition: string, selector: string) {
  const mediaBody = mediaBodyFor(condition);
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = mediaBody.match(new RegExp(`${escapedSelector}\\s*\\{(?<body>[^}]*)\\}`));

  return match?.groups?.body ?? '';
}

describe('ImportModal.css accessibility tokens', () => {
  it('uses a Dato-style modal frame with fixed header, scroll body, and footer rows', () => {
    expect(ruleFor('.movie-import-modal')).toContain('height: 100vh');
    expect(ruleFor('.movie-import-modal')).toContain('overflow: hidden');
    expect(ruleFor('.movie-import-modal__step-frame')).toContain('grid-template-rows: auto minmax(0, 1fr) auto');
    expect(ruleFor('.movie-import-modal__step-frame')).toContain('height: 100%');
    expect(ruleFor('.movie-import-modal__chrome-header')).toContain('border-bottom: 1px solid var(--color--border)');
    expect(ruleFor('.movie-import-modal__chrome-header')).not.toContain('box-shadow');
    expect(ruleFor('.movie-import-modal__steps')).not.toContain('border-bottom');
    expect(ruleFor('.movie-import-modal__steps')).toContain('min-height: 52px');
    expect(ruleFor('.movie-import-modal__scroll-body')).toContain('overflow-y: auto');
    expect(ruleFor('.movie-import-modal__actions--sticky')).toContain('border-top: 1px solid var(--color--border)');
    expect(ruleFor('.movie-import-modal__actions--sticky')).toContain('min-height: 60px');
    expect(ruleFor('.movie-import-modal__actions--sticky')).toContain('position: relative');
  });

  it('defines a readable muted alias for Dato dark mode helper text', () => {
    expect(ruleFor('.movie-import-modal')).toContain('--movie-import-readable-muted');
  });

  it.each([
    '.movie-import-modal__intro',
    '.movie-import-modal__step',
    '.movie-import-modal__action-summary',
    '.movie-import-modal__section-kicker',
    '.movie-import-modal__section-help',
    '.movie-import-modal__field-placeholder',
    '.movie-import-modal__image-meta',
    '.movie-import-modal__empty',
  ])('%s uses readable muted text instead of raw Dato muted text', (selector) => {
    expect(ruleFor(selector)).toContain('var(--movie-import-readable-muted)');
    expect(ruleFor(selector)).not.toContain('var(--color--ink-muted)');
  });

  it('uses selected tokens for selected proposed field choices', () => {
    const rootRule = ruleFor('.movie-import-modal');
    const rule = ruleFor('.movie-import-modal__field-table-row--selected .movie-import-modal__field-table-choice');
    const inputRule = ruleFor('.movie-import-modal__field-table-row--selected .movie-import-modal__field-table-choice input');

    expect(rootRule).toContain('--movie-import-selected-control-surface');
    expect(rootRule).toContain('var(--color--selected--surface');
    expect(rule).toContain('var(--movie-import-selected-control-surface)');
    expect(rule).toContain('var(--movie-import-selected-control-border)');
    expect(rule).toContain('var(--movie-import-selected-control-ink)');
    expect(inputRule).toContain('accent-color: var(--movie-import-selected-control-border)');
  });

  it('styles the trailer review card with Dato tokens instead of light-only colors', () => {
    const trailerRule = ruleFor('.movie-import-modal__trailer-card');
    const previewRule = ruleFor('.movie-import-modal__trailer-preview');
    const selectedRule = ruleFor('.movie-import-modal__trailer-card--selected');
    const chipRule = ruleFor('.movie-import-modal__trailer-chip');
    const thumbRule = ruleFor('.movie-import-modal__trailer-thumb');

    expect(trailerRule).toContain('background: var(--color--surface-raised)');
    expect(trailerRule).toContain('border: 1px solid var(--color--border)');
    expect(previewRule).toContain('border: 1px solid var(--color--border)');
    expect(selectedRule).toContain('background: var(--movie-import-selected-control-surface)');
    expect(selectedRule).toContain('border-color: var(--movie-import-selected-control-border)');
    expect(selectedRule).toContain('color: var(--movie-import-selected-control-ink)');
    expect(chipRule).toContain('color: var(--color--ink-subtle)');
    expect(thumbRule).toContain('object-fit: contain');
    expect(`${trailerRule}${previewRule}${selectedRule}${chipRule}`).not.toMatch(/#|rgb\(|hsl\(|white|black/i);
  });

  it('aligns current field text with proposed field controls', () => {
    const currentRule = ruleFor('.movie-import-modal__field-table td.movie-import-modal__field-table-value');
    const proposedRule = ruleFor('.movie-import-modal__field-table td.movie-import-modal__field-table-proposed');
    const choiceRule = ruleFor('.movie-import-modal__field-table-choice');

    expect(currentRule).toContain('padding: calc(var(--spacing-xs) + var(--spacing-s) + 1px) var(--spacing-m) var(--spacing-s)');
    expect(proposedRule).toContain('padding: var(--spacing-xs)');
    expect(choiceRule).toContain('padding: var(--spacing-s)');
  });

  it('matches native MediaCard selected image states', () => {
    const cardRule = ruleFor('.movie-import-modal__image-option:has(input:checked)');
    const footerRule = ruleFor(`.movie-import-modal__image-option:has(input:checked)
  .movie-import-modal__image-footer--destinations`);

    expect(cardRule).toContain('0 0 0 3px var(--movie-import-selected-control-border)');
    expect(cardRule).not.toContain('background: var(--color--selected--surface');
    expect(footerRule).toContain('background: var(--movie-import-selected-control-surface)');
    expect(footerRule).toContain('border-color: var(--movie-import-selected-control-border)');
    expect(footerRule).toContain('color: var(--movie-import-selected-control-ink)');
  });

  it('uses neutral surface and border tokens for unselected image cards', () => {
    const rule = rulesFor('.movie-import-modal__image-option')
      .find((candidate) => candidate.includes('cursor: pointer')) ?? '';

    expect(rule).toContain('background: var(--color--surface');
    expect(rule).toContain('box-shadow: 0 0 0 1px var(--color--border)');
    expect(rule).toContain('content-visibility: auto');
    expect(rule).toContain('contain-intrinsic-size: auto 290px');
    expect(rule).not.toContain('--color--field-group-media--surface');
    expect(rule).not.toContain('--color--success');
  });

  it('stacks shared destination controls as independent native targets', () => {
    const footerRule = ruleFor('.movie-import-modal__image-footer--destinations');
    const destinationRule = ruleFor('.movie-import-modal__image-destination');
    const dividerRule = ruleFor('.movie-import-modal__image-destination + .movie-import-modal__image-destination');
    const focusRule = ruleFor('.movie-import-modal__image-destination:focus-within');

    expect(footerRule).toContain('display: grid');
    expect(footerRule).toContain('padding: 0');
    expect(destinationRule).toContain('display: flex');
    expect(destinationRule).toContain('min-height: 44px');
    expect(destinationRule).toContain('padding: var(--spacing-s)');
    expect(dividerRule).toContain('border-top: 1px solid var(--color--border)');
    expect(focusRule).toContain('var(--color--focus--outline)');
    expect(css).not.toMatch(/\.movie-import-modal__image-destination input\s*\{[^}]*appearance:/s);
  });

  it('aligns each reveal action below its own grid without changing card width', () => {
    const revealRule = ruleFor('.movie-import-modal__image-reveal');
    const wideRevealRule = ruleInMedia('(min-width: 720px)', '.movie-import-modal__image-reveal');
    const gridRule = ruleFor('.movie-import-modal__image-grid');
    const revealButtonRule = ruleFor('.movie-import-modal__image-reveal button');

    expect(revealRule).toContain('display: grid');
    expect(revealRule).toContain('gap: var(--spacing-l)');
    expect(revealRule).toContain('grid-template-columns: repeat(auto-fill, minmax(190px, 200px))');
    expect(revealRule).toContain('justify-content: start');
    expect(revealRule).toContain('margin-top: var(--spacing-m)');
    expect(revealRule).toContain('min-width: 0');
    expect(wideRevealRule).toContain('grid-column: 2');
    expect(revealButtonRule).toContain('width: 100%');
    expect(gridRule).toContain('grid-template-columns: repeat(auto-fill, minmax(190px, 200px))');
  });

  it('uses roomier native-style media card geometry without cropping previews', () => {
    const gridRule = ruleFor('.movie-import-modal__image-grid');
    const canvasRule = ruleFor('.movie-import-modal__image-canvas');
    const imageRule = ruleFor('.movie-import-modal__image-thumb');
    const posterRule = ruleFor('.movie-import-modal__image-thumb--poster');
    const backdropRule = ruleFor('.movie-import-modal__image-thumb--backdrop');

    expect(gridRule).toContain('gap: var(--spacing-l)');
    expect(gridRule).toContain('grid-template-columns: repeat(auto-fill, minmax(190px, 200px))');
    expect(gridRule).toContain('justify-content: start');
    expect(canvasRule).toContain('align-items: center');
    expect(canvasRule).toContain('height: 144px');
    expect(canvasRule).toContain('justify-content: center');
    expect(canvasRule).toContain('background: var(--color--surface');
    expect(imageRule).toContain('height: auto');
    expect(imageRule).toContain('max-height: 100%');
    expect(imageRule).toContain('max-width: 100%');
    expect(imageRule).toContain('object-fit: contain');
    expect(imageRule).toContain('width: auto');
    expect(posterRule).not.toContain('aspect-ratio');
    expect(backdropRule).not.toContain('aspect-ratio');
  });

  it('keeps a contained fixed preview canvas at narrow widths', () => {
    const condition = '(max-width: 540px)';
    const gridRule = ruleInMedia(condition, '.movie-import-modal__image-grid');
    const revealRule = ruleInMedia(condition, '.movie-import-modal__image-reveal');
    const previewRule = ruleInMedia(condition, '.movie-import-modal__image-preview');
    const canvasRule = ruleInMedia(condition, '.movie-import-modal__image-canvas');

    expect(gridRule).toContain('grid-template-columns: repeat(auto-fill, minmax(140px, 1fr))');
    expect(gridRule).toContain('min-width: 0');
    expect(revealRule).toContain('grid-template-columns: repeat(auto-fill, minmax(140px, 1fr))');
    expect(previewRule).toContain('padding: var(--spacing-m)');
    expect(canvasRule).toContain('height: 144px');
    expect(css).not.toContain('.movie-import-modal__destination-lane');
  });

  it('stacks the trailer card into one column at the existing narrow breakpoint', () => {
    const trailerRule = ruleInMedia('(max-width: 540px)', '.movie-import-modal__trailer-card');

    expect(trailerRule).toContain('grid-template-columns: 1fr');
  });

  it('allows modal steps to shrink without clipping before the compact layout takes over', () => {
    const frameRule = ruleFor('.movie-import-modal__step-frame');
    const headerRule = ruleFor('.movie-import-modal__chrome-header');
    const stepsRule = ruleFor('.movie-import-modal__steps');
    const stepRule = ruleFor('.movie-import-modal__step');
    const compactStepRule = ruleInMedia('(max-width: 480px)', '.movie-import-modal__step');

    expect(frameRule).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(frameRule).toContain('min-width: 0');
    expect(headerRule).toContain('min-width: 0');
    expect(stepsRule).toContain('box-sizing: border-box');
    expect(stepsRule).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(stepsRule).toContain('min-width: 0');
    expect(stepRule).toContain('min-width: 0');
    expect(stepRule).toContain('overflow-wrap: anywhere');
    expect(compactStepRule).toContain('min-height: 0');
  });

  it('keeps the modal stepper visually secondary to the page heading', () => {
    const stepRule = ruleFor('.movie-import-modal__step');
    const currentRule = ruleFor('.movie-import-modal__step--current');
    const markerRule = ruleFor('.movie-import-modal__step-marker');

    expect(stepRule).not.toContain('background: var(--color--surface)');
    expect(currentRule).not.toContain('background: var(--color--primary-soft--surface)');
    expect(currentRule).toContain('color: var(--color--ink)');
    expect(markerRule).toContain('border: 1px solid var(--color--border)');
  });

  it('groups the desktop steps on a compact centered connector rail', () => {
    const progressRule = ruleFor('.movie-import-modal__step-progress');
    const stepsRule = ruleFor('.movie-import-modal__steps');
    const railRule = ruleFor('.movie-import-modal__steps::before');
    const stepRule = ruleFor('.movie-import-modal__step');
    const markerRule = ruleFor('.movie-import-modal__step-marker');
    const compactRailRule = ruleInMedia('(max-width: 480px)', '.movie-import-modal__steps::before');

    expect(progressRule).toContain('padding: var(--spacing-xxs, 4px) var(--spacing-xl)');
    expect(stepsRule).toContain('max-width: 720px');
    expect(stepsRule).toContain('min-height: 52px');
    expect(stepsRule).toContain('position: relative');
    expect(railRule).toContain('background: var(--color--border)');
    expect(railRule).toContain('height: 1px');
    expect(railRule).toContain('left: calc(100% / 6)');
    expect(railRule).toContain('right: calc(100% / 6)');
    expect(stepRule).toContain('flex-direction: column');
    expect(stepRule).toContain('position: relative');
    expect(markerRule).toContain('background: var(--color--surface)');
    expect(markerRule).toContain('position: relative');
    expect(markerRule).toContain('z-index: 1');
    expect(compactRailRule).toContain('display: none');
  });

  it('typesets step labels and numeric progress metadata precisely', () => {
    const labelRule = ruleFor('.movie-import-modal__step-label');
    const markerRule = ruleFor('.movie-import-modal__step-marker');
    const compactPositionRule = ruleInMedia('(max-width: 480px)', '.movie-import-modal__step-summary-position');
    const compactSeparatorRule = ruleInMedia('(max-width: 480px)', '.movie-import-modal__step-summary-separator');

    expect(labelRule).toContain('line-height: 1.25');
    expect(labelRule).toContain('text-wrap: balance');
    expect(markerRule).toContain('font-variant-numeric: tabular-nums');
    expect(compactPositionRule).toContain('font-variant-numeric: tabular-nums');
    expect(compactSeparatorRule).toContain('font-size: var(--font-size-xs)');
    expect(compactSeparatorRule).toContain('line-height: 1.5');
  });

  it('collapses the stepper to an active-step summary and marker track on compact screens', () => {
    const condition = '(max-width: 480px)';
    const summaryRule = ruleInMedia(condition, '.movie-import-modal__step-summary');
    const labelRule = ruleInMedia(condition, '.movie-import-modal__step-label');
    const stepRule = ruleInMedia(condition, '.movie-import-modal__step');

    expect(summaryRule).toContain('display: flex');
    expect(labelRule).toContain('display: none');
    expect(stepRule).toContain('min-height: 0');
  });

  it('stacks Review fields and compacts the footer summary at narrow widths', () => {
    const condition = '(max-width: 540px)';
    const rowRule = ruleInMedia(condition, '.movie-import-modal__field-table tbody .movie-import-modal__field-table-row');
    const fieldRule = ruleInMedia(condition, `.movie-import-modal__field-table-field,
  .movie-import-modal__field-table-value,
  .movie-import-modal__field-table-proposed`);
    const valueRule = ruleInMedia(condition, '.movie-import-modal__field-table td.movie-import-modal__field-table-value');
    const summaryRule = ruleInMedia(condition, '.movie-import-modal__action-summary');

    expect(rowRule).toContain('grid-template-columns: 1fr');
    expect(fieldRule).toContain('grid-column: 1');
    expect(fieldRule).toContain('grid-row: auto');
    expect(valueRule).toContain('padding: 0');
    expect(summaryRule).toContain('display: grid');
    expect(summaryRule).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
  });

  it('keeps progress states token-based and readable on narrow screens', () => {
    const activeRule = ruleFor('.movie-import-modal__progress-phase--active');
    const completeRule = ruleFor('.movie-import-modal__progress-phase--complete');
    const failedRule = ruleFor('.movie-import-modal__progress-phase--failed');
    const footerRule = ruleFor('.movie-import-modal__actions--sticky');
    const narrowRule = ruleInMedia('(max-width: 540px)', '.movie-import-modal__progress-phase');
    const progressCss = [activeRule, completeRule, failedRule].join('\n');

    expect(progressCss).toContain('var(--color--');
    expect(footerRule).toContain('min-height: 60px');
    expect(progressCss).not.toMatch(/#[0-9a-f]{3,8}|rgb\(/i);
    expect(progressCss).not.toMatch(/background:\s*(?:white|#fff|rgb\()/i);
    expect(narrowRule).toContain('align-items: flex-start');
  });
});
