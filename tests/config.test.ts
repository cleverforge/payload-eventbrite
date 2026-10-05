import test from 'node:test'
import assert from 'node:assert/strict'
import { eventbritePlugin } from '../src/index.js'

const base = {
  organizationId: 'org-1',
  accessToken: 'token-1',
}

function endpointPaths(config: any) {
  return (config.endpoints || []).map((endpoint: any) => endpoint.path)
}

function collectionSlugs(config: any) {
  return (config.collections || []).map((collection: any) => collection.slug)
}

test('two-way mode registers inbound and outbound capabilities', () => {
  const config: any = eventbritePlugin({ ...base, syncDirection: 'two-way' })({ collections: [] } as any)
  assert.ok(endpointPaths(config).includes('/eventbrite/webhook'))
  assert.ok(endpointPaths(config).includes('/eventbrite/push/:id'))
  assert.ok(endpointPaths(config).includes('/eventbrite/webhooks/:id'))
  assert.ok(endpointPaths(config).includes('/eventbrite/venues/sync'))
  assert.ok(endpointPaths(config).includes('/eventbrite/venues/push/:id'))
  assert.ok(endpointPaths(config).includes('/eventbrite/organizers/sync'))
  assert.ok(endpointPaths(config).includes('/eventbrite/organizers/push/:id'))
  assert.ok(collectionSlugs(config).includes('eventbrite-webhooks'))
  assert.ok(collectionSlugs(config).includes('eventbrite-venues'))
  assert.ok(collectionSlugs(config).includes('eventbrite-organizers'))
})

test('inbound-only mode does not expose outbound mutation endpoints', () => {
  const config: any = eventbritePlugin({ ...base, syncDirection: 'eventbrite-to-payload' })({ collections: [] } as any)
  const paths = endpointPaths(config)
  assert.ok(paths.includes('/eventbrite/webhook'))
  assert.ok(paths.includes('/eventbrite/sync'))
  assert.ok(paths.includes('/eventbrite/webhooks/:id'))
  assert.ok(paths.includes('/eventbrite/venues/sync'))
  assert.ok(paths.includes('/eventbrite/organizers/sync'))
  assert.ok(!paths.includes('/eventbrite/venues/push/:id'))
  assert.ok(!paths.includes('/eventbrite/organizers/push/:id'))
  assert.ok(!paths.includes('/eventbrite/push/:id'))
  assert.ok(!paths.includes('/eventbrite/publish/:id'))
  assert.ok(!paths.includes('/eventbrite/unpublish/:id'))
})

test('outbound-only mode does not expose webhook or import endpoints', () => {
  const config: any = eventbritePlugin({ ...base, syncDirection: 'payload-to-eventbrite' })({ collections: [] } as any)
  const paths = endpointPaths(config)
  assert.ok(paths.includes('/eventbrite/push/:id'))
  assert.ok(!paths.includes('/eventbrite/webhook'))
  assert.ok(!paths.includes('/eventbrite/sync'))
  assert.ok(!paths.includes('/eventbrite/webhooks/:id'))
  assert.ok(!paths.includes('/eventbrite/venues/sync'))
  assert.ok(!paths.includes('/eventbrite/organizers/sync'))
  assert.ok(paths.includes('/eventbrite/venues/push/:id'))
  assert.ok(paths.includes('/eventbrite/organizers/push/:id'))
  assert.ok(!collectionSlugs(config).includes('eventbrite-webhooks'))
  assert.ok(collectionSlugs(config).includes('eventbrite-venues'))
})

test('raw Eventbrite response storage is opt-in', () => {
  const config: any = eventbritePlugin(base)({ collections: [] } as any)
  const events = config.collections.find((collection: any) => collection.slug === 'eventbrite-events')
  const raw = events.fields.find((field: any) => field.name === 'raw')
  assert.equal(raw.admin.condition(), false)
})


test('Eventbrite-owned fields are server-managed through field access', async () => {
  const config: any = eventbritePlugin(base)({ collections: [] } as any)
  const events = config.collections.find((collection: any) => collection.slug === 'eventbrite-events')

  for (const name of [
    'eventbriteId',
    'eventbriteURL',
    'status',
    'syncStatus',
    'lastSyncedAt',
    'lastSyncError',
    'eventbriteChangedAt',
    'eventbritePublishedAt',
  ]) {
    const field = events.fields.find((item: any) => item?.name === name)
    assert.ok(field, `Expected field ${name}`)
    assert.equal(await field.access.create({ req: { user: { id: 'u1' } } }), false)
    assert.equal(await field.access.update({ req: { user: { id: 'u1' } } }), false)
  }

  const ticketGroup = events.fields.find((item: any) => item?.name === 'basicTicket')
  const ticketClassId = ticketGroup.fields.find((item: any) => item?.name === 'ticketClassId')
  assert.equal(await ticketClassId.access.create({ req: { user: { id: 'u1' } } }), false)
  assert.equal(await ticketClassId.access.update({ req: { user: { id: 'u1' } } }), false)
})

test('raw Eventbrite responses are unreadable unless explicitly enabled', async () => {
  const disabled: any = eventbritePlugin(base)({ collections: [] } as any)
  const disabledEvents = disabled.collections.find((collection: any) => collection.slug === 'eventbrite-events')
  const disabledRaw = disabledEvents.fields.find((field: any) => field.name === 'raw')
  assert.equal(await disabledRaw.access.read({ req: { user: { id: 'u1' } } }), false)

  const enabled: any = eventbritePlugin({ ...base, storeRaw: true })({ collections: [] } as any)
  const enabledEvents = enabled.collections.find((collection: any) => collection.slug === 'eventbrite-events')
  const enabledRaw = enabledEvents.fields.find((field: any) => field.name === 'raw')
  assert.equal(await enabledRaw.access.read({ req: { user: { id: 'u1' } } }), true)
  assert.equal(await enabledRaw.access.create({ req: { user: { id: 'u1' } } }), false)
  assert.equal(await enabledRaw.access.update({ req: { user: { id: 'u1' } } }), false)
})


test('events expose a local venue relationship while retaining direct venueId compatibility', () => {
  const config: any = eventbritePlugin(base)({ collections: [] } as any)
  const events = config.collections.find((collection: any) => collection.slug === 'eventbrite-events')
  const venue = events.fields.find((field: any) => field.name === 'venueRecord')
  const venueId = events.fields.find((field: any) => field.name === 'venueId')
  assert.equal(venue.type, 'relationship')
  assert.equal(venue.relationTo, 'eventbrite-venues')
  assert.equal(venueId.type, 'text')
})


test('events expose organizer relationship while retaining direct organizerId compatibility', () => {
  const config: any = eventbritePlugin(base)({ collections: [] } as any)
  const events = config.collections.find((collection: any) => collection.slug === 'eventbrite-events')
  const organizer = events.fields.find((field: any) => field.name === 'organizerRecord')
  const organizerId = events.fields.find((field: any) => field.name === 'organizerId')
  assert.equal(organizer.type, 'relationship')
  assert.equal(organizer.relationTo, 'eventbrite-organizers')
  assert.equal(organizerId.type, 'text')
})

test('organizer remote fields and raw payload are server-managed', async () => {
  const config: any = eventbritePlugin(base)({ collections: [] } as any)
  const organizers = config.collections.find((collection: any) => collection.slug === 'eventbrite-organizers')
  for (const name of ['organizerId', 'eventbriteURL', 'logoURL', 'longDescriptionHTML', 'numPastEvents', 'numFutureEvents', 'syncStatus', 'lastSyncedAt', 'lastSyncError']) {
    const field = organizers.fields.find((item: any) => item?.name === name)
    assert.ok(field, `Expected organizer field ${name}`)
    assert.equal(await field.access.create({ req: { user: { id: 'u1' } } }), false)
    assert.equal(await field.access.update({ req: { user: { id: 'u1' } } }), false)
  }
  const raw = organizers.fields.find((item: any) => item?.name === 'raw')
  assert.equal(await raw.access.read({ req: { user: { id: 'u1' } } }), false)
})


test('public data collections default to public read and authenticated management', async () => {
  const config: any = eventbritePlugin(base)({ collections: [] } as any)

  for (const slug of ['eventbrite-events', 'eventbrite-venues', 'eventbrite-organizers']) {
    const collection = config.collections.find((item: any) => item.slug === slug)
    assert.ok(collection?.access)
    assert.equal(await collection.access.read({ req: { user: undefined } }), true)
    assert.equal(await collection.access.create({ req: { user: undefined } }), false)
    assert.equal(await collection.access.update({ req: { user: undefined } }), false)
    assert.equal(await collection.access.delete({ req: { user: undefined } }), false)
    assert.equal(await collection.access.create({ req: { user: { id: 'u1' } } }), true)
  }
})

test('host applications can override Core collection read and management access', async () => {
  const config: any = eventbritePlugin({
    ...base,
    publicDataReadAccess: ({ req }: any) => Boolean(req.user),
    managementAccess: ({ req }: any) => req.user?.role === 'admin',
  })({ collections: [] } as any)

  const events = config.collections.find((item: any) => item.slug === 'eventbrite-events')
  assert.equal(await events.access.read({ req: { user: undefined } }), false)
  assert.equal(await events.access.read({ req: { user: { id: 'u1', role: 'member' } } }), true)
  assert.equal(await events.access.create({ req: { user: { id: 'u1', role: 'member' } } }), false)
  assert.equal(await events.access.create({ req: { user: { id: 'u2', role: 'admin' } } }), true)
})


test('management endpoints distinguish unauthenticated and unauthorized requests', async () => {
  const config: any = eventbritePlugin({
    ...base,
    managementEndpointAccess: (req: any) => req.user?.role === 'admin',
  })({ collections: [] } as any)
  const sync = config.endpoints.find((endpoint: any) => endpoint.path === '/eventbrite/sync')
  assert.ok(sync?.handler)

  const unauthenticated: Response = await sync.handler({
    user: undefined,
    headers: new Headers(),
  } as any)
  assert.equal(unauthenticated.status, 401)

  const unauthorized: Response = await sync.handler({
    user: { id: 'u1', role: 'member' },
    headers: new Headers(),
  } as any)
  assert.equal(unauthorized.status, 403)

  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => Response.json({ events: [], pagination: {} })) as typeof fetch
  try {
    const authorized: Response = await sync.handler({
      user: { id: 'u2', role: 'admin' },
      headers: new Headers(),
      payload: {},
    } as any)
    assert.equal(authorized.status, 200)
    assert.equal((await authorized.json() as any).imported, 0)
  } finally {
    globalThis.fetch = originalFetch
  }
})
