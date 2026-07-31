# Manual Cloudflare Pages Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manually triggered, `main`-only GitHub Actions workflow that verifies and deploys the private TMDB Movie Importer build to the existing Cloudflare Pages project.

**Architecture:** GitHub Actions becomes the repeatable release runner for the existing Direct Upload Pages project. A guard job rejects non-`main` dispatches before the deployment job can access environment-scoped credentials; the deployment job runs the full release gate, serializes production uploads, and uses Wrangler to publish `dist` with commit metadata.

**Tech Stack:** GitHub Actions, Node.js 25, npm, Vitest, `yaml` 2.9.0, `cloudflare/wrangler-action@v3`, Wrangler 4.117.0, Cloudflare Pages Direct Upload.

## Global Constraints

- Deployment is manual through `workflow_dispatch`; pushes and pull requests never deploy.
- Only `refs/heads/main` can reach the production deployment job.
- The Cloudflare Pages project name is exactly `tmdb-movie-importer`.
- The stable environment URL is exactly `https://tmdb-movie-importer.pages.dev/`.
- Production credentials live only in the GitHub environment named `production`.
- The workflow requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` environment secrets.
- The existing local Cloudflare user token must not be copied into GitHub.
- Production deployments are serialized and an in-progress deployment is never cancelled by a newer dispatch.
- Every deployment runs `npm run verify:release` before Wrangler.
- This work does not update DatoCMS configuration, publish npm, or create automatic deployments.

---

### Task 1: Add and enforce the manual deployment workflow

**Files:**
- Create: `.github/workflows/deploy-pages.yml`
- Create: `scripts/deploy-pages-workflow.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: the existing `verify:release` npm script and the existing Cloudflare Pages project `tmdb-movie-importer`.
- Produces: a `workflow_dispatch` workflow with jobs named `guard` and `deploy`; the deploy job consumes `production` environment secrets and writes a GitHub Deployment through `GITHUB_TOKEN`.

- [ ] **Step 1: Add the YAML parser used by the workflow contract test**

Run:

```bash
npm install --save-dev yaml@2.9.0
```

Expected: `yaml` is added to `devDependencies`, and `package-lock.json` records version `2.9.0` without changing runtime dependencies.

- [ ] **Step 2: Write the failing workflow contract test**

Create `scripts/deploy-pages-workflow.test.ts`:

```ts
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
  runs-on?: string;
  environment?: { name?: string; url?: string };
  steps?: WorkflowStep[];
};

type Workflow = {
  on?: Record<string, unknown>;
  permissions?: Record<string, string>;
  concurrency?: { group?: string; cancel-in-progress?: boolean };
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
```

- [ ] **Step 3: Run the test and verify it fails because the workflow is absent**

Run:

```bash
npm test -- scripts/deploy-pages-workflow.test.ts
```

Expected: FAIL with `ENOENT` for `.github/workflows/deploy-pages.yml`.

- [ ] **Step 4: Add the minimal workflow**

Create `.github/workflows/deploy-pages.yml`:

```yaml
name: Deploy private plugin to Cloudflare Pages

on:
  workflow_dispatch:

permissions:
  contents: read
  deployments: write

concurrency:
  group: tmdb-movie-importer-production
  cancel-in-progress: false

jobs:
  guard:
    name: Validate deployment ref
    runs-on: ubuntu-latest
    steps:
      - name: Require main
        run: |
          if [[ "${GITHUB_REF}" != "refs/heads/main" ]]; then
            echo "::error::Production deployments must be dispatched from main."
            exit 1
          fi

  deploy:
    name: Deploy verified build
    needs: guard
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://tmdb-movie-importer.pages.dev/
    steps:
      - name: Checkout
        uses: actions/checkout@v6
      - name: Set up Node
        uses: actions/setup-node@v6
        with:
          node-version: 25
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Verify release
        run: npm run verify:release
      - name: Deploy to Cloudflare Pages
        id: deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          wranglerVersion: '4.117.0'
          command: >-
            pages deploy dist
            --project-name=tmdb-movie-importer
            --branch=main
            --commit-hash=${{ github.sha }}
            --commit-message="GitHub Actions deployment"
            --commit-dirty=false
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 5: Run the focused test and verify it passes**

Run:

```bash
npm test -- scripts/deploy-pages-workflow.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 6: Run the complete local release gate**

Run:

```bash
npm run verify:release
git diff --check
```

Expected: all tests, type checking, build, package verification, and diff checks pass; no Cloudflare deployment occurs.

- [ ] **Step 7: Commit the workflow contract**

```bash
git add .github/workflows/deploy-pages.yml scripts/deploy-pages-workflow.test.ts package.json package-lock.json
git commit -m "🚀 ci(deploy): add manual Pages workflow"
```

### Task 2: Make release documentation match the workflow

**Files:**
- Modify: `docs/release-guide.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: the workflow name `Deploy private plugin to Cloudflare Pages`, the GitHub environment name `production`, and the stable Pages URL.
- Produces: operator instructions that treat GitHub Actions as the normal private deployment path and local Wrangler as recovery-only.

- [ ] **Step 1: Replace the private deployment procedure**

In `docs/release-guide.md`, replace the current five-step `## Private deployment` section with:

```markdown
## Private deployment

The normal private release path is the manually triggered GitHub Actions workflow named **Deploy private plugin to Cloudflare Pages**.

1. Confirm the approved commit is present on `main`, the validation workflow passed, and the working release version is recorded.
2. Open the workflow in GitHub Actions, choose **Run workflow**, and select `main`. Triggering this workflow is the production deployment approval.
3. Confirm `npm run verify:release` passes before the Cloudflare deployment step begins.
4. Record the GitHub Actions run URL, commit SHA, Cloudflare deployment URL, and completion time.
5. Verify `https://tmdb-movie-importer.pages.dev/` and its JavaScript and CSS assets return HTTP 200.
6. Point only the intended DatoCMS sandbox private plugin at the stable Pages URL, then complete the README acceptance checklist with editor and restricted roles.
7. Preserve the previous successful Cloudflare deployment until support confirms the new private installation is stable.

The workflow does not update DatoCMS configuration. If GitHub Actions is unavailable, an authorized operator may run the full release gate locally and use Wrangler Direct Upload as a documented recovery action. Record the same commit and deployment evidence, and do not copy the local user API token into GitHub.
```

- [ ] **Step 2: Record the delivery change in the prerelease changelog**

Under `## 0.1.0-next.0 - 2026-07-30` → `### Added` in `CHANGELOG.md`, add:

```markdown
- A manually triggered, verified GitHub Actions deployment path for the private Cloudflare Pages installation.
```

- [ ] **Step 3: Verify documentation and release checks**

Run:

```bash
git diff --check
npm run verify:release
```

Expected: the diff is clean and all release checks pass.

- [ ] **Step 4: Commit the documentation**

```bash
git add docs/release-guide.md CHANGELOG.md
git commit -m "📝 docs(release): document manual Pages deployment"
```

### Task 3: Configure the private GitHub production environment

**Files:**
- No repository files.

**Interfaces:**
- Consumes: a merged and pushed workflow, GitHub admin access, the exact Cloudflare account ID `e71ac3e44e8561e43f5fc9e402b80d71`, and a new least-privileged Cloudflare Pages Edit token exposed locally as `TMDB_CLOUDFLARE_PAGES_TOKEN`.
- Produces: a `production` GitHub environment restricted to `main`, plus `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` environment secrets.

- [ ] **Step 1: Stop unless integration and credential authority are explicit**

Confirm the workflow commits are merged to and pushed on `main`. Confirm the release owner created a purpose-specific Cloudflare API token with Account → Cloudflare Pages → Edit and exported it locally:

```bash
test -n "${TMDB_CLOUDFLARE_PAGES_TOKEN:-}"
```

Expected: exit 0 with no token output. If it fails, stop and request the token setup; never paste the value into chat or logs.

- [ ] **Step 2: Create the environment with a custom branch policy**

Run:

```bash
gh api --method PUT \
  -H 'X-GitHub-Api-Version: 2026-03-10' \
  repos/metrocinema/mcs-datocms-plugin/environments/production \
  --input - <<'JSON'
{"wait_timer":0,"prevent_self_review":false,"reviewers":[],"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}
JSON
```

Expected: HTTP 200 and an environment named `production` with custom branch policies enabled.

- [ ] **Step 3: Restrict the environment to `main`**

Run:

```bash
gh api --method POST \
  -H 'X-GitHub-Api-Version: 2026-03-10' \
  repos/metrocinema/mcs-datocms-plugin/environments/production/deployment-branch-policies \
  -f name=main \
  -f type=branch
```

Expected: HTTP 200 with branch policy name `main`. If GitHub returns 303, verify that the existing policy is already exactly `main` and continue.

- [ ] **Step 4: Store the environment-scoped credentials without printing them**

Run:

```bash
printf '%s' 'e71ac3e44e8561e43f5fc9e402b80d71' | \
  gh secret set CLOUDFLARE_ACCOUNT_ID --env production --repo metrocinema/mcs-datocms-plugin

printf '%s' "$TMDB_CLOUDFLARE_PAGES_TOKEN" | \
  gh secret set CLOUDFLARE_API_TOKEN --env production --repo metrocinema/mcs-datocms-plugin
```

Expected: both commands succeed without printing secret values.

- [ ] **Step 5: Verify only secret names and branch policy**

Run:

```bash
gh secret list --env production --repo metrocinema/mcs-datocms-plugin
gh api \
  -H 'X-GitHub-Api-Version: 2026-03-10' \
  repos/metrocinema/mcs-datocms-plugin/environments/production/deployment-branch-policies \
  --jq '.branch_policies[] | {name, type}'
```

Expected: secret names `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are listed with no values, and the only branch policy is `{name: "main", type: "branch"}`.

- [ ] **Step 6: Run and verify the first CI-managed deployment**

Run only after separate deployment approval:

```bash
gh workflow run deploy-pages.yml --ref main --repo metrocinema/mcs-datocms-plugin
```

Watch the resulting run and verify it completes:

```bash
gh run watch --repo metrocinema/mcs-datocms-plugin --exit-status
```

Then verify the stable deployment:

```bash
curl --fail --silent --show-error --location --output /dev/null https://tmdb-movie-importer.pages.dev/
```

Expected: the workflow succeeds, GitHub records a production deployment for the selected `main` SHA, and the stable Pages URL returns HTTP 200.
