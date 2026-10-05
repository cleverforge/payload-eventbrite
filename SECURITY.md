# Security Policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability involving credentials, authentication, authorization, webhook handling, SSRF, or private Eventbrite data.

Report security issues privately to the CleverForge maintainers through the repository's private security reporting channel when enabled.

## Credential handling

Eventbrite private tokens, OAuth access tokens, client secrets, and similar credentials must remain server-side. Never commit them to this repository or expose them in browser bundles.

## Supported line

Security fixes are prioritized for the latest published beta/stable release.


## Data minimization

Raw Eventbrite event responses are disabled by default. Enable `storeRaw` only when the deployment has a documented debugging or retention need.

## Network safety

Webhook resource URLs are restricted to Eventbrite event API URLs to reduce SSRF risk. Eventbrite API requests use bounded timeouts. Automatic retries apply only to safe GET/HEAD requests; mutation requests are not replayed automatically.


## Webhook authentication

Eventbrite does not document a webhook signature header. For production deployments, configure `webhookToken` and register webhooks through Core so the callback URL includes a private token. Core validates the token using a timing-safe comparison and removes it from stored webhook payload metadata.


## Eventbrite-managed field integrity

Remote identifiers, synchronization state, remote status/timestamps, basic-ticket remote IDs, and raw Eventbrite response data are protected with Payload field-level access controls. They cannot be created or changed by normal API clients; synchronization writes use server-side override access.


## Collection access defaults

Venue and organizer collections are public-read by default. Event reads are filtered for anonymous users to listed events in public Eventbrite states; draft, canceled, unlisted, and local-only records are hidden by default. Authenticated users can read all event records. Deployments can replace this policy with `publicEventReadAccess`, `publicDataReadAccess`, and `managementAccess` functions.

Eventbrite-owned IDs, sync metadata, and raw payload fields remain server-managed even for authenticated users.


## Management endpoint authorization

Core management endpoints require an authenticated Payload user. Deployments can set `managementEndpointAccess` to enforce role- or policy-based authorization for synchronization, publishing, venue/organizer operations, and webhook administration. Public Eventbrite webhook delivery remains separate and is protected through resource validation and the optional private callback token.
