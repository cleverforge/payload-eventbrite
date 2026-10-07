import test from 'node:test'
import assert from 'node:assert/strict'
import { EventbriteClient } from '../src/lib/client.js'

test('retries transient GET failures and preserves authorization', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls++
    const headers = new Headers(init?.headers)
    assert.equal(headers.get('Authorization'), 'Bearer test-token')
    if (calls === 1) {
      return new Response(JSON.stringify({ error: 'temporary' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ id: '123', name: { text: 'Recovered' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch

  try {
    const client = new EventbriteClient('test-token', { retries: 1, timeoutMs: 1_000 })
    const event = await client.getEvent('123')
    assert.equal(event.id, '123')
    assert.equal(calls, 2)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('does not retry POST mutations', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = (async () => {
    calls++
    return new Response(JSON.stringify({ error: 'temporary' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch

  try {
    const client = new EventbriteClient('test-token', { retries: 4, timeoutMs: 1_000 })
    await assert.rejects(
      () => client.createEvent('org-1', { event: { name: { html: 'Test' } } }),
      /Eventbrite API 503/,
    )
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('rejects invalid reliability configuration', () => {
  assert.throws(() => new EventbriteClient('token', { retries: 6 }), /integer between 0 and 5/)
  assert.throws(() => new EventbriteClient('token', { timeoutMs: 99 }), /integer between 1000 and 120000/)
})


test('deletes an Eventbrite webhook with one authenticated DELETE request', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls++
    const url = new URL(String(input))
    const headers = new Headers(init?.headers)
    assert.equal(url.pathname, '/v3/webhooks/webhook-1/')
    assert.equal(init?.method, 'DELETE')
    assert.equal(headers.get('Authorization'), 'Bearer test-token')
    return Response.json({ deleted: true })
  }) as typeof fetch
  try {
    const result = await new EventbriteClient('test-token').deleteWebhook('webhook-1')
    assert.equal(result?.deleted, true)
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})


test('lists organizers using the organization-scoped Eventbrite endpoint', async () => {
  const originalFetch = globalThis.fetch
  let requested = ''
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requested = String(input)
    assert.equal(String(init?.method || 'GET').toUpperCase(), 'GET')
    return Response.json({ organizers: [{ id: 'organizer-1', name: 'Community Team' }] })
  }) as typeof fetch
  try {
    const result = await new EventbriteClient('token').listOrganizationOrganizers('organization-1')
    assert.match(requested, /\/v3\/organizations\/organization-1\/organizers\//)
    assert.equal(result.organizers?.[0]?.id, 'organizer-1')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('creates organizers with one organization-scoped POST request', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls++
    assert.match(String(input), /\/v3\/organizations\/organization-1\/organizers\//)
    assert.equal(init?.method, 'POST')
    return Response.json({ id: 'organizer-2', name: 'New Team' })
  }) as typeof fetch
  try {
    const result = await new EventbriteClient('token').createOrganizer('organization-1', { organizer: { name: 'New Team' } })
    assert.equal(result.id, 'organizer-2')
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})


test('deletes an Eventbrite event with one authenticated DELETE request', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls++
    const url = new URL(String(input))
    const headers = new Headers(init?.headers)
    assert.equal(url.pathname, '/v3/events/event-1/')
    assert.equal(init?.method, 'DELETE')
    assert.equal(headers.get('Authorization'), 'Bearer test-token')
    return Response.json({ deleted: true })
  }) as typeof fetch

  try {
    const result = await new EventbriteClient('test-token').deleteEvent('event-1')
    assert.equal(result?.deleted, true)
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})


test('retrieves the fully rendered Eventbrite description endpoint', async () => {
  const originalFetch = globalThis.fetch
  let requested = ''
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requested = String(input)
    assert.equal(String(init?.method || 'GET').toUpperCase(), 'GET')
    return Response.json({ description: '<div>Full event description</div>' })
  }) as typeof fetch

  try {
    const result = await new EventbriteClient('test-token').getEventDescription('event-123')
    assert.match(requested, /\/v3\/events\/event-123\/description\//)
    assert.equal(result.description, '<div>Full event description</div>')
  } finally {
    globalThis.fetch = originalFetch
  }
})


test('uses recent Eventbrite Waypoint tokens and discards them after five minutes', async () => {
  const originalFetch = globalThis.fetch
  const originalNow = Date.now
  let now = 1_000_000
  let call = 0

  Date.now = () => now
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    call++
    const headers = new Headers(init?.headers)

    if (call === 1) {
      assert.equal(headers.get('Eventbrite-API-Waypoint-Token'), null)
      return new Response(JSON.stringify({ id: 'event-1' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Eventbrite-API-Waypoint-Token': 'waypoint-1',
        },
      })
    }

    if (call === 2) {
      assert.equal(headers.get('Eventbrite-API-Waypoint-Token'), 'waypoint-1')
      return Response.json({ id: 'event-1' })
    }

    assert.equal(headers.get('Eventbrite-API-Waypoint-Token'), null)
    return Response.json({ id: 'event-1' })
  }) as typeof fetch

  try {
    const client = new EventbriteClient('test-token')
    await client.createEvent('org-1', { event: { name: { html: 'Waypoint Test' } } })
    await client.getEvent('event-1')
    now += 5 * 60 * 1_000 + 1
    await client.getEvent('event-1')
    assert.equal(call, 3)
  } finally {
    Date.now = originalNow
    globalThis.fetch = originalFetch
  }
})
