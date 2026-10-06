# @cleverforge/payload-eventbrite

Standalone open-source Eventbrite integration for Payload CMS. It does **not** depend on CleverForms.

## Release status

The documented Core feature scope required before stable v1 is complete. The package remains on the beta release line until the live Eventbrite smoke/write acceptance workflows and the runtime validation in `RELEASE.md` pass. Stable publication is handled by a separate guarded workflow so a prerelease cannot be accidentally published under npm `latest`.

## Core capabilities

- Eventbrite Events collection in Payload
- Eventbrite -> Payload organization sync
- Eventbrite event webhooks
- Eventbrite full rendered-description hydration for New Create events
- Payload -> Eventbrite create/update
- Eventbrite publish/unpublish
- Payload Admin event controls for Sync Now, Push, readiness checking, Publish, and Unpublish
- Basic free or paid ticket-class creation/update
- Existing Eventbrite organizer assignment
- Eventbrite venue collection, organization sync, create/update, and event relationship selection
- Eventbrite organizer collection, organization sync, create, and event relationship selection
- OAuth authorization-code helpers
- Private-token or request-aware token resolver
- Manual or automatic outbound synchronization
- Direction-aware endpoint registration
- Safe GET retries with bounded timeouts
- Webhook delivery logs
- Eventbrite API waypoint-token support
- SSRF protection for webhook resource retrieval

## Install

```bash
npm install @cleverforge/payload-eventbrite
```

## Configure

```ts
import { buildConfig } from 'payload'
import { eventbritePlugin } from '@cleverforge/payload-eventbrite'

export default buildConfig({
  plugins: [
    eventbritePlugin({
      organizationId: process.env.EVENTBRITE_ORGANIZATION_ID!,
      accessToken: process.env.EVENTBRITE_PRIVATE_TOKEN!,
      defaultTimezone: 'America/New_York',
      defaultCurrency: 'USD',
      syncDirection: 'two-way',
      autoPush: false,
      conflictPolicy: 'eventbrite-wins',
      eventCollection: {
        // Optional: set useExisting: true to augment an existing collection with this eventsSlug.
        useExisting: false,
        fieldMap: {
          // title: 'name',
          // descriptionHTML: 'body',
          // startAt: 'startsAt',
          // endAt: 'endsAt',
        },
      },
      eventMedia: {
        collection: 'media',
        buildData: ({ event }) => ({ alt: `Event logo for ${event.id}` }),
      },
      reconciliation: {
        enabled: true,
        intervalMs: 15 * 60 * 1000,
        runOnStart: false,
      },
      storeRaw: false,
      requestTimeoutMs: 15000,
      requestRetries: 2,
      renderedDescriptionMode: 'auto',
      webhookToken: process.env.EVENTBRITE_WEBHOOK_TOKEN,
    }),
  ],
})
```

Keep Eventbrite tokens server-side. Raw Eventbrite responses are not persisted or API-readable unless `storeRaw: true` is explicitly enabled. Eventbrite-managed identifiers, remote status, sync status, timestamps, ticket-class IDs, and raw response fields are server-managed at Payload field-access level, not only marked read-only in the Admin UI.

Core venues and organizers default to public read access. Event records are stricter: authenticated users can read all events, while anonymous readers only receive events that are `listed: true` and in a public Eventbrite state (`live`, `started`, `ended`, or `completed`). Draft, canceled, unlisted, and local-only events are not exposed anonymously by default. Hosts can override event reads with `publicEventReadAccess`, broader public-data reads with `publicDataReadAccess`, and writes with `managementAccess`.

Management API routes such as sync, push, publish/unpublish, venue/organizer mutation, and webhook administration also require authentication by default. Use `managementEndpointAccess(req)` for role-based endpoint authorization. Authentication failures return HTTP 401; authenticated users rejected by the host policy receive HTTP 403.

`syncDirection` is enforced at plugin-registration time:
- `eventbrite-to-payload` registers import/webhook endpoints only.
- `payload-to-eventbrite` registers push/publish endpoints only.
- `two-way` registers both.

Core retries only safe GET/HEAD requests after transient network/429/5xx failures. Mutating POST requests are never retried automatically to avoid duplicate Eventbrite writes.

For a long-running Payload server, enable `reconciliation` to periodically import the configured Eventbrite organization's current event state. The interval is clamped to at least one minute and defaults to 15 minutes. On serverless deployments, leave this disabled and invoke `POST /api/eventbrite/sync` from the platform scheduler instead. If you use request-aware token or organization resolvers, scheduled reconciliation requires those resolvers to work without an HTTP request.

When both Payload and Eventbrite changed after the last successful sync, `conflictPolicy` controls the inbound result: `eventbrite-wins` preserves existing behavior, `payload-wins` keeps the local record pending for review, and `newest-wins` compares the Payload `updatedAt` timestamp with Eventbrite's `changed` timestamp.

## Custom Payload event collections

By default, Core registers its own `eventbrite-events` collection. To use a different collection slug, set `eventsSlug`. To reuse a collection already defined by the host application, also set `eventCollection.useExisting: true`.

Use `eventCollection.fieldMap` to map Core's canonical event fields to host field names. For example, `title` can map to `name`, `descriptionHTML` to `body`, and `startAt` / `endAt` to existing date fields. The mapping is bidirectional: Eventbrite imports write to the mapped fields, while Push and auto-push read the same mapped fields back into the canonical Eventbrite model.

When `useExisting` is enabled, Core augments the target collection with only missing Eventbrite integration fields and preserves the collection's existing access rules, hooks, and Admin configuration. Core refuses to silently register a duplicate collection when the target slug already exists.

## Event descriptions

Eventbrite's current API marks the event object's legacy `description` field as deprecated for newer Create flows. For events created with the newer Eventbrite editor, the normal event response may expose the summary where older integrations expected the full description.

Core keeps two separate fields:

- `descriptionHTML`: editable HTML used for Payload -> Eventbrite writes.
- `renderedDescriptionHTML`: server-managed fully rendered listing HTML retrieved from `GET /events/{event_id}/description/`.

`renderedDescriptionMode` controls the additional read:

- `auto` (default): fetch when the legacy description is missing or appears to mirror the summary.
- `always`: always request the fully rendered description.
- `never`: never make the additional description request.

Rendered-description hydration is best effort. A missing Eventbrite permission or transient description-endpoint failure does not block the rest of event synchronization.

## Event logo/media mirroring

Set `eventMedia.collection` to an existing Payload upload collection to mirror Eventbrite event logos into Payload. Core validates the image URL against HTTPS and an allowlist (default: `img.evbuc.com`), limits downloads to 10 MiB by default, and stores the Eventbrite media ID on the event so unchanged logos are not re-uploaded. Use `buildData` to provide any required fields on your upload collection, such as `alt`. Core does not automatically delete older uploads when Eventbrite changes a logo.

## Venues

Core includes an `eventbrite-venues` collection. Authenticated users can import the configured organization's venues, create a local venue and push it to Eventbrite, or update an already-linked venue.

Events expose a Payload relationship named `venueRecord`. When selected, Core resolves the related venue's Eventbrite ID during push/auto-push. The existing `venueId` text field remains supported for backwards compatibility and direct-ID workflows.

Eventbrite requires the first address line and a two-letter ISO country code for addresses. Core validates those fields before a venue mutation is sent.

## Organizers

Core includes an `eventbrite-organizers` collection. Authenticated users can import organizers for the configured Eventbrite organization or create a new local organizer and push it to Eventbrite.

Events expose an `organizerRecord` relationship. When selected, Core resolves the related organizer's Eventbrite ID during push and auto-push. The existing `organizerId` field remains supported for direct-ID and backwards-compatible workflows.

Core intentionally treats already-linked organizer profiles as read-only for outbound organizer editing. Eventbrite's current public Organization API documents organization-scoped organizer listing and creation, while a general organizer update operation is not part of the current documented Organization migration contract. Edit an existing organizer in Eventbrite and run organizer sync.

## Event fields required for publication

Eventbrite publication requires a sufficiently complete event. Core supports the minimum workflow:

1. Create or import a Payload event.
2. Add a description.
3. Select a synchronized organizer record or set an existing Eventbrite organizer ID.
4. For an in-person event, select a synchronized venue record or set an existing Eventbrite venue ID.
5. Configure the Basic Ticket group:
   - ticket name
   - quantity
   - free/paid
   - price in minor currency units when paid
6. Push the event.
7. Publish it.

The publish endpoint re-fetches the Eventbrite event and ticket classes before publishing and returns a clear readiness error when description, organizer, or tickets are missing.

On Payload versions that support the document `beforeDocumentControls` slot, the event Edit View also shows **Sync Now**, **Push to Eventbrite**, **Check Readiness**, **Publish**, and **Unpublish** controls. Core API endpoints remain compatible with the package's Payload 3.0 minimum even when that older Admin slot is unavailable.

## Routes

Assuming Payload's standard `/api` prefix:

- `POST /api/eventbrite/webhook`
- `POST /api/eventbrite/sync`
- `POST /api/eventbrite/sync/:id`
- `POST /api/eventbrite/push/:id`
- `POST /api/eventbrite/publish/:id`
- `POST /api/eventbrite/unpublish/:id`
- `GET /api/eventbrite/readiness/:id`
- `GET /api/eventbrite/webhooks`
- `POST /api/eventbrite/webhooks/register`
- `DELETE /api/eventbrite/webhooks/:id`
- `POST /api/eventbrite/venues/sync`
- `POST /api/eventbrite/venues/push/:id`
- `POST /api/eventbrite/organizers/sync`
- `POST /api/eventbrite/organizers/push/:id`

All management endpoints require an authenticated Payload user. Webhook logs inherit the host `managementAccess` policy. The Eventbrite webhook endpoint itself is public because Eventbrite must call it. When `webhookToken` is configured, invalid callback tokens return HTTP 401 before any webhook log is written; malformed JSON returns HTTP 400.

## Webhook security

Eventbrite's webhook documentation recommends a private/unpublished callback URL and does not define a request-signature header. Core supports an optional shared callback token through `webhookToken`. When set, webhook registration automatically adds the token to the callback URL, delivery validates it using a timing-safe comparison, and log sanitization removes it before webhook payloads are stored.

The webhook processor does not trust the posted event data. For event lifecycle notifications it:

1. verifies that `api_url` is HTTPS,
2. verifies that the host is Eventbrite's API host,
3. verifies that the resource path is an Eventbrite event resource, and
4. re-fetches the event using the configured server-side Eventbrite token.

## OAuth

Core exports:

- `buildEventbriteAuthorizeURL()`
- `exchangeEventbriteOAuthCode()`

For multi-account applications, persist tokens in encrypted server-side storage and return the correct token through `accessTokenResolver`.

## Dynamic / multi-tenant connection resolution

Core supports request-aware token and organization resolution. This lets a commercial extension or host application select the Eventbrite account without duplicating Core event logic.

```ts
eventbritePlugin({
  accessTokenResolver: async (req, context) => {
    return getTokenForRequest(req, context)
  },
  organizationIdResolver: async (req, context) => {
    return getOrganizationForRequest(req, context)
  },
})
```

Resolvers receive an operation context such as `sync`, `push`, `publish`, `unpublish`, `webhook`, `webhook-list`, `webhook-register`, or `auto-push`. Event document or webhook context is included when relevant.

A static `accessToken` / `organizationId` configuration remains supported.

## Core vs Pro

Core handles a complete single-organization Eventbrite event publishing workflow.

The commercial `@cleverforge/payload-eventbrite-pro` package extends Core with advanced ticketing, attendee/order sync, multi-account OAuth management, automation, retries, analytics, audit tooling, and higher-volume operational features.

Broader calendar synchronization such as Microsoft 365 and Google Calendar belongs in a separate reusable CleverForge calendar product rather than in Eventbrite Core.

## Development and testing

Payload recommends a local dev project and integration tests for published plugins. This repository includes a SQLite-backed Payload test harness under `dev/`.

```bash
npm install
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
npm run pack:check
```

The integration suite boots a real Payload instance, installs the plugin, creates an event through Payload's Local API, reads it back, and destroys the test database.

For an optional read-only test against a real Eventbrite account, configure GitHub Actions secrets `EVENTBRITE_PRIVATE_TOKEN` and `EVENTBRITE_ORGANIZATION_ID`, then run **Live Eventbrite smoke test**. It reads the authenticated user, events, webhooks, venues, organizers, and a sample ticket list without creating or modifying Eventbrite data.

For a release-candidate write test, run **Live Eventbrite write acceptance** and type the exact confirmation phrase `CREATE_PUBLISH_UNPUBLISH_DELETE_TEST_EVENT`. The workflow creates an unlisted online event 30 days in the future, creates a free ticket, publishes it, unpublishes it, and deletes it. Cleanup also runs on failure. Use a dedicated Eventbrite test organization/account; do not run this workflow against a production organization with unmanaged automation.

CI runs against Node 20 and Node 22.

## License

Apache-2.0
