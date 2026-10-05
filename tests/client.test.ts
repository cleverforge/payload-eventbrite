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
    return new Response(JSON.stringify({ deleted: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch

  try {
    const client = new EventbriteClient('test-token')
    const result = await client.deleteWebhook('webhook-1')
    assert.equal(result?.deleted, true)
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})
