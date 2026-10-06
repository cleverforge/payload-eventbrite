import type { Endpoint, PayloadRequest } from 'payload'
import type { EventbritePluginOptions } from '../types.js'
import { errorResponse, getClient, json, requireManagement } from './helpers.js'
import { upsertEvent } from '../lib/upsert.js'
import { syncOrganizationEvents } from '../lib/reconcile.js'

export const buildSyncEndpoint = (options: EventbritePluginOptions): Endpoint => ({
  path: '/eventbrite/sync',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    try {
      await requireManagement(options, req)
      const result = await syncOrganizationEvents(req.payload, options, req)
      return json({ ok: true, ...result })
    } catch (error) {
      return errorResponse(error)
    }
  },
})


export const buildEventSyncEndpoint = (options: EventbritePluginOptions): Endpoint => ({
  path: '/eventbrite/sync/:id',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    try {
      await requireManagement(options, req)
      const slug = options.eventsSlug || 'eventbrite-events'
      const id = req.routeParams?.id as string
      const doc: any = await req.payload.findByID({
        collection: slug as any,
        id,
        overrideAccess: false,
        req,
      })
      if (!doc?.eventbriteId) throw new Error('Push the event to Eventbrite before syncing it')

      const client = await getClient(options, req, { operation: 'sync', document: doc })
      const remote = await client.getEvent(doc.eventbriteId)
      const event = await upsertEvent(req.payload, remote, options, req)
      return json({ ok: true, event })
    } catch (error) {
      return errorResponse(error)
    }
  },
})
