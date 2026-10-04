# Payload Eventbrite Roadmap

## Public Core: @cleverforge/payload-eventbrite

Purpose: synchronize event records between Payload CMS and Eventbrite without requiring CleverForms.

### v0.1
- Eventbrite event collection
- Eventbrite -> Payload organization import
- Eventbrite event webhook receiver
- Payload -> Eventbrite draft create/update
- Publish/unpublish API endpoints
- Webhook list/register endpoints
- OAuth utility functions
- Server-side token resolver
- Webhook delivery log
- CI, typecheck, tests, Apache-2.0

### v0.2 candidates
- Venue synchronization and venue creation
- Organizer synchronization
- Event logo/media synchronization into Payload uploads
- Retry queue / dead-letter workflow
- Conflict resolution policy based on changed timestamps
- Configurable custom Payload event collection mapping
- Admin UI buttons for Push, Publish, Unpublish, Sync Now
- Scheduled reconciliation job

## Separate future plugins

### @cleverforge/payload-eventbrite-checkout
Embedded Eventbrite checkout, registration buttons, modal/inline checkout components and order-complete callback integration.

### @cleverforge/payload-eventbrite-attendees
Orders, attendees, refunds, ticket classes, check-in status and attendance reporting. Kept separate because this introduces PII and tighter access-control requirements.

### @cleverforge/payload-eventbrite-oauth
Reusable Eventbrite connection manager for SaaS/multi-tenant deployments, encrypted token persistence, connection lifecycle, organization selection and App Marketplace readiness.

### @cleverforge/payload-eventbrite-analytics
Revenue, ticket sales, registrations, attendance, conversion and event-performance reporting.

### @cleverforge/payload-calendar-sync
Microsoft 365 and Google Calendar ingestion into a normalized Payload calendar/event model. This should allow M365 to be the staff authoring calendar while Payload powers the website and Eventbrite is an optional publishing destination.

### @cleverforge/event-normalizer
Platform-neutral event schema and adapters. This becomes useful when supporting Eventbrite, Microsoft 365, Google Calendar and other listing platforms from one normalized event record.
