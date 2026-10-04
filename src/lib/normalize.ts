import type { EventbriteEvent, NormalizedEventbriteEvent } from '../types.js'

const compact = <T>(value: T | null | undefined): T | undefined => value == null ? undefined : value

export function normalizeEventbriteEvent(event: EventbriteEvent, storeRaw = true): NormalizedEventbriteEvent {
  return {
    eventbriteId: event.id,
    title: event.name?.text || event.name?.html || `Eventbrite ${event.id}`,
    summary: compact(event.summary),
    descriptionHTML: compact(event.description?.html),
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
      start: toEventbriteDate(doc.startAt, timezone),
      end: toEventbriteDate(doc.endAt, timezone),
      currency: doc.currency || defaults.currency,
      online_event: Boolean(doc.onlineEvent),
      listed: doc.listed !== false,
      shareable: true,
      capacity: typeof doc.capacity === 'number' ? doc.capacity : undefined,
    },
  }
}

export function toEventbriteUpdatePayload(doc: Record<string, any>, defaults: { timezone: string }) {
  const timezone = doc.timezone || defaults.timezone
  return {
    event: {
      name: { html: String(doc.title || '') },
      summary: doc.summary || undefined,
      start: doc.startAt ? toEventbriteDate(doc.startAt, timezone) : undefined,
      end: doc.endAt ? toEventbriteDate(doc.endAt, timezone) : undefined,
      online_event: typeof doc.onlineEvent === 'boolean' ? doc.onlineEvent : undefined,
      listed: typeof doc.listed === 'boolean' ? doc.listed : undefined,
      capacity: typeof doc.capacity === 'number' ? doc.capacity : undefined,
    },
  }
}

function toEventbriteDate(value: string, timezone: string) {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid event date: ${value}`)
  return { utc: date.toISOString().replace('.000Z', 'Z'), timezone }
}
