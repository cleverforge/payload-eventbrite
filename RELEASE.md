# Release Process

## Merge gate

Do not merge a release or feature pull request unless both CI matrix jobs are green:

- Node 20
- Node 22

Each job must pass:

- install
- production dependency audit
- TypeScript typecheck
- tests
- build
- package validation

## Core beta release

1. Update `package.json` version using Semantic Versioning.
2. Move `Unreleased` changelog entries under the new version.
3. Open a release pull request.
4. Confirm both Node CI jobs pass.
5. Merge to `main`.
6. Confirm the post-merge `main` CI is green.
7. Ensure the repository Actions secret `NPM_TOKEN` is configured with publish access to the `@cleverforge` scope.
8. Run the **Publish npm beta** workflow manually with dist-tag `beta`.
9. Verify the package from a clean project:
   ```bash
   npm install @cleverforge/payload-eventbrite@beta
   ```
10. Do not promote the beta to `latest` until live Payload + Eventbrite acceptance tests pass.

## Live acceptance gate

Before promoting a beta toward stable, configure a dedicated Eventbrite test organization and run both manual workflows:

1. **Live Eventbrite smoke test** for read-only API coverage.
2. **Live Eventbrite write acceptance** using the exact confirmation phrase `CREATE_PUBLISH_UNPUBLISH_DELETE_TEST_EVENT`.

The write workflow must complete create -> ticket -> publish -> unpublish -> delete successfully. It uses an unlisted future event and attempts cleanup even when the test fails.

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

## Branch protection

Configure GitHub branch protection or a repository ruleset for `main` to require the CI checks before merge. Repository policy should prevent merging when either Node matrix job is failing or pending.
