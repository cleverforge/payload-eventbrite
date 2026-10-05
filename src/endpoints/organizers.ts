import type { Endpoint, PayloadRequest } from 'payload'
import type { EventbritePluginOptions } from '../types.js'
import { getClient, getOrganizationId, json, requireUser } from './helpers.js'
import { normalizeOrganizer, toOrganizerCreatePayload, upsertOrganizer } from '../lib/organizers.js'

export const buildOrganizerSyncEndpoint = (options: EventbritePluginOptions): Endpoint => ({
  path: '/eventbrite/organizers/sync',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    try {
      requireUser(req)
      const context = { operation: 'organizer-sync' as const }
      const [client, organizationId] = await Promise.all([
        getClient(options, req, context),
        getOrganizationId(options, req, context),
      ])

      let continuation: string | undefined
      let imported = 0
      do {
        const page = await client.listOrganizationOrganizers(organizationId, continuation)
        for (const organizer of page.organizers || []) {
          await upsertOrganizer(req.payload, organizer, options, req)
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

export const buildOrganizerPushEndpoint = (options: EventbritePluginOptions): Endpoint => ({
  path: '/eventbrite/organizers/push/:id',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    try {
      requireUser(req)
      const slug = options.organizersSlug || 'eventbrite-organizers'
      const id = req.routeParams?.id as string
      const doc: any = await req.payload.findByID({ collection: slug as any, id, req })
      if (doc.organizerId) {
        throw new Error('Linked Eventbrite organizers are read-only in Core. Edit the organizer in Eventbrite and run organizer sync.')
      }

      const context = { operation: 'organizer-push' as const, document: doc }
      const [client, organizationId] = await Promise.all([
        getClient(options, req, context),
        getOrganizationId(options, req, context),
      ])

      const remote = await client.createOrganizer(organizationId, toOrganizerCreatePayload(doc))
      const updated = await req.payload.update({
        collection: slug as any,
        id,
        data: {
          ...normalizeOrganizer(remote, options.storeRaw === true),
          syncStatus: 'synced',
          lastSyncedAt: new Date().toISOString(),
          lastSyncError: null,
        } as any,
        overrideAccess: true,
        req,
      })

      return json({ ok: true, organizer: updated })
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 400)
    }
  },
})
