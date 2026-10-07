import type { Endpoint, PayloadRequest } from 'payload'
import type { EventbritePluginOptions, WebhookPayload } from '../types.js'
import { assertWebhookResourceURL, assertWebhookToken, resolveWebhookAction, sanitizeWebhookPayload } from '../lib/webhook.js'
import { fetchRenderedDescription } from '../lib/description.js'
import { getClient, json } from './helpers.js'
import { upsertEvent } from '../lib/upsert.js'
import { upsertVenue } from '../lib/venues.js'
import { upsertOrganizer } from '../lib/organizers.js'

export const buildWebhookEndpoint = (options: EventbritePluginOptions): Endpoint => ({
  path: '/eventbrite/webhook',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    try {
      assertWebhookToken(req, options.webhookToken)
    } catch {
      return json({ ok: false, error: 'Invalid Eventbrite webhook token' }, 401)
    }

    let body: WebhookPayload
    try {
      const parsed = await req.json?.()
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Webhook payload must be a JSON object')
      }
      body = parsed as WebhookPayload
    } catch {
      return json({ ok: false, error: 'Invalid Eventbrite webhook payload' }, 400)
    }

    let action: string
    let actionInferred = false
    try {
      const resolved = resolveWebhookAction(body)
      action = resolved.action
      actionInferred = resolved.inferred
      if (body.api_url) assertWebhookResourceURL(action, body.api_url)
    } catch {
      return json({ ok: false, error: 'Invalid Eventbrite webhook payload' }, 400)
    }

    const sanitizedBody = sanitizeWebhookPayload(body)
    const logSlug = options.webhookLogSlug || 'eventbrite-webhooks'
    const log: any = await req.payload.create({
      collection: logSlug as any,
      data: {
        action,
        apiURL: body.api_url,
        eventbriteWebhookId: body?.config?.webhook_id,
        payload: sanitizedBody,
        processed: false,
      },
      overrideAccess: true,
      req,
    })

    try {
      let clientPromise: ReturnType<typeof getClient> | undefined
      const getWebhookClient = () => {
        clientPromise ||= getClient(options, req, { operation: 'webhook', webhook: sanitizedBody })
        return clientPromise
      }
      const fetchResource = async <T = unknown>(urlOverride?: string) => {
        const resourceURL = urlOverride || body.api_url
        if (!resourceURL) throw new Error('Eventbrite webhook payload has no api_url')
        assertWebhookResourceURL(action, resourceURL)
        const client = await getWebhookClient()
        return client.request<T>(resourceURL)
      }

      let handledByCore = false
      if (action.startsWith('event.') && body.api_url) {
        const client = await getWebhookClient()
        const event = await fetchResource<any>()
        const renderedDescriptionHTML = await fetchRenderedDescription(
          client,
          event,
          options.renderedDescriptionMode || 'auto',
        )
        await upsertEvent(req.payload, event, options, req, renderedDescriptionHTML)
        handledByCore = true
      } else if (action === 'venue.updated' && body.api_url) {
        await upsertVenue(req.payload, await fetchResource<any>(), options, req)
        handledByCore = true
      } else if (action === 'organizer.updated' && body.api_url) {
        await upsertOrganizer(req.payload, await fetchResource<any>(), options, req)
        handledByCore = true
      }

      await options.onWebhookAction?.({
        action,
        actionInferred,
        webhook: sanitizedBody,
        req,
        handledByCore,
        fetchResource,
      })

      await req.payload.update({
        collection: logSlug as any,
        id: log.id,
        data: { processed: true, error: null },
        overrideAccess: true,
        req,
      })
      return json({ ok: true, handledByCore, actionInferred })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await req.payload.update({
        collection: logSlug as any,
        id: log.id,
        data: { error: message },
        overrideAccess: true,
        req,
      })
      req.payload.logger.error({ err: error }, 'Eventbrite webhook processing failed')
      return json({ ok: false, error: 'Eventbrite webhook processing failed' }, 500)
    }
  },
})
