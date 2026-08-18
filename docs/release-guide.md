# Movie Importer release guide

This guide prepares a release. It does not authorize any deployment, publication, GitHub visibility change, or DatoCMS installation change.

## Evidence boundary

The repository proves that the manual deployment workflow and release checks exist. A push to `main` does not deploy this plugin because the Pages workflow requires an explicit GitHub Actions dispatch. GitHub production-environment restrictions, repository secrets, Cloudflare project state, deployment success, and DatoCMS sandbox acceptance live outside the repository and must be checked and recorded for each release.

## Current readiness snapshot

As of August 18, 2026:

- `origin/main` and the stable Cloudflare Pages deployment are at `094dc0934e004b62fb80185a2d912bcf70dabcdb`.
- Local `main` includes the **Movie Importer** rename through merge commit `0661969d0804d8e17e7d4225edf535e2d7b66782`. The rename and this documentation reconciliation have not been pushed, deployed, or accepted in DatoCMS.
- One trailer-replacement import against the deployed commit selected **Official Countdown Trailer**, runtime `173`, and tagline **Defy the gods.** The values appeared in the unsaved movie form. The flow selected no images, created no people, did not save or publish, and produced no console warnings or errors during the import.
- That result is partial acceptance, not a complete release sign-off. The current-only/no-alternatives trailer state, matching-trailer deduplication, restricted-role behavior, image imports, and the remaining README checklist still need sandbox evidence.
- The Marketplace cover and preview have been refreshed locally. The cover uses a thumbnail-first Movie Importer logotype; the preview shows the current trailer picker and zero selected image destinations. They remain unpublished and still require release-owner approval with the rest of the package.

Update this snapshot when any commit, push, deployment, npm publication, or DatoCMS acceptance state changes. Do not infer one state from another.

## Release surfaces

The same package supports two delivery paths:

- Private installation: a manually deployed Cloudflare Pages build, installed by URL in the intended DatoCMS project.
- Marketplace installation: an npm package published for DatoCMS Marketplace discovery and installation.

Keep the private installation in place until the Marketplace installation has been tested in the DatoCMS sandbox. The two installation records are separate. Reinstalling from Marketplace does not replace the private plugin automatically; it requires a planned migration and a recheck of settings and field add-ons.

## Before any release action

1. Start from the approved release commit and verify the working tree is clean.
2. Run `npm run verify:release` and inspect the package with `npm pack --dry-run --json`.
3. Confirm the package contains only intended public files and no tokens, environment files, source maps, private identifiers, planning documents, or production content.
4. Check the DatoCMS sandbox schema, roles, and permissions described in the README.
5. Confirm the `homepage` and `bugs` URLs are publicly reachable and suitable for Marketplace users.
6. Inspect and explicitly approve the Marketplace cover and preview at both full size and Marketplace-card size.
7. Confirm the exact version, npm tag, Cloudflare Pages target, and rollback commit with the release owner.

## Private deployment

The normal private release path is the manually triggered GitHub Actions workflow named **Deploy private plugin to Cloudflare Pages**, which runs in GitHub's `production` environment.

1. Confirm the approved commit is present on `main`, the validation workflow passed, and the working release version is recorded.
2. Confirm the GitHub `production` environment permits deployments only from `main` and that the required Cloudflare secrets are present. Do not print their values.
3. Open the workflow in GitHub Actions, choose **Run workflow**, and select `main`. Triggering this workflow is the production deployment approval.
4. Confirm `npm run verify:release` passes before the Cloudflare deployment step begins.
5. Record the GitHub Actions run URL, commit SHA, Cloudflare deployment URL, and completion time.
6. Verify `https://tmdb-movie-importer.pages.dev/` and its JavaScript and CSS assets return HTTP 200.
7. Point only the intended DatoCMS sandbox private plugin at the stable Pages URL, then complete the README acceptance checklist with editor and restricted roles.
8. Preserve the previous successful Cloudflare deployment until support confirms the new private installation is stable.

The workflow does not update DatoCMS configuration.

## Local Wrangler recovery

Use this fallback only when GitHub Actions is unavailable and an authorized operator has approved a recovery deployment. It is not the normal private-release path and does not update DatoCMS configuration.

1. Check out the approved commit on `main`, confirm it is clean, and install the locked dependencies:

```bash
git switch main
git pull --ff-only origin main
test -z "$(git status --porcelain)"
npm ci
npm run verify:release
```

2. Put the purpose-specific, least-privileged Pages token in `TMDB_CLOUDFLARE_PAGES_TOKEN` and the account ID in `CLOUDFLARE_ACCOUNT_ID` in the current shell. Do not print either value, store either value in the repository, or copy the token into GitHub. Confirm only that both variables are present:

```bash
: "${TMDB_CLOUDFLARE_PAGES_TOKEN:?Set the authorized recovery token in the environment.}"
: "${CLOUDFLARE_ACCOUNT_ID:?Set the Cloudflare account ID in the environment.}"
```

3. Deploy the verified `dist` directory to the existing Direct Upload project. This command publishes the current clean commit to the production `main` branch and records its metadata:

```bash
CLOUDFLARE_API_TOKEN="$TMDB_CLOUDFLARE_PAGES_TOKEN" \
  npm exec --yes --package=wrangler@4.117.0 -- wrangler pages deploy dist \
  --project-name=tmdb-movie-importer \
  --branch=main \
  --commit-hash="$(git rev-parse HEAD)" \
  --commit-message="$(git log -1 --format=%s)" \
  --commit-dirty=false
```

4. Record the approved commit SHA, Cloudflare deployment URL, operator, and completion time. Perform the same HTTP checks as the normal path: confirm the stable Pages HTML and its JavaScript and CSS assets return HTTP 200, then point only the intended DatoCMS sandbox private plugin at `https://tmdb-movie-importer.pages.dev/` and complete the README acceptance checklist. Preserve the previous successful deployment until support confirms stability.

## Canary publication

DatoCMS discovers compliant packages from npm. A canary published under a non-`latest` dist-tag remains available for owner testing through Developer Zone; publishing under `latest` makes a compliant package eligible for automatic Marketplace discovery. See DatoCMS's guides to [releasing canary versions](https://www.datocms.com/docs/plugin-sdk/releasing-new-plugin-versions) and [publishing to Marketplace](https://www.datocms.com/docs/plugin-sdk/publishing-to-marketplace).

1. Confirm npm authentication, package-name ownership, and the approved prerelease version without printing credentials.
2. Publish only the approved prerelease package version, such as `0.1.0-next.0`, under npm's `next` tag.
3. Install the package in a DatoCMS sandbox through Developer Zone. Do not alter the live private installation during this test.
4. Re-enter configuration, verify field mappings and the manually attached TMDB ID add-on, then complete the acceptance checklist.
5. Check the configuration credits area for the TMDB logo and required notice.
6. Record the package version, npm integrity, DatoCMS sandbox result, and any support notes.

## Promotion

Promote only after the private deployment and Marketplace canary both pass sandbox acceptance.

1. Confirm the public source and package contain no private material.
2. Publish the identical approved source as `0.1.0` under npm's `latest` tag and create the matching Git tag.
3. Confirm the package appears in Marketplace, then verify its title, publisher, screenshots, package entry point, permissions, homepage, support link, and TMDB attribution. DatoCMS says compliant packages normally appear automatically within one hour; investigate the package metadata and contact DatoCMS support if it is still absent after three hours.
4. Test a fresh Marketplace installation in the sandbox before scheduling any private-to-Marketplace migration.
5. Plan the migration as a separate change: export or record settings, reinstall from Marketplace, reattach the field add-on if needed, verify mappings, and test an import before removing the private installation.

## Rollback

Stop promotion when package contents, sandbox behavior, permissions, branding, or attribution differ from the approved release.

- Private deployment: return the DatoCMS private installation to the previously verified Pages deployment, then retest its URL and import flow.
- npm/Marketplace: do not overwrite a published version. Deprecate or untag the affected prerelease if appropriate, publish a corrected new version, and document the affected versions and workaround.
- DatoCMS installation: restore the recorded configuration and field-add-on attachment only after confirming the target schema. Do not assume a reinstall preserved settings.

Record the incident, versions, affected installations, decision owner, rollback time, and verification result.

## Support handoff

Collect the product version, package or Pages URL, DatoCMS project/environment, editor role, browser, reproduction steps, expected and observed behavior, and sanitized browser-console errors. Never request or paste a TMDB token, DatoCMS user token, or production record data into a ticket.

Classify reports before escalating:

- Configuration: missing model or field API name, invalid TMDB token, or an unattached field add-on.
- Permission: the role cannot create draft people, upload images, or update the current form.
- TMDB response: no result, unavailable data, or a source-image problem.
- Import side effect: drafts or uploads may remain when a later import phase fails; inspect and clean them intentionally.

## TMDB attribution and license boundary

This product uses the TMDB API but is not endorsed or certified by TMDB.

The configuration screen uses TMDB's approved primary-blue logo, downloaded unchanged from [TMDB Logos & Attribution](https://www.themoviedb.org/about/logos-attribution). TMDB requires its logo and the notice above in an application's About or Credits area. The logo is kept small and linked to [The Movie Database](https://www.themoviedb.org) to identify the data source, not to imply endorsement.

MIT covers the plugin code only. It does not grant rights to TMDB data, imagery, trademarks, or logo assets. Follow the current [TMDB API Terms of Use](https://www.themoviedb.org/api-terms-of-use) for TMDB content and API access.
