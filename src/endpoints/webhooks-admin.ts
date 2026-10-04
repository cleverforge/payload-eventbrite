import type { Endpoint, PayloadRequest } from 'payload'
import type { EventbritePluginOptions } from '../types.js'
import { getClient, json, requireUser } from './helpers.js'

const DEFAULT_EVENT_ACTIONS = ['event.created', 'event.updated', 'event.published', 'event.unpublished']

export const buildWebhooksListEndpoint = (options: EventbritePluginOptions): Endpoint => ({
  path: '/eventbrite/webhooks',
  method: 'get',
  handler: async (req: PayloadRequest) => {
    try {
      requireUser(req)
      const client = await getClient(options, req)
      return json(await client.listWebhooks(options.organizationId))
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 400)
    }
  },
})

export const buildWebhookRegisterEndpoint = (options: EventbritePluginOptions): Endpoint => ({
  path: '/eventbrite/webhooks/register',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    try {
      requireUser(req)
      const body = await req.json?.() as { endpointURL?: string; actions?: string[] }
      if (!body?.endpointURL) throw new Error('endpointURL is required')
      const url = new URL(body.endpointURL)
      if (url.protocol !== 'https:') throw new Error('Eventbrite webhook endpoint must use HTTPS')
      const client = await getClient(options, req)
      const webhook = await client.createWebhook(options.organizationId, body.endpointURL, body.actions?.length ? body.actions : DEFAULT_EVENT_ACTIONS)
      return json({ ok: true, webhook })
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 400)
    }
  },
})
