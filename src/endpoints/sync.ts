import type { Endpoint, PayloadRequest } from 'payload'
import type { EventbritePluginOptions } from '../types.js'
import { errorResponse, getClient, getOrganizationId, json, requireManagement } from './helpers.js'
import { fetchRenderedDescription } from '../lib/description.js'
import { upsertEvent } from '../lib/upsert.js'

export const buildSyncEndpoint = (options: EventbritePluginOptions): Endpoint => ({
  path: '/eventbrite/sync',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    try {
      await requireManagement(options, req)
      const context = { operation: 'sync' as const }
      const [client, organizationId] = await Promise.all([
        getClient(options, req, context),
        getOrganizationId(options, req, context),
      ])
      let continuation: string | undefined
      let count = 0
      do {
        const page = await client.listOrganizationEvents(organizationId, continuation)
        for (const event of page.events || []) {
          const renderedDescriptionHTML = await fetchRenderedDescription(
            client,
            event,
            options.renderedDescriptionMode || 'auto',
          )
          await upsertEvent(req.payload, event, options, req, renderedDescriptionHTML)
          count++
        }
        continuation = page.pagination?.continuation || undefined
      } while (continuation)
      return json({ ok: true, organizationId, imported: count })
    } catch (error) {
      return errorResponse(error)
    }
  },
})
