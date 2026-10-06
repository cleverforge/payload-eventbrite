# Payload Eventbrite Roadmap

## Product model

The public plugin must be useful as a complete Eventbrite event publishing integration. Paid features should add operational scale, automation, private attendee/order data, analytics, and multi-account management rather than block basic event publishing.

## Public Core: @cleverforge/payload-eventbrite

Purpose: synchronize and publish event records between Payload CMS and Eventbrite without requiring CleverForms.

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

### Core additions before stable v1
- [x] Venue synchronization and venue creation
- [x] Organizer synchronization, creation, and selection
- Basic Ticket Class synchronization and creation
  - free ticket
  - paid ticket
  - basic quantity/capacity
- [x] Event logo/media synchronization into Payload uploads
- [x] Payload admin actions for Push, Publish, Unpublish, and Sync Now
- [x] Clear publish-readiness validation
- [x] Simple scheduled reconciliation
- [x] Configurable custom Payload event collection mapping
- [x] Basic conflict policy using Eventbrite/Payload changed timestamps

These capabilities remain public because Eventbrite requires core event setup, including an organizer and at least one ticket, before an event can be published.

## Commercial extension: @cleverforge/payload-eventbrite-pro

The Pro package should depend on the public core package rather than fork or duplicate it.

### Recommended Pro capabilities
- Multiple Eventbrite organizations/accounts in one Payload installation
- Managed OAuth connection UI and encrypted token storage
- Organization/account switching and connection health monitoring
- Advanced ticketing
  - multiple ticket tiers
  - donation tickets
  - inventory tiers
  - ticket groups
  - add-ons
  - sales windows
- Orders and attendee synchronization
- Check-in status and attendance data
- Attendee custom questions/answers
- Refund/order status synchronization
- Advanced scheduled and incremental sync
- Retry queue and dead-letter handling
- Rate-limit-aware job processing
- Conflict review queue and field-level sync policies
- Automation rules
  - publish based on Payload fields/status
  - selective Eventbrite publishing
  - post-event/archive workflows
- Analytics dashboards
  - registrations
  - attendance
  - ticket sales
  - revenue
  - conversion
- Audit history and operational logs
- Webhook replay tools
- Priority compatibility updates/support hooks

## Separate companion plugins

These should stay independent of the Eventbrite Core/Pro package because they solve broader problems.

### @cleverforge/payload-eventbrite-checkout
Eventbrite registration/checkout components for Payload front ends. A basic public version can drive adoption; advanced post-purchase automation can integrate with Pro.

### @cleverforge/payload-calendar-sync
Microsoft 365 and Google Calendar ingestion into a normalized Payload calendar/event model. This allows M365 to remain the staff authoring calendar while Payload powers the website and Eventbrite is an optional publishing destination.

### @cleverforge/event-normalizer
Platform-neutral event schema and adapters. This should remain reusable infrastructure for Eventbrite, Microsoft 365, Google Calendar, and future event platforms.

## Packaging recommendation

- Public repository: `CleverForgeAi/payload-eventbrite`
- Public npm: `@cleverforge/payload-eventbrite`
- Private/commercial repository: `CleverForgeAi/payload-eventbrite-pro`
- Future commercial npm: `@cleverforge/payload-eventbrite-pro`

The Pro package should import and extend the public package so bug fixes, Eventbrite API changes, and Payload compatibility stay centralized in Core.
