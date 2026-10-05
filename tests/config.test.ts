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
  assert.ok(collectionSlugs(config).includes('eventbrite-webhooks'))
})

test('inbound-only mode does not expose outbound mutation endpoints', () => {
  const config: any = eventbritePlugin({ ...base, syncDirection: 'eventbrite-to-payload' })({ collections: [] } as any)
  const paths = endpointPaths(config)
  assert.ok(paths.includes('/eventbrite/webhook'))
  assert.ok(paths.includes('/eventbrite/sync'))
  assert.ok(paths.includes('/eventbrite/webhooks/:id'))
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
  assert.ok(!collectionSlugs(config).includes('eventbrite-webhooks'))
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
