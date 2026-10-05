import type { EventbriteClient } from './client.js'
import { toBasicTicketClassPayload } from './normalize.js'

export async function syncBasicTicket(
  client: EventbriteClient,
  eventId: string,
  doc: Record<string, any>,
  defaultCurrency: string,
) {
  const basic = doc.basicTicket
  if (!basic?.basicTicketName) return undefined

  const ticketDoc = {
    ...doc,
    ...basic,
  }
  const payload = toBasicTicketClassPayload(ticketDoc, defaultCurrency)

  if (basic.ticketClassId) {
    return client.updateTicketClass(eventId, basic.ticketClassId, payload)
  }

  return client.createTicketClass(eventId, payload)
}

export function assertPublishReady(event: Record<string, any>, ticketClasses: unknown[]) {
  const missing: string[] = []
  if (!event?.description?.html && !event?.description?.text) missing.push('description')
  if (!event?.organizer_id && !event?.organizer?.id) missing.push('organizer')
  if (!Array.isArray(ticketClasses) || ticketClasses.length === 0) missing.push('ticket class')

  if (missing.length) {
    throw new Error(`Eventbrite event is not publish-ready. Missing: ${missing.join(', ')}`)
  }
}
