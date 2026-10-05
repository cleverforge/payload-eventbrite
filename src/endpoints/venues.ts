import type { Endpoint, PayloadRequest } from 'payload'
import type { EventbritePluginOptions } from '../types.js'
import { getClient, getOrganizationId, json, requireUser } from './helpers.js'
import { normalizeVenue, toVenuePayload, upsertVenue } from '../lib/venues.js'

export const buildVenueSyncEndpoint = (options: EventbritePluginOptions): Endpoint => ({
  path: '/eventbrite/venues/sync',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    try {
      requireUser(req)
      const context = { operation: 'venue-sync' as const }
      const [client, organizationId] = await Promise.all([
        getClient(options, req, context),
        getOrganizationId(options, req, context),
      ])
      let continuation: string | undefined
      let imported = 0
      do {
        const page = await client.listOrganizationVenues(organizationId, continuation)
        for (const venue of page.venues || []) {
          await upsertVenue(req.payload, venue, options, req)
          imported++
        }
        continuation = page.pagination?.continuation || undefined
      } while (continuation)
      return json({ ok: true, organizationId, imported })
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 400)
    }
  },
})

export const buildVenuePushEndpoint = (options: EventbritePluginOptions): Endpoint => ({
  path: '/eventbrite/venues/push/:id',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    try {
      requireUser(req)
      const slug = options.venuesSlug || 'eventbrite-venues'
      const id = req.routeParams?.id as string
      const doc: any = await req.payload.findByID({ collection: slug as any, id, req })
      const context = { operation: 'venue-push' as const, document: doc }
      const [client, organizationId] = await Promise.all([
        getClient(options, req, context),
        getOrganizationId(options, req, context),
      ])
      const remote = doc.venueId
        ? await client.updateVenue(doc.venueId, toVenuePayload(doc))
        : await client.createVenue(organizationId, toVenuePayload(doc))
      const updated = await req.payload.update({
        collection: slug as any,
        id,
        data: {
          ...normalizeVenue(remote, options.storeRaw === true),
          syncStatus: 'synced',
          lastSyncedAt: new Date().toISOString(),
          lastSyncError: null,
        } as any,
        overrideAccess: true,
        req,
      })
      return json({ ok: true, venue: updated })
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 400)
    }
  },
})
