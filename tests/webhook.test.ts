import test from 'node:test'
import assert from 'node:assert/strict'
import { buildWebhookEndpoint } from '../src/endpoints/webhook.js'
import {
  assertWebhookResourceURL,
  assertWebhookToken,
  normalizeWebhookActions,
  sanitizeWebhookPayload,
  withWebhookToken,
} from '../src/lib/webhook.js'

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


test('webhook endpoint rejects invalid callback tokens before any database write', async () => {
  let creates = 0
  const endpoint = buildWebhookEndpoint({ webhookToken: 'expected-token' } as any)
  const response: Response = await endpoint.handler({
    url: 'https://example.org/api/eventbrite/webhook?cf_eventbrite_token=wrong-token',
    headers: new Headers(),
    json: async () => ({
      api_url: 'https://www.eventbriteapi.com/v3/events/123/',
      config: { action: 'event.updated' },
    }),
    payload: {
      create: async () => { creates++; return { id: 'w1' } },
    },
  } as any)

  assert.equal(response.status, 401)
  assert.equal(creates, 0)
})

test('webhook endpoint rejects malformed JSON payloads before logging them', async () => {
  let creates = 0
  const endpoint = buildWebhookEndpoint({ webhookToken: 'expected-token' } as any)
  const response: Response = await endpoint.handler({
    url: 'https://example.org/api/eventbrite/webhook?cf_eventbrite_token=expected-token',
    headers: new Headers(),
    json: async () => { throw new SyntaxError('bad json') },
    payload: {
      create: async () => { creates++; return { id: 'w1' } },
    },
  } as any)

  assert.equal(response.status, 400)
  assert.equal(creates, 0)
})


test('normalizes Core webhook defaults and validates resource families', () => {
  const actions = normalizeWebhookActions()
  assert.ok(actions.includes('event.updated'))
  assert.ok(actions.includes('venue.updated'))
  assert.ok(actions.includes('organizer.updated'))
  assert.equal(new Set(actions).size, actions.length)

  assert.doesNotThrow(() =>
    assertWebhookResourceURL('order.placed', 'https://www.eventbriteapi.com/v3/orders/order-1/'),
  )
  assert.doesNotThrow(() =>
    assertWebhookResourceURL(
      'attendee.updated',
      'https://www.eventbriteapi.com/v3/events/event-1/attendees/attendee-1/',
    ),
  )
  assert.throws(
    () => assertWebhookResourceURL('order.placed', 'https://www.eventbriteapi.com/v3/events/event-1/'),
    /does not match action/,
  )
  assert.throws(() => normalizeWebhookActions(['not valid']), /Invalid Eventbrite webhook action/)
})

test('webhook extension hook can resolve a validated non-Core resource', async () => {
  const originalFetch = globalThis.fetch
  let hookResource: any
  const updates: any[] = []

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(String(input), 'https://www.eventbriteapi.com/v3/orders/order-1/')
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer test-token')
    return Response.json({ id: 'order-1', event_id: 'event-1', status: 'placed' })
  }) as typeof fetch

  try {
    const endpoint = buildWebhookEndpoint({
      accessToken: 'test-token',
      organizationId: 'org-1',
      onWebhookAction: async ({ action, handledByCore, fetchResource }) => {
        assert.equal(action, 'order.placed')
        assert.equal(handledByCore, false)
        hookResource = await fetchResource()
      },
    } as any)

    const response: Response = await endpoint.handler({
      url: 'https://example.org/api/eventbrite/webhook',
      headers: new Headers(),
      json: async () => ({
        api_url: 'https://www.eventbriteapi.com/v3/orders/order-1/',
        config: { action: 'order.placed', webhook_id: 'w1' },
      }),
      payload: {
        create: async () => ({ id: 'log-1' }),
        update: async (args: any) => { updates.push(args); return args.data },
        logger: { error: () => undefined },
      },
    } as any)

    assert.equal(response.status, 200)
    assert.equal(hookResource.id, 'order-1')
    assert.equal(updates.at(-1)?.data?.processed, true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('webhook processing failures are logged but not exposed to the caller', async () => {
  const updates: any[] = []
  const endpoint = buildWebhookEndpoint({
    accessToken: 'test-token',
    organizationId: 'org-1',
    onWebhookAction: async () => {
      throw new Error('private downstream failure detail')
    },
  } as any)

  const response: Response = await endpoint.handler({
    url: 'https://example.org/api/eventbrite/webhook',
    headers: new Headers(),
    json: async () => ({
      api_url: 'https://www.eventbriteapi.com/v3/orders/order-1/',
      config: { action: 'order.updated', webhook_id: 'w1' },
    }),
    payload: {
      create: async () => ({ id: 'log-1' }),
      update: async (args: any) => { updates.push(args); return args.data },
      logger: { error: () => undefined },
    },
  } as any)

  assert.equal(response.status, 500)
  assert.equal((await response.json() as any).error, 'Eventbrite webhook processing failed')
  assert.equal(updates.at(-1)?.data?.error, 'private downstream failure detail')
})
