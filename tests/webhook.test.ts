import test from 'node:test'
import assert from 'node:assert/strict'
import { assertWebhookToken, sanitizeWebhookPayload, withWebhookToken } from '../src/lib/webhook.js'

test('adds webhook token to callback URL without changing existing query params', () => {
  const url = withWebhookToken('https://example.org/api/eventbrite/webhook?connection_id=c1', 'secret-token')
  const parsed = new URL(url)
  assert.equal(parsed.searchParams.get('connection_id'), 'c1')
  assert.equal(parsed.searchParams.get('cf_eventbrite_token'), 'secret-token')
})

test('validates webhook token from the callback query string', () => {
  const req: any = {
    url: 'https://example.org/api/eventbrite/webhook?cf_eventbrite_token=secret-token',
    headers: new Headers(),
  }
  assert.doesNotThrow(() => assertWebhookToken(req, 'secret-token'))
  assert.throws(() => assertWebhookToken(req, 'different-token'), /Invalid Eventbrite webhook token/)
})

test('sanitizes webhook callback token before payload logging', () => {
  const payload: any = sanitizeWebhookPayload({
    api_url: 'https://www.eventbriteapi.com/v3/events/123/',
    config: {
      action: 'event.updated',
      endpoint_url: 'https://example.org/api/eventbrite/webhook?connection_id=c1&cf_eventbrite_token=secret-token',
      webhook_id: 'w1',
    },
  })
  const endpoint = new URL(payload.config.endpoint_url)
  assert.equal(endpoint.searchParams.get('connection_id'), 'c1')
  assert.equal(endpoint.searchParams.get('cf_eventbrite_token'), null)
})

test('webhook token remains optional for backwards-compatible deployments', () => {
  const req: any = { url: 'https://example.org/api/eventbrite/webhook', headers: new Headers() }
  assert.doesNotThrow(() => assertWebhookToken(req))
})
