import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { getPayload } from 'payload'
import { createDevConfig } from '../dev/config.js'
import { EventbriteClient } from '../src/lib/client.js'

const CONFIRMATION = 'CREATE_PUBLISH_UNPUBLISH_DELETE_TEST_EVENT'

const token = process.env.EVENTBRITE_PRIVATE_TOKEN
const organizationId = process.env.EVENTBRITE_ORGANIZATION_ID
const confirmation = process.env.EVENTBRITE_ACCEPTANCE_CONFIRM

if (!token || !organizationId) {
  throw new Error('EVENTBRITE_PRIVATE_TOKEN and EVENTBRITE_ORGANIZATION_ID are required')
}
if (confirmation !== CONFIRMATION) {
  throw new Error('Set EVENTBRITE_ACCEPTANCE_CONFIRM=' + CONFIRMATION + ' to run the destructive acceptance test')
}

const databasePath = resolve(process.cwd(), '.tmp-payload-eventbrite-live-' + process.pid + '.db')
const config = createDevConfig('file:' + databasePath)
const payload = await getPayload({ config, key: 'payload-eventbrite-live-' + process.pid })
const client = new EventbriteClient(token, { timeoutMs: 20_000, retries: 2 })

let remoteEventId: string | undefined
let published = false

async function cleanupDatabase() {
  await rm(databasePath, { force: true }).catch(() => undefined)
  await rm(databasePath + '-shm', { force: true }).catch(() => undefined)
  await rm(databasePath + '-wal', { force: true }).catch(() => undefined)
}

function futureISO(days: number, hour: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  date.setUTCHours(hour, 0, 0, 0)
  return date.toISOString()
}

try {
  const organizerPage = await client.listOrganizationOrganizers(organizationId)
  const organizerId = organizerPage.organizers?.[0]?.id
  if (!organizerId) {
    throw new Error('The Eventbrite organization needs at least one organizer before the live write acceptance test can run')
  }

  const unique = new Date().toISOString().replace(/[:.]/g, '-')
  const title = 'CleverForge Payload Acceptance ' + unique

  const local: any = await payload.create({
    collection: 'eventbrite-events' as any,
    data: {
      title,
      descriptionHTML: '<p>Automated CleverForge Payload Eventbrite acceptance test. Safe to delete.</p>',
      startAt: futureISO(30, 15),
      endAt: futureISO(30, 17),
      timezone: 'UTC',
      onlineEvent: true,
      listed: false,
      organizerId,
      basicTicket: {
        basicTicketName: 'Acceptance Test',
        basicTicketQuantity: 1,
        basicTicketFree: true,
      },
    } as any,
  })

  const endpoints: any[] = payload.config.endpoints || []
  const push = endpoints.find((endpoint: any) => endpoint.path === '/eventbrite/push/:id')
  const publish = endpoints.find((endpoint: any) => endpoint.path === '/eventbrite/publish/:id')
  const unpublish = endpoints.find((endpoint: any) => endpoint.path === '/eventbrite/unpublish/:id')
  const webhook = endpoints.find((endpoint: any) => endpoint.path === '/eventbrite/webhook')

  if (!push?.handler || !publish?.handler || !unpublish?.handler || !webhook?.handler) {
    throw new Error('Expected Core push/publish/unpublish/webhook endpoints are not registered')
  }

  const req: any = {
    payload,
    user: { id: 'live-acceptance-runner' },
    routeParams: { id: local.id },
    headers: new Headers(),
    url: 'http://localhost/api/eventbrite/push/' + local.id,
    context: {},
  }

  const pushResponse: Response = await push.handler(req)
  const pushBody: any = await pushResponse.json()
  if (!pushBody.ok) throw new Error('Push failed: ' + (pushBody.error || pushResponse.status))

  const pushed: any = await payload.findByID({
    collection: 'eventbrite-events' as any,
    id: local.id,
    overrideAccess: true,
  })
  remoteEventId = pushed.eventbriteId
  if (!remoteEventId) throw new Error('Push succeeded without persisting an Eventbrite event ID')
  if (!pushed.basicTicket?.ticketClassId) throw new Error('Push succeeded without persisting the Eventbrite ticket class ID')

  const webhookReq: any = {
    payload,
    headers: new Headers(),
    url: 'https://example.org/api/eventbrite/webhook',
    context: {},
    json: async () => ({
      api_url: 'https://www.eventbriteapi.com/v3/events/' + remoteEventId + '/',
      config: {
        action: 'event.updated',
        webhook_id: 'live-acceptance',
        endpoint_url: 'https://example.org/api/eventbrite/webhook',
      },
    }),
  }
  const webhookResponse: Response = await webhook.handler(webhookReq)
  const webhookBody: any = await webhookResponse.json()
  if (!webhookBody.ok) throw new Error('Webhook refetch failed: ' + (webhookBody.error || webhookResponse.status))

  const webhookLogs: any = await payload.find({
    collection: 'eventbrite-webhooks' as any,
    where: { action: { equals: 'event.updated' } },
    overrideAccess: true,
    limit: 10,
  })
  if (!webhookLogs.docs.some((doc: any) => doc.processed === true && doc.error == null)) {
    throw new Error('Webhook acceptance delivery was not recorded as processed')
  }

  req.url = 'http://localhost/api/eventbrite/publish/' + local.id
  const publishResponse: Response = await publish.handler(req)
  const publishBody: any = await publishResponse.json()
  if (!publishBody.ok) throw new Error('Publish failed: ' + (publishBody.error || publishResponse.status))
  published = true

  req.url = 'http://localhost/api/eventbrite/unpublish/' + local.id
  const unpublishResponse: Response = await unpublish.handler(req)
  const unpublishBody: any = await unpublishResponse.json()
  if (!unpublishBody.ok) throw new Error('Unpublish failed: ' + (unpublishBody.error || unpublishResponse.status))
  published = false

  const deleted = await client.deleteEvent(remoteEventId)
  if (deleted && deleted.deleted === false) throw new Error('Eventbrite reported that the acceptance event was not deleted')
  const deletedEventId = remoteEventId
  remoteEventId = undefined

  console.log(JSON.stringify({
    ok: true,
    organizationId,
    eventId: deletedEventId,
    lifecycle: ['create', 'ticket', 'webhook-refetch', 'publish', 'unpublish', 'delete'],
  }, null, 2))
} finally {
  if (remoteEventId) {
    if (published) {
      await client.unpublishEvent(remoteEventId).catch(() => undefined)
    }
    await client.deleteEvent(remoteEventId).catch(() => undefined)
  }
  await payload.destroy()
  await cleanupDatabase()
}
