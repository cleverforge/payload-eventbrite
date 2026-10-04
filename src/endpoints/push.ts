import type { Endpoint, PayloadRequest } from 'payload'
import type { EventbritePluginOptions } from '../types.js'
import { getClient, json, requireUser } from './helpers.js'
import { normalizeEventbriteEvent, toEventbriteCreatePayload, toEventbriteUpdatePayload } from '../lib/normalize.js'

export const buildPushEndpoint = (options: EventbritePluginOptions): Endpoint => ({
  path: '/eventbrite/push/:id',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    try {
      requireUser(req)
      const slug = options.eventsSlug || 'eventbrite-events'
      const id = req.routeParams?.id as string
      const doc: any = await req.payload.findByID({ collection: slug as any, id, overrideAccess: false, req })
      const client = await getClient(options, req)
      const defaults = { currency: options.defaultCurrency || 'USD', timezone: options.defaultTimezone || 'America/New_York' }
      const event = doc.eventbriteId
        ? await client.updateEvent(doc.eventbriteId, toEventbriteUpdatePayload(doc, defaults))
        : await client.createEvent(options.organizationId, toEventbriteCreatePayload(doc, defaults))
      const normalized = normalizeEventbriteEvent(event, options.storeRaw !== false)
      const updated = await req.payload.update({
        collection: slug as any,
        id,
        data: { ...normalized, syncStatus: 'synced', lastSyncedAt: new Date().toISOString(), lastSyncError: null } as any,
        overrideAccess: true,
        req,
        context: { eventbriteInbound: true },
      })
      return json({ ok: true, event: updated })
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 400)
    }
  },
})

export const buildPublishEndpoint = (options: EventbritePluginOptions): Endpoint => ({
  path: '/eventbrite/publish/:id',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    try {
      requireUser(req)
      const slug = options.eventsSlug || 'eventbrite-events'
      const id = req.routeParams?.id as string
      const doc: any = await req.payload.findByID({ collection: slug as any, id, req })
      if (!doc.eventbriteId) throw new Error('Push the event to Eventbrite before publishing it')
      const client = await getClient(options, req)
      const result = await client.publishEvent(doc.eventbriteId)
      return json({ ok: true, result })
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 400)
    }
  },
})

export const buildUnpublishEndpoint = (options: EventbritePluginOptions): Endpoint => ({
  path: '/eventbrite/unpublish/:id',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    try {
      requireUser(req)
      const slug = options.eventsSlug || 'eventbrite-events'
      const id = req.routeParams?.id as string
      const doc: any = await req.payload.findByID({ collection: slug as any, id, req })
      if (!doc.eventbriteId) throw new Error('This event has no Eventbrite ID')
      const client = await getClient(options, req)
      const result = await client.unpublishEvent(doc.eventbriteId)
      return json({ ok: true, result })
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 400)
    }
  },
})
