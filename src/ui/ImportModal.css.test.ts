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
});
