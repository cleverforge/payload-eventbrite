import type { Endpoint, PayloadRequest } from 'payload'
import type { EventbritePluginOptions, WebhookPayload } from '../types.js'
import { getClient, json } from './helpers.js'
import { upsertEvent } from '../lib/upsert.js'

export const buildWebhookEndpoint = (options: EventbritePluginOptions): Endpoint => ({
  path: '/eventbrite/webhook',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    const body = await req.json?.() as WebhookPayload
    const logSlug = options.webhookLogSlug || 'eventbrite-webhooks'
    const log: any = await req.payload.create({
      collection: logSlug as any,
      data: {
        action: body?.config?.action || 'unknown',
        apiURL: body?.api_url,
        eventbriteWebhookId: body?.config?.webhook_id,
        payload: body,
        processed: false,
      },
      overrideAccess: true,
      req,
    })

    try {
      if (body?.api_url && /^event\./.test(body?.config?.action || '')) {
        const client = await getClient(options, req)
        const event = await client.request<any>(body.api_url)
        await upsertEvent(req.payload, event, options, req)
      }
      await req.payload.update({ collection: logSlug as any, id: log.id, data: { processed: true }, overrideAccess: true, req })
      return json({ ok: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await req.payload.update({ collection: logSlug as any, id: log.id, data: { error: message }, overrideAccess: true, req })
      req.payload.logger.error({ err: error }, 'Eventbrite webhook processing failed')
      return json({ ok: false, error: message }, 500)
    }
  },
})
