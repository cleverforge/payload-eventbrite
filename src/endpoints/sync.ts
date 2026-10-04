import type { Endpoint, PayloadRequest } from 'payload'
import type { EventbritePluginOptions } from '../types.js'
import { getClient, json, requireUser } from './helpers.js'
import { upsertEvent } from '../lib/upsert.js'

export const buildSyncEndpoint = (options: EventbritePluginOptions): Endpoint => ({
  path: '/eventbrite/sync',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    try {
      requireUser(req)
      const client = await getClient(options, req)
      let continuation: string | undefined
      let count = 0
      do {
        const page = await client.listOrganizationEvents(options.organizationId, continuation)
        for (const event of page.events || []) {
          await upsertEvent(req.payload, event, options, req)
          count++
        }
        continuation = page.pagination?.continuation || undefined
      } while (continuation)
      return json({ ok: true, imported: count })
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 400)
    }
  },
})
