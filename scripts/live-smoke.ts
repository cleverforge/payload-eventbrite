import { EventbriteClient } from '../src/lib/client.js'

const token = process.env.EVENTBRITE_PRIVATE_TOKEN
const organizationId = process.env.EVENTBRITE_ORGANIZATION_ID

if (!token || !organizationId) {
  throw new Error('EVENTBRITE_PRIVATE_TOKEN and EVENTBRITE_ORGANIZATION_ID are required')
}

const client = new EventbriteClient(token, { timeoutMs: 15_000, retries: 2 })

const user = await client.request<any>('/users/me/')
const events = await client.listOrganizationEvents(organizationId)
const webhooks = await client.listWebhooks(organizationId)
const firstEvent = events.events?.[0]
const tickets = firstEvent ? await client.listTicketClasses(firstEvent.id) : { ticket_classes: [] }

console.log(JSON.stringify({
  ok: true,
  userId: user?.id || null,
  organizationId,
  eventCountInFirstPage: events.events?.length || 0,
  webhookCount: webhooks.webhooks?.length || 0,
  sampleEventId: firstEvent?.id || null,
  sampleTicketCount: tickets.ticket_classes?.length || 0,
}, null, 2))
