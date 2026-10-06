import type { EventbriteEvent, NormalizedEventbriteEvent } from '../types.js'

const compact = <T>(value: T | null | undefined): T | undefined => value == null ? undefined : value

export function normalizeEventbriteEvent(
  event: EventbriteEvent,
  storeRaw = false,
  renderedDescriptionHTML?: string,
): NormalizedEventbriteEvent {
  return {
    eventbriteId: event.id,
    title: event.name?.text || event.name?.html || `Eventbrite ${event.id}`,
    summary: compact(event.summary),
    descriptionHTML: legacyDescriptionHTML(event),
    renderedDescriptionHTML: compact(renderedDescriptionHTML),
    eventbriteURL: compact(event.url),
    startAt: compact(event.start?.utc || event.start?.local),
    endAt: compact(event.end?.utc || event.end?.local),
    timezone: compact(event.start?.timezone || event.end?.timezone),
    status: compact(event.status),
    currency: compact(event.currency),
    onlineEvent: compact(event.online_event),
    listed: compact(event.listed),
    capacity: compact(event.capacity),
    venueId: compact(event.venue_id),
    organizerId: compact(event.organizer_id),
    imageURL: compact(event.logo?.url),
    eventbriteChangedAt: compact(event.changed),
    eventbritePublishedAt: compact(event.published),
    raw: storeRaw ? event : undefined,
  }
}

export function toEventbriteCreatePayload(doc: Record<string, any>, defaults: { currency: string; timezone: string }) {
  const timezone = doc.timezone || defaults.timezone
  return {
    event: {
      name: { html: String(doc.title || '') },
      summary: doc.summary || undefined,
      description: doc.descriptionHTML ? { html: String(doc.descriptionHTML) } : undefined,
      start: toEventbriteDate(doc.startAt, timezone),
      end: toEventbriteDate(doc.endAt, timezone),
      currency: doc.currency || defaults.currency,
      online_event: Boolean(doc.onlineEvent),
      listed: doc.listed !== false,
      shareable: true,
      capacity: typeof doc.capacity === 'number' ? doc.capacity : undefined,
      venue_id: doc.onlineEvent ? undefined : doc.venueId || undefined,
      organizer_id: doc.organizerId || undefined,
    },
  }
}

export function toEventbriteUpdatePayload(doc: Record<string, any>, defaults: { timezone: string }) {
  const timezone = doc.timezone || defaults.timezone
  return {
    event: {
      name: { html: String(doc.title || '') },
      summary: doc.summary || undefined,
      description: doc.descriptionHTML ? { html: String(doc.descriptionHTML) } : undefined,
      start: doc.startAt ? toEventbriteDate(doc.startAt, timezone) : undefined,
      end: doc.endAt ? toEventbriteDate(doc.endAt, timezone) : undefined,
      online_event: typeof doc.onlineEvent === 'boolean' ? doc.onlineEvent : undefined,
      listed: typeof doc.listed === 'boolean' ? doc.listed : undefined,
      capacity: typeof doc.capacity === 'number' ? doc.capacity : undefined,
      venue_id: doc.onlineEvent ? undefined : doc.venueId || undefined,
      organizer_id: doc.organizerId || undefined,
    },
  }
}

export function toBasicTicketClassPayload(doc: Record<string, any>, currency: string) {
  const quantity = Number(doc.basicTicketQuantity || doc.capacity || 1)
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error('Basic ticket quantity must be a positive integer')

  const ticket: Record<string, unknown> = {
    name: String(doc.basicTicketName || 'General Admission'),
    quantity_total: quantity,
  }

  if (doc.basicTicketFree !== false) {
    ticket.free = true
  } else {
    const minor = Number(doc.basicTicketPriceMinor)
    if (!Number.isInteger(minor) || minor < 1) throw new Error('Paid basic tickets require basicTicketPriceMinor in minor currency units')
    ticket.cost = `${doc.currency || currency},${minor}`
  }

  return { ticket_class: ticket }
}

function toEventbriteDate(value: string, timezone: string) {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid event date: ${value}`)
  return { utc: date.toISOString().replace('.000Z', 'Z'), timezone }
}


function legacyDescriptionHTML(event: EventbriteEvent) {
  const summary = event.summary?.trim() || ''
  const text = event.description?.text?.trim() || ''
  if (summary && text === summary) return undefined
  return compact(event.description?.html)
}
