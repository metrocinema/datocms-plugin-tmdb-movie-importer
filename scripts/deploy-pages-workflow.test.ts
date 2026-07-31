import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

type WorkflowStep = {
  name?: string;
  id?: string;
  if?: string;
  uses?: string;
  run?: string;
  with?: Record<string, string>;
};

type WorkflowJob = {
  needs?: string;
  'runs-on'?: string;
  environment?: { name?: string; url?: string };
  steps?: WorkflowStep[];
};

type Workflow = {
  on?: Record<string, unknown>;
  permissions?: Record<string, string>;
  concurrency?: { group?: string; 'cancel-in-progress'?: boolean };
  jobs?: Record<string, WorkflowJob>;
};

async function readWorkflow() {
  const source = await readFile(
    resolve(process.cwd(), '.github/workflows/deploy-pages.yml'),
    'utf8',
  );
  return parse(source) as Workflow;
}

describe('manual Cloudflare Pages deployment workflow', () => {
  it('has no automatic trigger and rejects non-main dispatches before deployment', async () => {
    const workflow = await readWorkflow();
    const guard = workflow.jobs?.guard;

    expect(Object.keys(workflow.on ?? {})).toEqual(['workflow_dispatch']);
    expect(guard?.['runs-on']).toBe('ubuntu-latest');
    expect(guard?.steps).toEqual([
      {
        name: 'Require main',
        run: 'if [[ "${GITHUB_REF}" != "refs/heads/main" ]]; then\n  echo "::error::Production deployments must be dispatched from main."\n  exit 1\nfi\n',
      },
    ]);
  });

  it('verifies the release before a serialized production deployment', async () => {
    const workflow = await readWorkflow();
    const deploy = workflow.jobs?.deploy;
    const steps = Object.fromEntries((deploy?.steps ?? []).map((step) => [step.name, step]));

    expect(workflow.permissions).toEqual({ contents: 'read', deployments: 'write' });
    expect(workflow.concurrency).toEqual({
      group: 'tmdb-movie-importer-production',
      'cancel-in-progress': false,
    });
    expect(deploy?.needs).toBe('guard');
    expect(deploy?.environment).toEqual({
      name: 'production',
      url: 'https://tmdb-movie-importer.pages.dev/',
    });
    expect(steps['Install dependencies']?.run).toBe('npm ci');
    expect(steps['Verify release']?.run).toBe('npm run verify:release');
    expect(steps['Deploy to Cloudflare Pages']).toMatchObject({
      id: 'deploy',
      uses: 'cloudflare/wrangler-action@v3',
      with: {
        apiToken: '${{ secrets.CLOUDFLARE_API_TOKEN }}',
        accountId: '${{ secrets.CLOUDFLARE_ACCOUNT_ID }}',
        wranglerVersion: '4.117.0',
        command: 'pages deploy dist --project-name=tmdb-movie-importer --branch=main --commit-hash=${{ github.sha }} --commit-message="GitHub Actions deployment" --commit-dirty=false',
        gitHubToken: '${{ secrets.GITHUB_TOKEN }}',
      },
    });
  });
});
