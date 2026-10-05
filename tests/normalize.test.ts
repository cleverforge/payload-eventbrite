import test from 'node:test'
import assert from 'node:assert/strict'
import { assertEventbriteEventURL } from '../src/lib/client.js'
import { normalizeEventbriteEvent, toBasicTicketClassPayload, toEventbriteCreatePayload } from '../src/lib/normalize.js'
import { assertPublishReady } from '../src/lib/tickets.js'

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

test('maps a Payload event to an Eventbrite event payload', () => {
  const value: any = toEventbriteCreatePayload({
    title: 'Workshop',
    descriptionHTML: '<p>Workshop details</p>',
    organizerId: 'org-1',
    startAt: '2026-11-01T15:00:00.000Z',
    endAt: '2026-11-01T17:00:00.000Z',
  }, { currency: 'USD', timezone: 'America/New_York' })
  assert.equal(value.event.name.html, 'Workshop')
  assert.equal(value.event.description.html, '<p>Workshop details</p>')
  assert.equal(value.event.organizer_id, 'org-1')
  assert.equal(value.event.currency, 'USD')
})

test('builds free and paid basic tickets', () => {
  const free: any = toBasicTicketClassPayload({ basicTicketName: 'General', basicTicketQuantity: 50, basicTicketFree: true }, 'USD')
  assert.equal(free.ticket_class.free, true)
  assert.equal(free.ticket_class.quantity_total, 50)

  const paid: any = toBasicTicketClassPayload({ basicTicketName: 'General', basicTicketQuantity: 50, basicTicketFree: false, basicTicketPriceMinor: 2500 }, 'USD')
  assert.equal(paid.ticket_class.cost, 'USD,2500')
})

test('webhook resource validation only accepts Eventbrite event resources', () => {
  assert.doesNotThrow(() => assertEventbriteEventURL('https://www.eventbriteapi.com/v3/events/12345/'))
  assert.throws(() => assertEventbriteEventURL('https://www.eventbriteapi.com/v3/users/me/'))
  assert.throws(() => assertEventbriteEventURL('https://example.com/v3/events/12345/'))
})

test('publish readiness requires description, organizer and ticket', () => {
  assert.doesNotThrow(() => assertPublishReady({ description: { html: '<p>x</p>' }, organizer_id: '1' }, [{ id: 't1' }]))
  assert.throws(() => assertPublishReady({ description: { html: '<p>x</p>' } }, []), /organizer.*ticket class/)
})


test('event normalization omits raw Eventbrite data by default', () => {
  const event = normalizeEventbriteEvent({ id: 'privacy-1', name: { text: 'Privacy Test' } })
  assert.equal(event.raw, undefined)
})

test('event normalization stores raw Eventbrite data only when explicitly enabled', () => {
  const source = { id: 'privacy-2', name: { text: 'Privacy Test' } }
  const event = normalizeEventbriteEvent(source, true)
  assert.equal(event.raw?.id, 'privacy-2')
})
