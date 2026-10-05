# @cleverforge/payload-eventbrite

Standalone open-source Eventbrite integration for Payload CMS. It does **not** depend on CleverForms.

## Core capabilities

- Eventbrite Events collection in Payload
- Eventbrite -> Payload organization sync
- Eventbrite event webhooks
- Payload -> Eventbrite create/update
- Eventbrite publish/unpublish
- Basic free or paid ticket-class creation/update
- Existing Eventbrite organizer and venue assignment
- OAuth authorization-code helpers
- Private-token or request-aware token resolver
- Manual or automatic outbound synchronization
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
    }),
  ],
})
```

Keep Eventbrite tokens server-side.

## Event fields required for publication

Eventbrite publication requires a sufficiently complete event. Core supports the minimum workflow:

1. Create or import a Payload event.
2. Add a description.
3. Set an existing Eventbrite organizer ID.
4. For an in-person event, optionally set an existing Eventbrite venue ID.
5. Configure the Basic Ticket group:
   - ticket name
   - quantity
   - free/paid
   - price in minor currency units when paid
6. Push the event.
7. Publish it.

The publish endpoint re-fetches the Eventbrite event and ticket classes before publishing and returns a clear readiness error when description, organizer, or tickets are missing.

## Routes

Assuming Payload's standard `/api` prefix:

- `POST /api/eventbrite/webhook`
- `POST /api/eventbrite/sync`
- `POST /api/eventbrite/push/:id`
- `POST /api/eventbrite/publish/:id`
- `POST /api/eventbrite/unpublish/:id`
- `GET /api/eventbrite/webhooks`
- `POST /api/eventbrite/webhooks/register`

All management endpoints require an authenticated Payload user. The Eventbrite webhook endpoint is public because Eventbrite must call it.

## Webhook security

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

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
npm run pack:check
```

CI runs against Node 20 and Node 22.

## License

Apache-2.0
