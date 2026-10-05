import type { CollectionAfterChangeHook, Config, Plugin } from 'payload'
import type { EventbritePluginOptions } from './types.js'
import { buildEventsCollection } from './collections/events.js'
import { buildWebhookLogCollection } from './collections/webhooks.js'
import { buildWebhookEndpoint } from './endpoints/webhook.js'
import { buildSyncEndpoint } from './endpoints/sync.js'
import { buildPushEndpoint, buildPublishEndpoint, buildUnpublishEndpoint } from './endpoints/push.js'
import { buildWebhooksListEndpoint, buildWebhookRegisterEndpoint } from './endpoints/webhooks-admin.js'
import { getClient, getOrganizationId } from './endpoints/helpers.js'
import { normalizeEventbriteEvent, toEventbriteCreatePayload, toEventbriteUpdatePayload } from './lib/normalize.js'
import { syncBasicTicket } from './lib/tickets.js'

export * from './types.js'
export * from './lib/client.js'
export * from './lib/normalize.js'
export * from './lib/oauth.js'
export * from './lib/tickets.js'
export * from './lib/upsert.js'

export const eventbritePlugin = (options: EventbritePluginOptions): Plugin => {
  const opts: EventbritePluginOptions = {
    enabled: true,
    syncDirection: 'two-way',
    eventsSlug: 'eventbrite-events',
    webhookLogSlug: 'eventbrite-webhooks',
    defaultCurrency: 'USD',
    defaultTimezone: 'America/New_York',
    autoPush: false,
    storeRaw: true,
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

    const events = buildEventsCollection(opts)
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

          const remote = doc.eventbriteId
            ? await client.updateEvent(doc.eventbriteId, toEventbriteUpdatePayload(doc, defaults))
            : await client.createEvent(
                await getOrganizationId(opts, req, resolverContext),
                toEventbriteCreatePayload(doc, defaults),
              )

          const normalized = normalizeEventbriteEvent(remote, opts.storeRaw !== false)
          const ticket = await syncBasicTicket(client, remote.id, doc, defaults.currency)
          const basicTicket = ticket?.id
            ? { ...(doc.basicTicket || {}), ticketClassId: ticket.id }
            : doc.basicTicket

          await req.payload.update({
            collection: opts.eventsSlug as any,
            id: doc.id,
            data: {
              ...normalized,
              basicTicket,
              syncStatus: 'synced',
              lastSyncedAt: new Date().toISOString(),
              lastSyncError: null,
            } as any,
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

    return {
      ...incomingConfig,
      collections: [...(incomingConfig.collections || []), events, buildWebhookLogCollection(opts)],
      endpoints: [
        ...(incomingConfig.endpoints || []),
        buildWebhookEndpoint(opts),
        buildSyncEndpoint(opts),
        buildPushEndpoint(opts),
        buildPublishEndpoint(opts),
        buildUnpublishEndpoint(opts),
        buildWebhooksListEndpoint(opts),
        buildWebhookRegisterEndpoint(opts),
      ],
    }
  }
}

export default eventbritePlugin
