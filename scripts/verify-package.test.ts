import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(process.cwd());

describe('package verifier', () => {
  it('audits the real packed archive and serves its nested entry point', async () => {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ['scripts/verify-package.mjs'],
      { cwd: repositoryRoot },
    );

    expect(stderr).toBe('');
    expect(stdout).toContain('Package verification passed');
    expect(stdout).toMatch(/Packed entries: \d+/);
    expect(stdout).toContain('Nested serve: HTML 200, JS 200, CSS 200');
  }, 30_000);
});
