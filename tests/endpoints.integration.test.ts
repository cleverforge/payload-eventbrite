import test from 'node:test'
import assert from 'node:assert/strict'
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { getPayload } from 'payload'
import { createDevConfig } from '../dev/config.js'

async function cleanupDatabase(databasePath: string) {
  await rm(databasePath, { force: true }).catch(() => undefined)
  await rm(`${databasePath}-shm`, { force: true }).catch(() => undefined)
  await rm(`${databasePath}-wal`, { force: true }).catch(() => undefined)
}

async function destroyPayload(payload: any) {
  if (typeof payload.destroy === 'function') {
    await payload.destroy()
    return
  }
  if (typeof payload.db?.destroy === 'function') {
    await payload.db.destroy()
  }
}

function eventResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 'remote-event-1',
    name: { text: 'Endpoint Integration Event' },
    description: { html: '<p>Endpoint integration</p>' },
    start: { utc: '2026-12-01T15:00:00Z', timezone: 'America/New_York' },
    end: { utc: '2026-12-01T17:00:00Z', timezone: 'America/New_York' },
    status: 'draft',
    currency: 'USD',
    online_event: true,
    listed: true,
    organizer_id: 'organizer-1',
    changed: '2026-10-05T18:00:00Z',
    ...overrides,
  }
}

test('Core push, publish, and unpublish endpoints work with real Payload persistence', async () => {
  const databasePath = resolve(process.cwd(), `.tmp-payload-eventbrite-endpoints-${process.pid}.db`)
  const config = createDevConfig(`file:${databasePath}`)
  const payload = await getPayload({ config, key: `payload-eventbrite-endpoints-${process.pid}` })
  const originalFetch = globalThis.fetch
  const requests: Array<{ method: string; path: string }> = []

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = String(init?.method || 'GET').toUpperCase()
    requests.push({ method, path: url.pathname })

    const headers = new Headers(init?.headers)
    assert.equal(headers.get('Authorization'), 'Bearer development-token')

    if (method === 'POST' && url.pathname === '/v3/organizations/development-org/events/') {
      const body = JSON.parse(String(init?.body || '{}'))
      assert.equal(body.event.name.html, 'Endpoint Integration Event')
      assert.equal(body.event.organizer_id, 'organizer-1')
      assert.equal(body.event.online_event, true)
      return Response.json(eventResponse())
    }

    if (method === 'POST' && url.pathname === '/v3/events/remote-event-1/ticket_classes/') {
      const body = JSON.parse(String(init?.body || '{}'))
      assert.equal(body.ticket_class.name, 'General Admission')
      assert.equal(body.ticket_class.free, true)
      assert.equal(body.ticket_class.quantity_total, 25)
      return Response.json({
        id: 'ticket-class-1',
        name: 'General Admission',
        free: true,
        quantity_total: 25,
      })
    }

    if (method === 'GET' && url.pathname === '/v3/events/remote-event-1/') {
      return Response.json(eventResponse())
    }

    if (method === 'GET' && url.pathname === '/v3/events/remote-event-1/ticket_classes/') {
      return Response.json({ ticket_classes: [{ id: 'ticket-class-1', name: 'General Admission', free: true }] })
    }

    if (method === 'POST' && url.pathname === '/v3/events/remote-event-1/publish/') {
      return Response.json({ published: true })
    }

    if (method === 'POST' && url.pathname === '/v3/events/remote-event-1/unpublish/') {
      return Response.json({ unpublished: true })
    }

    throw new Error(`Unexpected Eventbrite test request: ${method} ${url.toString()}`)
  }) as typeof fetch

  try {
    const event: any = await payload.create({
      collection: 'eventbrite-events' as any,
      data: {
        title: 'Endpoint Integration Event',
        descriptionHTML: '<p>Endpoint integration</p>',
        startAt: '2026-12-01T15:00:00.000Z',
        endAt: '2026-12-01T17:00:00.000Z',
        timezone: 'America/New_York',
        onlineEvent: true,
        listed: true,
        organizerId: 'organizer-1',
        basicTicket: {
          basicTicketName: 'General Admission',
          basicTicketQuantity: 25,
          basicTicketFree: true,
        },
      } as any,
    })

    const endpoints: any[] = payload.config.endpoints || []
    const push = endpoints.find((endpoint: any) => endpoint.path === '/eventbrite/push/:id')
    const publish = endpoints.find((endpoint: any) => endpoint.path === '/eventbrite/publish/:id')
    const unpublish = endpoints.find((endpoint: any) => endpoint.path === '/eventbrite/unpublish/:id')
    assert.ok(push?.handler)
    assert.ok(publish?.handler)
    assert.ok(unpublish?.handler)

    const req: any = {
      payload,
      user: { id: 'integration-user' },
      routeParams: { id: event.id },
      headers: new Headers(),
      url: `http://localhost/api/eventbrite/push/${event.id}`,
      context: {},
    }

    const pushResponse: Response = await push.handler(req)
    assert.equal(pushResponse.status, 200)
    const pushBody: any = await pushResponse.json()
    assert.equal(pushBody.ok, true)

    const pushed: any = await payload.findByID({
      collection: 'eventbrite-events' as any,
      id: event.id,
      overrideAccess: true,
    })
    assert.equal(pushed.eventbriteId, 'remote-event-1')
    assert.equal(pushed.basicTicket?.ticketClassId, 'ticket-class-1')
    assert.equal(pushed.syncStatus, 'synced')
    assert.equal(pushed.raw, null)

    req.url = `http://localhost/api/eventbrite/publish/${event.id}`
    const publishResponse: Response = await publish.handler(req)
    assert.equal(publishResponse.status, 200)
    assert.equal((await publishResponse.json() as any).ok, true)

    const published: any = await payload.findByID({
      collection: 'eventbrite-events' as any,
      id: event.id,
      overrideAccess: true,
    })
    assert.equal(published.status, 'live')

    req.url = `http://localhost/api/eventbrite/unpublish/${event.id}`
    const unpublishResponse: Response = await unpublish.handler(req)
    assert.equal(unpublishResponse.status, 200)
    assert.equal((await unpublishResponse.json() as any).ok, true)

    const unpublished: any = await payload.findByID({
      collection: 'eventbrite-events' as any,
      id: event.id,
      overrideAccess: true,
    })
    assert.equal(unpublished.status, 'draft')

    assert.deepEqual(
      requests.map(({ method, path }) => `${method} ${path}`),
      [
        'POST /v3/organizations/development-org/events/',
        'POST /v3/events/remote-event-1/ticket_classes/',
        'GET /v3/events/remote-event-1/',
        'GET /v3/events/remote-event-1/ticket_classes/',
        'POST /v3/events/remote-event-1/publish/',
        'POST /v3/events/remote-event-1/unpublish/',
      ],
    )
  } finally {
    globalThis.fetch = originalFetch
    await destroyPayload(payload)
    await cleanupDatabase(databasePath)
  }
})
