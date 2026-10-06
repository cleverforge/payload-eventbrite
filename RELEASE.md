# Release Process

## Merge gate

Do not merge a release or feature pull request unless all required CI jobs are green.

The CI matrix covers:

- Node 20
- Node 22
- minimum supported Payload 3.0 compatibility
- clean consumer-package installation for minimum and current Payload 3.x

Required validation includes:

- reproducible install from the committed `package-lock.json` using `npm ci`
- production dependency audit
- ESLint
- TypeScript typecheck
- unit and integration tests
- build
- package/export validation

## Core beta release

1. Update `package.json` version using Semantic Versioning with a `-beta.N` prerelease suffix.
2. Move `Unreleased` changelog entries under the new version.
3. Open a release pull request.
4. Confirm all CI jobs pass.
5. Merge to `main`.
6. Confirm the post-merge `main` CI is green.
7. Ensure the repository Actions secret `NPM_TOKEN` is configured with publish access to the `@cleverforge` scope.
8. Run **Publish npm beta** manually.
9. Verify the package from a clean project:
   ```bash
   npm install @cleverforge/payload-eventbrite@beta
   ```
10. Do not promote the beta to `latest` until the live acceptance and stable-release gates below pass.

The beta workflow always publishes with the npm `beta` dist-tag and rejects package versions that do not end in `-beta.N`.

## Live acceptance gate

Before promoting toward stable, use a dedicated Eventbrite test organization and run both manual workflows against the exact commit that will be published as stable:

1. **Live Eventbrite smoke test** for read-only API coverage.
2. **Live Eventbrite write acceptance** using the exact confirmation phrase `CREATE_PUBLISH_UNPUBLISH_DELETE_TEST_EVENT`.

The write workflow must complete create -> ticket -> publish -> unpublish -> delete successfully. It uses an unlisted future event and attempts cleanup even when the test fails.

Required repository secrets:

- `EVENTBRITE_PRIVATE_TOKEN`
- `EVENTBRITE_ORGANIZATION_ID`
- `PAYLOAD_TEST_SECRET` for the write acceptance workflow

## Stable release gate

A stable release additionally requires real runtime validation against:

- a supported Payload 3.x application,
- a real Eventbrite account/application,
- public HTTPS OAuth/webhook endpoints,
- a real database,
- event create/update/publish/unpublish,
- basic free and paid tickets,
- webhook ingestion,
- OAuth reconnect behavior where used.

Stable release procedure:

1. Prepare a release PR that removes the prerelease suffix from `package.json` (for example, `1.0.0`).
2. Move `Unreleased` changelog entries under the stable version and confirm release notes.
3. Merge only after all CI jobs pass.
4. Confirm `main` CI is green on the stable commit.
5. Run **Live Eventbrite smoke test** on that exact commit.
6. Run **Live Eventbrite write acceptance** on that exact commit.
7. Complete the real Payload runtime validation above.
8. Run **Publish npm stable** and type the exact confirmation phrase `PROMOTE_STABLE_AFTER_LIVE_ACCEPTANCE`.
9. Verify a clean install:
   ```bash
   npm install @cleverforge/payload-eventbrite@latest
   ```

The stable publishing workflow rejects prerelease versions and verifies that successful smoke and write-acceptance runs exist for the same commit before publishing the npm `latest` dist-tag.

## Branch protection

Configure GitHub branch protection or a repository ruleset for `main` to require CI before merge. Repository policy should prevent merging while any required CI job is failing or pending.

The current GitHub App connection cannot administer branch protection. Verify this repository setting in GitHub organization/repository settings.

## Dependency reproducibility

Commit `package-lock.json` and keep it in sync with `package.json`. CI, live acceptance, and publishing use `npm ci` so reviewed builds do not silently resolve a different dependency graph. Dependabot should update both manifest and lockfile together.
