import test from 'node:test'
import assert from 'node:assert/strict'
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { getPayload } from 'payload'
import { createDevConfig } from '../dev/config.js'
import { upsertEvent } from '../src/lib/upsert.js'
import { upsertVenue } from '../src/lib/venues.js'
import { upsertOrganizer } from '../src/lib/organizers.js'

async function cleanupDatabase(databasePath: string) {
  await rm(databasePath, { force: true }).catch(() => undefined)
  await rm(`${databasePath}-shm`, { force: true }).catch(() => undefined)
  await rm(`${databasePath}-wal`, { force: true }).catch(() => undefined)
}

async function destroyPayload(payload: any) {
  if (typeof payload.destroy === 'function') {
    await destroyPayload(payload)
    return
  }
  if (typeof payload.db?.destroy === 'function') {
    await payload.db.destroy()
  }
}

test('Core boots and synchronizes Eventbrite events idempotently in a real Payload SQLite instance', async () => {
  const databasePath = resolve(process.cwd(), `.tmp-payload-eventbrite-${process.pid}.db`)
  const config = createDevConfig(`file:${databasePath}`)
  const payload = await getPayload({ config, key: `payload-eventbrite-${process.pid}` })

  try {
    assert.ok(payload.collections['eventbrite-events'])
    assert.ok(payload.collections['eventbrite-webhooks'])
    assert.ok(payload.collections['eventbrite-venues'])
    assert.ok(payload.collections['eventbrite-organizers'])

    const created: any = await payload.create({
      collection: 'eventbrite-events' as any,
      data: {
        title: 'Integration Test Event',
        descriptionHTML: '<p>Test</p>',
        startAt: '2026-11-01T15:00:00.000Z',
        endAt: '2026-11-01T17:00:00.000Z',
        organizerId: 'organizer-1',
      } as any,
    })

    assert.equal(created.title, 'Integration Test Event')
    assert.equal(created.syncStatus, 'local')

    const found: any = await payload.findByID({
      collection: 'eventbrite-events' as any,
      id: created.id,
    })
    assert.equal(found.id, created.id)
    assert.equal(found.raw, null)

    const options: any = {
      eventsSlug: 'eventbrite-events',
      storeRaw: false,
    }

    const venue: any = await upsertVenue(payload, {
      id: 'venue-integration-1',
      name: 'Integration Hall',
      address: {
        address_1: '100 Main St',
        city: 'Philadelphia',
        region: 'PA',
        postal_code: '19122',
        country: 'US',
      },
      capacity: 250,
    }, {
      venuesSlug: 'eventbrite-venues',
      storeRaw: false,
    })

    const venueAgain: any = await upsertVenue(payload, {
      id: 'venue-integration-1',
      name: 'Integration Hall Updated',
      address: {
        address_1: '100 Main St',
        city: 'Philadelphia',
        region: 'PA',
        postal_code: '19122',
        country: 'US',
      },
      capacity: 300,
    }, {
      venuesSlug: 'eventbrite-venues',
      storeRaw: false,
    })

    assert.equal(venueAgain.id, venue.id)
    assert.equal(venueAgain.name, 'Integration Hall Updated')

    const organizer: any = await upsertOrganizer(payload, {
      id: 'organizer-integration-1',
      name: 'Integration Organizer',
      description: { html: '<p>Organizer description</p>' },
      num_past_events: 2,
      num_future_events: 4,
    }, {
      organizersSlug: 'eventbrite-organizers',
      storeRaw: false,
    })

    const organizerAgain: any = await upsertOrganizer(payload, {
      id: 'organizer-integration-1',
      name: 'Integration Organizer Updated',
      description: { html: '<p>Organizer description updated</p>' },
      num_past_events: 3,
      num_future_events: 5,
    }, {
      organizersSlug: 'eventbrite-organizers',
      storeRaw: false,
    })

    assert.equal(organizerAgain.id, organizer.id)
    assert.equal(organizerAgain.name, 'Integration Organizer Updated')

    const baseEvent: any = {
      id: 'evt-integration-1',
      name: { text: 'Remote Event v1' },
      description: { html: '<p>Remote description</p>' },
      start: {
        utc: '2026-11-05T15:00:00Z',
        timezone: 'America/New_York',
      },
      end: {
        utc: '2026-11-05T17:00:00Z',
        timezone: 'America/New_York',
      },
      status: 'draft',
      currency: 'USD',
      online_event: false,
      listed: true,
      venue_id: 'venue-integration-1',
      organizer_id: 'organizer-integration-1',
      changed: '2026-10-05T17:00:00Z',
    }

    const first: any = await upsertEvent(payload, baseEvent, options)
    assert.equal(first.eventbriteId, 'evt-integration-1')
    assert.equal(first.title, 'Remote Event v1')
    assert.equal(first.syncStatus, 'synced')
    assert.equal(first.raw, null)
    const linkedVenue =
      first.venueRecord && typeof first.venueRecord === 'object'
        ? first.venueRecord.id ?? first.venueRecord.value?.id ?? first.venueRecord.value
        : first.venueRecord
    assert.equal(Number(linkedVenue), Number(venue.id))
    const linkedOrganizer =
      first.organizerRecord && typeof first.organizerRecord === 'object'
        ? first.organizerRecord.id ?? first.organizerRecord.value?.id ?? first.organizerRecord.value
        : first.organizerRecord
    assert.equal(Number(linkedOrganizer), Number(organizer.id))

    const second: any = await upsertEvent(payload, {
      ...baseEvent,
      name: { text: 'Remote Event v2' },
      status: 'live',
      changed: '2026-10-05T18:00:00Z',
    }, options)

    assert.equal(second.id, first.id)
    assert.equal(second.title, 'Remote Event v2')
    assert.equal(second.status, 'live')

    const result: any = await payload.find({
      collection: 'eventbrite-events' as any,
      where: { eventbriteId: { equals: 'evt-integration-1' } },
      limit: 10,
    })

    const organizers: any = await payload.find({
      collection: 'eventbrite-organizers' as any,
      where: { organizerId: { equals: 'organizer-integration-1' } },
      limit: 10,
    })

    const venues: any = await payload.find({
      collection: 'eventbrite-venues' as any,
      where: { venueId: { equals: 'venue-integration-1' } },
      limit: 10,
    })

    assert.equal(organizers.totalDocs, 1)
    assert.equal(organizers.docs[0]?.name, 'Integration Organizer Updated')
    assert.equal(venues.totalDocs, 1)
    assert.equal(venues.docs[0]?.capacity, 300)
    assert.equal(result.totalDocs, 1)
    assert.equal(result.docs[0]?.title, 'Remote Event v2')
    assert.equal(result.docs[0]?.raw, null)
  } finally {
    await destroyPayload(payload)
    await cleanupDatabase(databasePath)
  }
})
