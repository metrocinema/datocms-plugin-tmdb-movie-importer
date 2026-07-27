import { describe, expect, it } from 'vitest';
import { harnessDesignTokens, harnessScenario, harnessTheme, isDevHarnessRequest, screenForHarnessMode } from './devHarness';

describe('devHarness', () => {
  it('supports a Dato dark theme mode for sandbox-accurate visual review', () => {
    expect(harnessTheme('http://127.0.0.1:5174/?impeccable=modal&theme=dato-dark')).toBe('dato-dark');
  });

  it('does not activate the standalone visual harness when embedded inside DatoCMS', () => {
    expect(isDevHarnessRequest('http://127.0.0.1:5174/?impeccable=modal', true)).toBe(false);
  });

  it('uses captured DatoCMS dark color values for dato-dark visual review', () => {
    const tokens = harnessDesignTokens('dato-dark');

    expect(tokens['--color--primary--surface']).toBe('oklch(0.3292 0.1714 288)');
    expect(tokens['--color--selected--surface']).toBe('oklch(0.3292 0.1714 288)');
    expect(tokens['--color--selected--border']).toBe('oklch(0.52 0.2 288)');
    expect(tokens['--color--ink-muted']).toBe('oklch(0.385 0.012 288)');
    expect(tokens['--color--surface']).toBe('oklch(0.2028 0.012 288)');
  });

  it('supports an Odyssey existing-values modal scenario', async () => {
    expect(harnessScenario('http://127.0.0.1:5174/?impeccable=modal&scenario=odyssey-existing')).toBe('odyssey-existing');

    const screen = screenForHarnessMode('modal', 'odyssey-existing');
    expect(screen.type).toBe('modal');
    if (screen.type !== 'modal') return;

    await expect(screen.searchMovies({ title: 'The Odyssey', year: 2026 })).resolves.toMatchObject([
      { id: 1368337, title: 'The Odyssey', releaseDate: '2026-07-17' },
    ]);
    await expect(screen.loadMovie(1368337)).resolves.toMatchObject({ tmdbId: 1368337, title: 'The Odyssey' });
    expect(screen.initialTitle).toBe('The Odyssey');
    expect(screen.initialYear).toBe(2026);
    expect(screen.currentValues).toMatchObject({
      title: 'The Odyssey',
      tmdbId: 1368337,
      runtime: 172,
      mpaaRating: 'R',
    });
  });
});
