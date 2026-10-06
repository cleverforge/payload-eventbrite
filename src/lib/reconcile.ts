import type { Payload, PayloadRequest } from 'payload'
import type { EventbritePluginOptions } from '../types.js'
import { getClient, getOrganizationId } from '../endpoints/helpers.js'
import { upsertEvent } from './upsert.js'
import { fetchRenderedDescription } from './description.js'

export const MIN_RECONCILIATION_INTERVAL_MS = 60_000
export const DEFAULT_RECONCILIATION_INTERVAL_MS = 15 * 60_000

const timers = new WeakMap<object, ReturnType<typeof setInterval>>()

export function resolveReconciliationInterval(options: EventbritePluginOptions) {
  const configured = options.reconciliation?.intervalMs ?? DEFAULT_RECONCILIATION_INTERVAL_MS
  return Math.max(MIN_RECONCILIATION_INTERVAL_MS, configured)
}

export async function syncOrganizationEvents(
  payload: Payload,
  options: EventbritePluginOptions,
  req?: PayloadRequest,
) {
  const context = { operation: 'sync' as const }
  const [client, organizationId] = await Promise.all([
    getClient(options, req, context),
    getOrganizationId(options, req, context),
  ])

  let continuation: string | undefined
  let imported = 0

  do {
    const page = await client.listOrganizationEvents(organizationId, continuation)
    for (const event of page.events || []) {
      const renderedDescriptionHTML = await fetchRenderedDescription(
        client,
        event,
        options.renderedDescriptionMode || 'auto',
      )
      await upsertEvent(payload, event, options, req, renderedDescriptionHTML)
      imported++
    }
    continuation = page.pagination?.continuation || undefined
  } while (continuation)

  return { organizationId, imported }
}

export function startEventbriteReconciliation(payload: Payload, options: EventbritePluginOptions) {
  if (!options.reconciliation?.enabled) return
  if (timers.has(payload as object)) return

  const run = async () => {
    try {
      await syncOrganizationEvents(payload, options)
    } catch (error) {
      payload.logger.error(
        `Eventbrite scheduled reconciliation failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  if (options.reconciliation.runOnStart) void run()

  const timer = setInterval(() => void run(), resolveReconciliationInterval(options))
  timer.unref?.()
  timers.set(payload as object, timer)
}
