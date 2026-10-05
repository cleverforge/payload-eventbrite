# Changelog

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
