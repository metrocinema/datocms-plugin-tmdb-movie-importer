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
    expect(ruleFor('.movie-import-modal__steps')).toContain('min-height: 60px');
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
    const footerRule = ruleFor('.movie-import-modal__image-option:has(input:checked) .movie-import-modal__image-footer');

    expect(cardRule).toContain('var(--color--selected--border');
    expect(cardRule).not.toContain('background: var(--color--selected--surface');
    expect(footerRule).toContain('var(--color--selected--surface');
    expect(footerRule).toContain('var(--color--selected--border');
    expect(footerRule).toContain('var(--color--selected--ink');
  });

  it('uses a neutral surface for unselected image cards', () => {
    const rule = rulesFor('.movie-import-modal__image-option')
      .find((candidate) => candidate.includes('cursor: pointer')) ?? '';

    expect(rule).toContain('background: var(--color--surface');
    expect(rule).not.toContain('--color--field-group-media--surface');
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
