import test from 'node:test'
import assert from 'node:assert/strict'
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { getPayload } from 'payload'
import { createDevConfig } from '../dev/config.js'

test('plugin boots in a real Payload SQLite instance and persists events', async () => {
  const databasePath = resolve(process.cwd(), `.tmp-payload-eventbrite-${process.pid}.db`)
  const config = createDevConfig(`file:${databasePath}`)
  const payload = await getPayload({ config, key: `payload-eventbrite-${process.pid}` })

  try {
    assert.ok(payload.collections['eventbrite-events'])
    assert.ok(payload.collections['eventbrite-webhooks'])

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
    assert.equal(found.raw, undefined)
  } finally {
    await payload.destroy()
    await rm(databasePath, { force: true }).catch(() => undefined)
    await rm(`${databasePath}-shm`, { force: true }).catch(() => undefined)
    await rm(`${databasePath}-wal`, { force: true }).catch(() => undefined)
  }
})
