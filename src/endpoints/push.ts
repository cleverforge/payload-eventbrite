import type { Endpoint, PayloadRequest } from 'payload'
import type { EventbritePluginOptions } from '../types.js'
import { errorResponse, getClient, getOrganizationId, json, requireManagement } from './helpers.js'
import { normalizeEventbriteEvent, toEventbriteCreatePayload, toEventbriteUpdatePayload } from '../lib/normalize.js'
import { assertPublishReady, syncBasicTicket } from '../lib/tickets.js'
import { resolveVenueIdForEvent } from '../lib/venues.js'
import { resolveOrganizerIdForEvent } from '../lib/organizers.js'

export const buildPushEndpoint = (options: EventbritePluginOptions): Endpoint => ({
  path: '/eventbrite/push/:id',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    try {
      await requireManagement(options, req)
      const slug = options.eventsSlug || 'eventbrite-events'
      const id = req.routeParams?.id as string
      const doc: any = await req.payload.findByID({ collection: slug as any, id, overrideAccess: false, req })
      const resolverContext = { operation: 'push' as const, document: doc }
      const client = await getClient(options, req, resolverContext)
      const defaults = { currency: options.defaultCurrency || 'USD', timezone: options.defaultTimezone || 'America/New_York' }
      const outboundDoc = {
        ...doc,
        venueId: await resolveVenueIdForEvent(req.payload, doc, options, req),
        organizerId: await resolveOrganizerIdForEvent(req.payload, doc, options, req),
      }
      const event = doc.eventbriteId
        ? await client.updateEvent(doc.eventbriteId, toEventbriteUpdatePayload(outboundDoc, defaults))
        : await client.createEvent(
            await getOrganizationId(options, req, resolverContext),
            toEventbriteCreatePayload(outboundDoc, defaults),
          )

      const normalized = normalizeEventbriteEvent(event, options.storeRaw === true)
      const normalizedData = Object.fromEntries(
        Object.entries(normalized).filter(([, value]) => value !== undefined),
      )
      const ticket = await syncBasicTicket(client, event.id, doc, defaults.currency)
      const basicTicket = ticket?.id
        ? { ...(doc.basicTicket || {}), ticketClassId: ticket.id }
        : doc.basicTicket

      const updated = await req.payload.update({
        collection: slug as any,
        id,
        data: {
          ...normalizedData,
          descriptionHTML: doc.descriptionHTML ?? normalized.descriptionHTML,
          basicTicket,
          syncStatus: 'synced',
          lastSyncedAt: new Date().toISOString(),
          lastSyncError: null,
        } as any,
        overrideAccess: true,
        req,
        context: { eventbriteInbound: true },
      })
      return json({ ok: true, event: updated })
    } catch (error) {
      return errorResponse(error)
    }
  },
})

export const buildPublishEndpoint = (options: EventbritePluginOptions): Endpoint => ({
  path: '/eventbrite/publish/:id',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    try {
      await requireManagement(options, req)
      const slug = options.eventsSlug || 'eventbrite-events'
      const id = req.routeParams?.id as string
      const doc: any = await req.payload.findByID({ collection: slug as any, id, req })
      if (!doc.eventbriteId) throw new Error('Push the event to Eventbrite before publishing it')

      const client = await getClient(options, req, { operation: 'publish', document: doc })
      const [event, ticketPage] = await Promise.all([
        client.getEvent(doc.eventbriteId),
        client.listTicketClasses(doc.eventbriteId),
      ])
      assertPublishReady(event, ticketPage.ticket_classes || [])

      const result = await client.publishEvent(doc.eventbriteId)
      await req.payload.update({
        collection: slug as any,
        id,
        data: { status: 'live', lastSyncedAt: new Date().toISOString(), lastSyncError: null } as any,
        overrideAccess: true,
        req,
        context: { eventbriteInbound: true },
      })
      return json({ ok: true, result })
    } catch (error) {
      return errorResponse(error)
    }
  },
})

export const buildUnpublishEndpoint = (options: EventbritePluginOptions): Endpoint => ({
  path: '/eventbrite/unpublish/:id',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    try {
      await requireManagement(options, req)
      const slug = options.eventsSlug || 'eventbrite-events'
      const id = req.routeParams?.id as string
      const doc: any = await req.payload.findByID({ collection: slug as any, id, req })
      if (!doc.eventbriteId) throw new Error('This event has no Eventbrite ID')
      const client = await getClient(options, req, { operation: 'unpublish', document: doc })
      const result = await client.unpublishEvent(doc.eventbriteId)
      await req.payload.update({
        collection: slug as any,
        id,
        data: { status: 'draft', lastSyncedAt: new Date().toISOString() } as any,
        overrideAccess: true,
        req,
        context: { eventbriteInbound: true },
      })
      return json({ ok: true, result })
    } catch (error) {
      return errorResponse(error)
    }
  },
})
