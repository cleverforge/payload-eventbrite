# @cleverforge/payload-eventbrite

Standalone open-source Eventbrite integration for Payload CMS.

## v0.1 public scope

- Eventbrite Events collection in Payload
- Eventbrite -> Payload full organization sync
- Eventbrite webhook ingestion
- Payload -> Eventbrite create/update
- Eventbrite publish/unpublish endpoints
- Eventbrite API waypoint-token support
- Manual or automatic outbound sync
- Server-only token resolver for multi-tenant implementations
- Raw webhook log for troubleshooting

This package intentionally does **not** depend on CleverForms.

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
      syncDirection: 'two-way',
      autoPush: false,
    }),
  ],
})
```

Do not expose Eventbrite private/OAuth tokens to browser code.

## Routes

Assuming Payload's standard `/api` route:

- `POST /api/eventbrite/webhook` - Eventbrite webhook receiver
- `POST /api/eventbrite/sync` - authenticated full Eventbrite -> Payload sync
- `POST /api/eventbrite/push/:id` - authenticated create/update of one Eventbrite event
- `POST /api/eventbrite/publish/:id` - authenticated publish
- `POST /api/eventbrite/unpublish/:id` - authenticated unpublish
- `GET /api/eventbrite/webhooks` - authenticated list of Eventbrite webhooks
- `POST /api/eventbrite/webhooks/register` - authenticated webhook registration

## Eventbrite webhook setup

Create an Eventbrite webhook for your organization pointing to:

```text
https://YOUR-DOMAIN/api/eventbrite/webhook
```

Recommended event actions for the public Events plugin are event lifecycle actions such as event creation/update/publication/unpublication. Keep order and attendee actions for the separate future ticketing/attendee package.

The webhook processor does not trust webhook content as authoritative event data. It uses the Eventbrite API resource URL and then re-fetches the event with the configured server-side token before writing to Payload.

## Publishing limitation

Eventbrite validates that an event is publishable. A draft may need organizer, ticket class, venue/payment configuration, or other Eventbrite-required settings before `publish` succeeds. v0.1 deliberately keeps ticketing and payment configuration outside this package.

## OAuth helpers

The package exports `buildEventbriteAuthorizeURL()` and `exchangeEventbriteOAuthCode()` for server-side OAuth 2.0 integrations. Persist tokens in your application's encrypted server-side storage and return them through `accessTokenResolver`.

## Multi-tenant token resolution

```ts
eventbritePlugin({
  organizationId: '...',
  accessTokenResolver: async (req) => {
    // Resolve/decrypt the correct server-side token for this tenant.
    return getTokenForTenant(req)
  },
})
```

## Future independent packages

Keep these separate rather than turning the Events plugin into a monolith:

1. `@cleverforge/payload-eventbrite-checkout` — embedded checkout and registration UI.
2. `@cleverforge/payload-eventbrite-attendees` — attendees, orders, refunds, check-in data and reporting.
3. `@cleverforge/payload-eventbrite-oauth` — reusable multi-organization OAuth connection manager / Eventbrite App Marketplace support.
4. `@cleverforge/payload-eventbrite-analytics` — event sales and attendance reporting.
5. `@cleverforge/payload-calendar-sync` — Microsoft 365 / Google Calendar normalization feeding Payload Events; Eventbrite becomes one destination rather than the master calendar.
6. `@cleverforge/event-normalizer` — platform-neutral event schema/adapters for Eventbrite and other event platforms.

## Security model

- Eventbrite credentials remain server-side.
- Webhook `api_url` is restricted to Eventbrite API HTTPS hosts to prevent SSRF.
- Manual sync/push/publish endpoints require an authenticated Payload user.
- Webhook deliveries are logged for retry/debugging.

## License

Apache-2.0
