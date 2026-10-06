import type { Endpoint, PayloadRequest } from 'payload'
import type { EventbritePluginOptions } from '../types.js'
import { errorResponse, getClient, getOrganizationId, json, requireManagement } from './helpers.js'
import { upsertEvent } from '../lib/upsert.js'

export const buildSyncEndpoint = (options: EventbritePluginOptions): Endpoint => ({
  path: '/eventbrite/sync',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    try {
      await requireManagement(options, req)
      const context = { operation: 'sync' as const }
      const [client, organizationId] = await Promise.all([
        getClient(options, req, context),
        getOrganizationId(options, req, context),
      ])
      let continuation: string | undefined
      let count = 0
      do {
        const page = await client.listOrganizationEvents(organizationId, continuation)
        for (const event of page.events || []) {
          await upsertEvent(req.payload, event, options, req)
          count++
        }
        continuation = page.pagination?.continuation || undefined
      } while (continuation)
      return json({ ok: true, organizationId, imported: count })
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
