# Changelog

## Unreleased

- Return controlled 401/400 responses for invalid webhook tokens and malformed payloads before persistence.
- Make webhook delivery logs inherit host `managementAccess` for read/delete operations.

- Restrict anonymous event reads to listed Eventbrite events in public lifecycle states while preserving authenticated management visibility.
- Add `publicEventReadAccess` for host-defined event visibility policies.

- Add real Payload integration coverage for the authenticated push, publish, and unpublish endpoint lifecycle using a mocked Eventbrite transport.

- Add first-class Eventbrite organizer synchronization, creation, and Payload event-to-organizer relationships while retaining direct organizerId compatibility.
- Expand the read-only live Eventbrite smoke test to venues and organizers.
- Keep manual event push raw Eventbrite response storage opt-in, matching the documented data-minimization default.

- Add first-class Eventbrite venue sync/create/update and Payload event-to-venue relationships while retaining direct venueId compatibility.

- Add authenticated Eventbrite webhook deletion for clean disable/uninstall workflows.

- Add idempotent remote-event synchronization coverage against a real Payload SQLite database.
- Harden GitHub Actions permissions, concurrency, and timeouts; add weekly Dependabot updates.

- Update repository metadata after transfer to CleverForgeAi.
- Default raw Eventbrite event response storage to off.
- Enforce configured inbound/outbound sync direction when registering endpoints and webhook storage.
- Add bounded Eventbrite request timeouts and safe GET/HEAD retry handling.
- Add optional shared-token protection for Eventbrite webhook callbacks with log sanitization.
- Add unit coverage for retry safety and direction-aware configuration.
- Protect Eventbrite-owned identifiers, sync state, remote timestamps, ticket IDs, and raw responses with Payload field-level access controls.
- Add a real Payload + SQLite integration harness and read-only live Eventbrite smoke workflow.

## 0.3.0-beta.0

- Add request-aware access-token and organization resolvers for multi-account integrations.
- Pass operation, event-document, and webhook context to connection resolvers.
- Complete resolver support across sync, push, publish/unpublish, webhook management, webhook delivery, and auto-push.
- Add configuration and resolver regression tests.

## 0.2.0-beta.0

- Add basic free/paid Eventbrite ticket-class synchronization.
- Add organizer and venue assignment to outbound event payloads.
- Add description synchronization.
- Add publish-readiness checks.
- Restrict webhook event resource fetching to Eventbrite event URLs.
- Add npm package validation to CI.
- Expand security and publishing tests.

## 0.1.0-beta.0

- Initial standalone Payload CMS Eventbrite integration.
