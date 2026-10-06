import test from 'node:test'
import assert from 'node:assert/strict'
import {
  eventFieldName,
  mapEventDataToPayload,
  toCanonicalEventDocument,
} from '../src/lib/event-mapping.js'

const options: any = {
  eventCollection: {
    fieldMap: {
      title: 'name',
      descriptionHTML: 'body',
      startAt: 'startsAt',
      endAt: 'endsAt',
      onlineEvent: 'isOnline',
    },
  },
}

test('custom event mapping resolves canonical field names', () => {
  assert.equal(eventFieldName(options, 'title'), 'name')
  assert.equal(eventFieldName(options, 'summary'), 'summary')
})

test('custom event mapping canonicalizes outbound Payload documents', () => {
  const canonical = toCanonicalEventDocument({
    name: 'Mapped event',
    body: '<p>Description</p>',
    startsAt: '2026-12-01T15:00:00Z',
    endsAt: '2026-12-01T17:00:00Z',
    isOnline: true,
    eventbriteId: 'evt-1',
  }, options)

  assert.equal(canonical.title, 'Mapped event')
  assert.equal(canonical.descriptionHTML, '<p>Description</p>')
  assert.equal(canonical.startAt, '2026-12-01T15:00:00Z')
  assert.equal(canonical.endAt, '2026-12-01T17:00:00Z')
  assert.equal(canonical.onlineEvent, true)
  assert.equal(canonical.eventbriteId, 'evt-1')
})

test('custom event mapping maps inbound canonical data to host fields', () => {
  const mapped = mapEventDataToPayload({
    title: 'Remote event',
    descriptionHTML: '<p>Remote</p>',
    startAt: '2026-12-02T15:00:00Z',
    endAt: '2026-12-02T17:00:00Z',
    onlineEvent: false,
    eventbriteId: 'evt-2',
    syncStatus: 'synced',
  }, options)

  assert.equal(mapped.name, 'Remote event')
  assert.equal(mapped.body, '<p>Remote</p>')
  assert.equal(mapped.startsAt, '2026-12-02T15:00:00Z')
  assert.equal(mapped.endsAt, '2026-12-02T17:00:00Z')
  assert.equal(mapped.isOnline, false)
  assert.equal(mapped.eventbriteId, 'evt-2')
  assert.equal(mapped.syncStatus, 'synced')
  assert.equal('title' in mapped, false)
})
