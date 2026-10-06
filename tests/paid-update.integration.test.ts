import test from 'node:test'
import assert from 'node:assert/strict'
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { getPayload } from 'payload'
import { createDevConfig } from '../dev/config.js'

async function cleanupDatabase(databasePath: string) {
  await rm(databasePath, { force: true }).catch(() => undefined)
  await rm(databasePath + '-shm', { force: true }).catch(() => undefined)
  await rm(databasePath + '-wal', { force: true }).catch(() => undefined)
}

async function destroyPayload(payload: any) {
  if (typeof payload.destroy === 'function') {
    await payload.destroy()
    return
  }
  if (typeof payload.db?.destroy === 'function') await payload.db.destroy()
}

test('Core updates an existing Eventbrite event and paid basic ticket', async () => {
  const databasePath = resolve(process.cwd(), '.tmp-payload-eventbrite-paid-update-' + process.pid + '.db')
  const config = createDevConfig('file:' + databasePath)
  const payload = await getPayload({ config, key: 'payload-eventbrite-paid-update-' + process.pid })
  const originalFetch = globalThis.fetch
  const requests: string[] = []

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = String(init?.method || 'GET').toUpperCase()
    requests.push(method + ' ' + url.pathname)

    const headers = new Headers(init?.headers)
    assert.equal(headers.get('Authorization'), 'Bearer development-token')

    if (method === 'POST' && url.pathname === '/v3/events/remote-paid-1/') {
      const body = JSON.parse(String(init?.body || '{}'))
      assert.equal(body.event.name.html, 'Updated Paid Event')
      assert.equal(body.event.organizer_id, 'organizer-1')
      return Response.json({
        id: 'remote-paid-1',
        name: { text: 'Updated Paid Event' },
        description: { html: '<p>Updated paid event</p>' },
        start: { utc: '2026-12-10T15:00:00Z', timezone: 'America/New_York' },
        end: { utc: '2026-12-10T17:00:00Z', timezone: 'America/New_York' },
        status: 'draft',
        currency: 'USD',
        online_event: true,
        listed: true,
        organizer_id: 'organizer-1',
        changed: '2026-10-05T20:00:00Z',
      })
    }

    if (method === 'POST' && url.pathname === '/v3/events/remote-paid-1/ticket_classes/ticket-paid-1/') {
      const body = JSON.parse(String(init?.body || '{}'))
      assert.equal(body.ticket_class.name, 'Paid Admission')
      assert.equal(body.ticket_class.quantity_total, 40)
      assert.equal(body.ticket_class.cost, 'USD,3500')
      return Response.json({
        id: 'ticket-paid-1',
        name: 'Paid Admission',
        quantity_total: 40,
        cost: { currency: 'USD', value: 3500, major_value: '35.00' },
      })
    }

    throw new Error('Unexpected Eventbrite test request: ' + method + ' ' + url.toString())
  }) as typeof fetch

  try {
    const event: any = await payload.create({
      collection: 'eventbrite-events' as any,
      overrideAccess: true,
      data: {
        title: 'Updated Paid Event',
        descriptionHTML: '<p>Updated paid event</p>',
        startAt: '2026-12-10T15:00:00.000Z',
        endAt: '2026-12-10T17:00:00.000Z',
        timezone: 'America/New_York',
        currency: 'USD',
        onlineEvent: true,
        listed: true,
        organizerId: 'organizer-1',
        eventbriteId: 'remote-paid-1',
        status: 'draft',
        basicTicket: {
          basicTicketName: 'Paid Admission',
          basicTicketQuantity: 40,
          basicTicketFree: false,
          basicTicketPriceMinor: 3500,
          ticketClassId: 'ticket-paid-1',
        },
      } as any,
    })

    const endpoints: any[] = payload.config.endpoints || []
    const push = endpoints.find((endpoint: any) => endpoint.path === '/eventbrite/push/:id')
    assert.ok(push?.handler)

    const response: Response = await push.handler({
      payload,
      user: { id: 'integration-user' },
      routeParams: { id: event.id },
      headers: new Headers(),
      url: 'http://localhost/api/eventbrite/push/' + event.id,
      context: {},
    } as any)

    assert.equal(response.status, 200)
    assert.equal((await response.json() as any).ok, true)
    assert.deepEqual(requests, [
      'POST /v3/events/remote-paid-1/',
      'POST /v3/events/remote-paid-1/ticket_classes/ticket-paid-1/',
    ])

    const updated: any = await payload.findByID({
      collection: 'eventbrite-events' as any,
      id: event.id,
      overrideAccess: true,
    })
    assert.equal(updated.eventbriteId, 'remote-paid-1')
    assert.equal(updated.basicTicket?.ticketClassId, 'ticket-paid-1')
    assert.equal(updated.syncStatus, 'synced')
    assert.equal(updated.raw, null)
  } finally {
    globalThis.fetch = originalFetch
    await destroyPayload(payload)
    await cleanupDatabase(databasePath)
  }
})
