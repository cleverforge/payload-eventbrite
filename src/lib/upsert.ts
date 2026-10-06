import type { Payload, PayloadRequest } from 'payload'
import type { EventbriteEvent, EventbritePluginOptions } from '../types.js'
import { normalizeEventbriteEvent } from './normalize.js'
import { linkVenueRelationship } from './venues.js'
import { linkOrganizerRelationship } from './organizers.js'

const timestamp = (value: unknown) => {
  const parsed = value ? Date.parse(String(value)) : Number.NaN
  return Number.isFinite(parsed) ? parsed : undefined
}

export function shouldApplyInboundEvent(
  existing: Record<string, any> | undefined,
  remoteChangedAt: string | undefined,
  policy: EventbritePluginOptions['conflictPolicy'] = 'eventbrite-wins',
) {
  if (!existing?.lastSyncedAt) return true

  const lastSyncedAt = timestamp(existing.lastSyncedAt)
  const payloadChangedAt = timestamp(existing.updatedAt)
  const eventbriteChangedAt = timestamp(remoteChangedAt)

  if (!lastSyncedAt || !payloadChangedAt || !eventbriteChangedAt) return true

  const payloadChanged = payloadChangedAt > lastSyncedAt
  const eventbriteChanged = eventbriteChangedAt > lastSyncedAt

  if (!payloadChanged || !eventbriteChanged) return true
  if (policy === 'payload-wins') return false
  if (policy === 'newest-wins') return eventbriteChangedAt >= payloadChangedAt
  return true
}

export async function upsertEvent(payload: Payload, event: EventbriteEvent, options: EventbritePluginOptions, req?: PayloadRequest) {
  const slug = options.eventsSlug || 'eventbrite-events'
  const normalized = normalizeEventbriteEvent(event, options.storeRaw === true)
  const existing = await payload.find({
    collection: slug as any,
    where: { eventbriteId: { equals: normalized.eventbriteId } },
    limit: 1,
    overrideAccess: true,
    req,
  })

  const current = existing.docs[0] as Record<string, any> | undefined
  if (current && !shouldApplyInboundEvent(current, normalized.eventbriteChangedAt, options.conflictPolicy)) {
    return payload.update({
      collection: slug as any,
      id: current.id,
      data: {
        syncStatus: 'conflict',
        lastSyncError: 'Inbound Eventbrite update was not applied because Payload also changed after the last successful sync.',
      } as any,
      overrideAccess: true,
      req,
      context: { eventbriteInbound: true },
    })
  }

  const [venue, organizer] = await Promise.all([
    linkVenueRelationship(payload, normalized.venueId, options, req),
    linkOrganizerRelationship(payload, normalized.organizerId, options, req),
  ])
  const data: any = {
    ...normalized,
    ...(venue ? { venueRecord: venue } : {}),
    ...(organizer ? { organizerRecord: organizer } : {}),
    syncStatus: 'synced',
    lastSyncedAt: new Date().toISOString(),
    lastSyncError: null,
  }

  const doc = current
    ? await payload.update({ collection: slug as any, id: current.id, data, overrideAccess: true, req, context: { eventbriteInbound: true } })
    : await payload.create({ collection: slug as any, data, overrideAccess: true, req, context: { eventbriteInbound: true } })

  await options.onEventSynced?.(normalized, req)
  return doc
}
