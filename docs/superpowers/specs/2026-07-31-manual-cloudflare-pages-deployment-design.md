# Manual Cloudflare Pages Deployment Design

## Goal

Move private-plugin deployments from a developer laptop into a reproducible GitHub Actions workflow without making every push to `main` a production deployment.

The workflow deploys the already-created Cloudflare Pages Direct Upload project named `tmdb-movie-importer`. Public DatoCMS Marketplace distribution remains a separate npm release process.

## Approaches considered

### Recommended: manually triggered GitHub Actions deployment

Use `workflow_dispatch` to build, verify, and deploy the selected `main` commit through Wrangler. Associate the job with a protected GitHub `production` environment and expose the stable Pages URL in the deployment record.

This keeps deployment explicit while moving build provenance, logs, and Cloudflare credentials into CI.

### Automatic deployment on every push to `main`

This is simpler, but it couples source integration to production release. A documentation-only or maintenance merge would deploy immediately, which conflicts with the project's separate merge and deployment authority.

### Cloudflare native Git integration

This provides automatic builds and previews, but the current Pages project was created as Direct Upload. Cloudflare does not allow that project to switch to native Git integration. Recreating the project would add migration risk without improving the controlled-release goal.

## Workflow contract

Add `.github/workflows/deploy-pages.yml` with these rules:

- Trigger only through `workflow_dispatch`.
- Fail clearly unless the selected ref is `main`.
- Use read-only repository contents permission and GitHub Deployments write permission.
- Associate the deployment job with the GitHub environment named `production`.
- Use the stable environment URL `https://tmdb-movie-importer.pages.dev/`.
- Prevent concurrent production deployments with a non-cancelling concurrency group.
- Check out the exact selected commit.
- Install the existing locked dependencies with `npm ci` on Node 25.
- Run `npm run verify:release` before any Cloudflare write.
- Deploy `dist` to `tmdb-movie-importer` with `cloudflare/wrangler-action@v3` and a pinned Wrangler 4 release.
- Pass the current commit SHA, commit message, clean-tree status, and `main` branch to the Pages deployment command.
- Supply GitHub's token so the action records a GitHub Deployment and exposes its output URL.

## Credentials and protection

The workflow reads two secrets from the `production` GitHub environment:

- `CLOUDFLARE_API_TOKEN`: a least-privileged token with Cloudflare Pages Edit access for the Tinch.Co account.
- `CLOUDFLARE_ACCOUNT_ID`: the Tinch.Co account identifier.

Credentials never enter source, build artifacts, workflow logs, or documentation. Environment protection and required reviewers are configured in GitHub, not encoded in the workflow.

The existing local user token must not be copied automatically into GitHub. A purpose-specific CI token should be created and stored separately.

## Documentation changes

Update `docs/release-guide.md` so private deployments are performed through the manual GitHub workflow. Retain local Wrangler deployment only as a documented recovery path, not the normal release procedure.

Document that triggering the workflow is a deployment action and does not update the DatoCMS plugin configuration automatically.

## Failure behavior

- A non-`main` dispatch fails before dependency installation or deployment.
- Missing credentials fail at the deploy step without exposing secret values.
- Any lint, test, type-check, build, or package-verification failure blocks deployment.
- Concurrency prevents two production uploads from racing; a queued deployment is not cancelled by a newer one.
- A Cloudflare failure leaves the previous successful production deployment in place.
- DatoCMS configuration is never changed by this workflow.

## Verification

Before merge:

1. Parse the workflow as YAML and inspect its effective trigger, permissions, environment, concurrency, verification command, and deployment command.
2. Run the existing test suite, lint/type checking, production build, package verifier, and `git diff --check`.
3. Confirm no credentials or account-token values appear in the diff.

After merge and credential setup:

1. Trigger the workflow from `main`.
2. Confirm the GitHub environment gate appears before deployment.
3. Confirm the workflow records commit SHA, deployment URL, and successful GitHub Deployment status.
4. Verify the stable Pages HTML, JavaScript, and CSS return HTTP 200.
5. Test the stable URL in the DatoCMS sandbox before changing any non-sandbox installation.

## Out of scope

- Automatic deployment on push or pull request.
- Preview deployments.
- Creating or rotating Cloudflare API tokens.
- Publishing the npm package or submitting the plugin to DatoCMS Marketplace.
- Updating any DatoCMS plugin entry-point URL.
- Deploying during workflow implementation.
