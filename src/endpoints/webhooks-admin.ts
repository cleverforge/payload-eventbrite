import type { Endpoint, PayloadRequest } from 'payload'
import type { EventbritePluginOptions } from '../types.js'
import { withWebhookToken } from '../lib/webhook.js'
import { getClient, getOrganizationId, json, requireUser } from './helpers.js'

const DEFAULT_EVENT_ACTIONS = ['event.created', 'event.updated', 'event.published', 'event.unpublished']

export const buildWebhooksListEndpoint = (options: EventbritePluginOptions): Endpoint => ({
  path: '/eventbrite/webhooks',
  method: 'get',
  handler: async (req: PayloadRequest) => {
    try {
      requireUser(req)
      const context = { operation: 'webhook-list' as const }
      const [client, organizationId] = await Promise.all([
        getClient(options, req, context),
        getOrganizationId(options, req, context),
      ])
      return json(await client.listWebhooks(organizationId))
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
      const endpointURL = withWebhookToken(url.toString(), options.webhookToken)
      const context = { operation: 'webhook-register' as const }
      const [client, organizationId] = await Promise.all([
        getClient(options, req, context),
        getOrganizationId(options, req, context),
      ])
      const webhook = await client.createWebhook(organizationId, endpointURL, body.actions?.length ? body.actions : DEFAULT_EVENT_ACTIONS)
      return json({ ok: true, webhook })
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 400)
    }
  },
})


export const buildWebhookDeleteEndpoint = (options: EventbritePluginOptions): Endpoint => ({
  path: '/eventbrite/webhooks/:id',
  method: 'delete',
  handler: async (req: PayloadRequest) => {
    try {
      requireUser(req)
      const id = req.routeParams?.id as string
      if (!id) throw new Error('webhook id is required')
      const client = await getClient(options, req, { operation: 'webhook-delete' })
      const result = await client.deleteWebhook(id)
      return json({ ok: true, webhookId: id, result: result ?? null })
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 400)
    }
  },
})
