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
