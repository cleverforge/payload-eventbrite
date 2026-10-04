import type { Payload, PayloadRequest } from 'payload'
import type { EventbriteEvent, EventbritePluginOptions } from '../types.js'
import { normalizeEventbriteEvent } from './normalize.js'

export async function upsertEvent(payload: Payload, event: EventbriteEvent, options: EventbritePluginOptions, req?: PayloadRequest) {
  const slug = options.eventsSlug || 'eventbrite-events'
  const normalized = normalizeEventbriteEvent(event, options.storeRaw !== false)
  const existing = await payload.find({
    collection: slug as any,
    where: { eventbriteId: { equals: normalized.eventbriteId } },
    limit: 1,
    overrideAccess: true,
    req,
  })

  const data: any = {
    ...normalized,
    syncStatus: 'synced',
    lastSyncedAt: new Date().toISOString(),
    lastSyncError: null,
  }

  const doc = existing.docs[0]
    ? await payload.update({ collection: slug as any, id: existing.docs[0]!.id, data, overrideAccess: true, req, context: { eventbriteInbound: true } })
    : await payload.create({ collection: slug as any, data, overrideAccess: true, req, context: { eventbriteInbound: true } })

  await options.onEventSynced?.(normalized, req)
  return doc
}
