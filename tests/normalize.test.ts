import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeEventbriteEvent, toEventbriteCreatePayload } from '../src/lib/normalize.js'

test('normalizes an Eventbrite event', () => {
  const event = normalizeEventbriteEvent({
    id: '123',
    name: { text: 'Community Event' },
    start: { utc: '2026-11-01T15:00:00Z', timezone: 'America/New_York' },
    end: { utc: '2026-11-01T17:00:00Z', timezone: 'America/New_York' },
    url: 'https://example.eventbrite.com',
    status: 'live',
  })
  assert.equal(event.eventbriteId, '123')
  assert.equal(event.title, 'Community Event')
  assert.equal(event.status, 'live')
})

test('maps a Payload event to Eventbrite create payload', () => {
  const value: any = toEventbriteCreatePayload({
    title: 'Workshop',
    startAt: '2026-11-01T15:00:00.000Z',
    endAt: '2026-11-01T17:00:00.000Z',
  }, { currency: 'USD', timezone: 'America/New_York' })
  assert.equal(value.event.name.html, 'Workshop')
  assert.equal(value.event.currency, 'USD')
  assert.equal(value.event.start.timezone, 'America/New_York')
})
