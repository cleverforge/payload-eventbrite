import type { Endpoint, PayloadRequest } from 'payload'
import type { EventbritePluginOptions, WebhookPayload } from '../types.js'
import { assertEventbriteEventURL } from '../lib/client.js'
import { assertWebhookToken, sanitizeWebhookPayload } from '../lib/webhook.js'
import { getClient, json } from './helpers.js'
import { upsertEvent } from '../lib/upsert.js'

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

    const sanitizedBody = sanitizeWebhookPayload(body)
    const logSlug = options.webhookLogSlug || 'eventbrite-webhooks'
    const log: any = await req.payload.create({
      collection: logSlug as any,
      data: {
        action: body?.config?.action || 'unknown',
        apiURL: body?.api_url,
        eventbriteWebhookId: body?.config?.webhook_id,
        payload: sanitizedBody,
        processed: false,
      },
      overrideAccess: true,
      req,
    })

    try {
      const action = body?.config?.action || ''
      if (body?.api_url && /^event\./.test(action)) {
        assertEventbriteEventURL(body.api_url)
        const client = await getClient(options, req, { operation: 'webhook', webhook: sanitizedBody })
        const event = await client.request<any>(body.api_url)
        await upsertEvent(req.payload, event, options, req)
      }
      await req.payload.update({
        collection: logSlug as any,
        id: log.id,
        data: { processed: true },
        overrideAccess: true,
        req,
      })
      return json({ ok: true })
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
      return json({ ok: false, error: message }, 400)
    }
  },
})
