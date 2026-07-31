# TMDB Movie Importer release guide

This guide prepares a release. It does not authorize any deployment, publication, GitHub visibility change, or DatoCMS installation change.

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
5. Confirm the exact version, npm tag, Cloudflare Pages target, and rollback commit with the release owner.

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

## Canary publication

1. Publish only the approved prerelease package version, such as `0.1.0-next.0`, under npm's `next` tag.
2. Install the package in a DatoCMS sandbox through Developer Zone. Do not alter the live private installation during this test.
3. Re-enter configuration, verify field mappings and the manually attached TMDB ID add-on, then complete the acceptance checklist.
4. Check the configuration credits area for the TMDB logo and required notice.
5. Record the package version, npm integrity, DatoCMS sandbox result, and any support notes.

## Promotion

Promote only after the private deployment and Marketplace canary both pass sandbox acceptance.

1. Confirm the public source and package contain no private material.
2. Publish the identical approved source as `0.1.0` under npm's `latest` tag and create the matching Git tag.
3. Verify the Marketplace listing title, publisher, screenshots, package entry point, permissions, and TMDB attribution.
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
