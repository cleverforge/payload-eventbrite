import type { CollectionAfterChangeHook, Config, Plugin } from 'payload'
import type { EventbritePluginOptions } from './types.js'
import { augmentEventsCollection, buildEventsCollection } from './collections/events.js'
import { buildVenuesCollection } from './collections/venues.js'
import { buildOrganizersCollection } from './collections/organizers.js'
import { buildWebhookLogCollection } from './collections/webhooks.js'
import { buildWebhookEndpoint } from './endpoints/webhook.js'
import { buildEventSyncEndpoint, buildSyncEndpoint } from './endpoints/sync.js'
import { buildPushEndpoint, buildPublishEndpoint, buildReadinessEndpoint, buildUnpublishEndpoint } from './endpoints/push.js'
import { buildWebhookDeleteEndpoint, buildWebhooksListEndpoint, buildWebhookRegisterEndpoint } from './endpoints/webhooks-admin.js'
import { buildVenuePushEndpoint, buildVenueSyncEndpoint } from './endpoints/venues.js'
import { buildOrganizerPushEndpoint, buildOrganizerSyncEndpoint } from './endpoints/organizers.js'
import { getClient, getOrganizationId } from './endpoints/helpers.js'
import { normalizeEventbriteEvent, toEventbriteCreatePayload, toEventbriteUpdatePayload } from './lib/normalize.js'
import { syncBasicTicket } from './lib/tickets.js'
import { resolveVenueIdForEvent } from './lib/venues.js'
import { resolveOrganizerIdForEvent } from './lib/organizers.js'
import { startEventbriteReconciliation } from './lib/reconcile.js'
import { mapEventDataToPayload, mapNormalizedEventToPayload, toCanonicalEventDocument } from './lib/event-mapping.js'

export * from './types.js'
export * from './lib/client.js'
export * from './lib/normalize.js'
export * from './lib/oauth.js'
export * from './lib/tickets.js'
export * from './lib/upsert.js'
export * from './lib/webhook.js'
export * from './lib/venues.js'
export * from './lib/organizers.js'
export * from './lib/reconcile.js'
export * from './lib/media.js'
export * from './lib/event-mapping.js'

export const eventbritePlugin = (options: EventbritePluginOptions): Plugin => {
  const opts: EventbritePluginOptions = {
    enabled: true,
    syncDirection: 'two-way',
    eventsSlug: 'eventbrite-events',
    webhookLogSlug: 'eventbrite-webhooks',
    venuesSlug: 'eventbrite-venues',
    organizersSlug: 'eventbrite-organizers',
    defaultCurrency: 'USD',
    defaultTimezone: 'America/New_York',
    autoPush: false,
    conflictPolicy: 'eventbrite-wins',
    storeRaw: false,
    requestTimeoutMs: 15_000,
    requestRetries: 2,
    ...options,
  }

  return (incomingConfig: Config): Config => {
    if (!opts.enabled) return incomingConfig
    if (!opts.organizationId && !opts.organizationIdResolver) {
      throw new Error('@cleverforge/payload-eventbrite requires organizationId or organizationIdResolver')
    }
    if (!opts.accessToken && !opts.accessTokenResolver) {
      throw new Error('@cleverforge/payload-eventbrite requires accessToken or accessTokenResolver')
    }

    const incomingCollections = [...(incomingConfig.collections || [])]
    const eventSlug = opts.eventsSlug || 'eventbrite-events'
    const existingEventIndex = incomingCollections.findIndex(collection => collection.slug === eventSlug)

    if (!opts.eventCollection?.useExisting && existingEventIndex >= 0) {
      throw new Error(
        `@cleverforge/payload-eventbrite found an existing collection named "${eventSlug}". Set eventCollection.useExisting to true to augment it instead of registering a duplicate.`,
      )
    }
    if (opts.eventCollection?.useExisting && existingEventIndex < 0) {
      throw new Error(
        `@cleverforge/payload-eventbrite eventCollection.useExisting requires an existing collection named "${eventSlug}".`,
      )
    }

    let events = opts.eventCollection?.useExisting
      ? augmentEventsCollection(incomingCollections[existingEventIndex]!, opts)
      : buildEventsCollection(opts)

    const inboundAllowed = opts.syncDirection === 'eventbrite-to-payload' || opts.syncDirection === 'two-way'
    const outboundAllowed = opts.syncDirection === 'payload-to-eventbrite' || opts.syncDirection === 'two-way'

    if (outboundAllowed && opts.autoPush) {
      const hook: CollectionAfterChangeHook = async ({ doc, req, context }) => {
        if (context?.eventbriteInbound) return doc

        try {
          const resolverContext = { operation: 'auto-push' as const, document: doc }
          const client = await getClient(opts, req, resolverContext)
          const defaults = {
            currency: opts.defaultCurrency || 'USD',
            timezone: opts.defaultTimezone || 'America/New_York',
          }

          const canonicalDoc = toCanonicalEventDocument(doc, opts)
          const outboundDoc = {
            ...canonicalDoc,
            venueId: await resolveVenueIdForEvent(req.payload, canonicalDoc, opts, req),
            organizerId: await resolveOrganizerIdForEvent(req.payload, canonicalDoc, opts, req),
          }
          const remote = canonicalDoc.eventbriteId
            ? await client.updateEvent(canonicalDoc.eventbriteId, toEventbriteUpdatePayload(outboundDoc, defaults))
            : await client.createEvent(
                await getOrganizationId(opts, req, resolverContext),
                toEventbriteCreatePayload(outboundDoc, defaults),
              )

          const normalized = normalizeEventbriteEvent(remote, opts.storeRaw === true)
          const ticket = await syncBasicTicket(client, remote.id, canonicalDoc, defaults.currency)
          const basicTicket = ticket?.id
            ? { ...(canonicalDoc.basicTicket || {}), ticketClassId: ticket.id }
            : canonicalDoc.basicTicket

          await req.payload.update({
            collection: opts.eventsSlug as any,
            id: doc.id,
            data: mapEventDataToPayload({
              ...mapNormalizedEventToPayload(normalized, opts),
              basicTicket,
              syncStatus: 'synced',
              lastSyncedAt: new Date().toISOString(),
              lastSyncError: null,
            }, opts) as any,
            overrideAccess: true,
            req,
            context: { eventbriteInbound: true },
          })
        } catch (error) {
          await req.payload.update({
            collection: opts.eventsSlug as any,
            id: doc.id,
            data: {
              syncStatus: 'error',
              lastSyncError: error instanceof Error ? error.message : String(error),
            } as any,
            overrideAccess: true,
            req,
            context: { eventbriteInbound: true },
          })
        }

        return doc
      }

      events.hooks = {
        ...(events.hooks || {}),
        afterChange: [...(events.hooks?.afterChange || []), hook],
      }
    }

    if (opts.eventCollection?.useExisting) incomingCollections[existingEventIndex] = events

    const onInit = inboundAllowed && opts.reconciliation?.enabled
      ? async (payload: Parameters<NonNullable<Config['onInit']>>[0]) => {
          if (incomingConfig.onInit) await incomingConfig.onInit(payload)
          startEventbriteReconciliation(payload, opts)
        }
      : incomingConfig.onInit

    return {
      ...incomingConfig,
      ...(onInit ? { onInit } : {}),
      collections: [
        ...incomingCollections,
        ...(!opts.eventCollection?.useExisting ? [events] : []),
        buildVenuesCollection(opts),
        buildOrganizersCollection(opts),
        ...(inboundAllowed ? [buildWebhookLogCollection(opts)] : []),
      ],
      endpoints: [
        ...(incomingConfig.endpoints || []),
        ...(inboundAllowed ? [
          buildWebhookEndpoint(opts),
          buildSyncEndpoint(opts),
          buildEventSyncEndpoint(opts),
          buildWebhooksListEndpoint(opts),
          buildWebhookRegisterEndpoint(opts),
          buildWebhookDeleteEndpoint(opts),
          buildVenueSyncEndpoint(opts),
          buildOrganizerSyncEndpoint(opts),
        ] : []),
        ...(outboundAllowed ? [
          buildPushEndpoint(opts),
          buildPublishEndpoint(opts),
          buildUnpublishEndpoint(opts),
          buildReadinessEndpoint(opts),
          buildVenuePushEndpoint(opts),
          buildOrganizerPushEndpoint(opts),
        ] : []),
      ],
    }
  }
}

export default eventbritePlugin
