import type { EventbriteClient } from './client.js'
import type { EventbriteEvent, RenderedDescriptionMode } from '../types.js'

export function shouldFetchRenderedDescription(
  event: EventbriteEvent,
  mode: RenderedDescriptionMode = 'auto',
) {
  if (mode === 'never') return false
  if (mode === 'always') return true

  const summary = event.summary?.trim() || ''
  const legacyText = event.description?.text?.trim() || ''
  const legacyHTML = event.description?.html?.trim() || ''

  if (!legacyText && !legacyHTML) return true
  return Boolean(summary && legacyText === summary)
}

export async function fetchRenderedDescription(
  client: EventbriteClient,
  event: EventbriteEvent,
  mode: RenderedDescriptionMode = 'auto',
): Promise<string | undefined> {
  if (!shouldFetchRenderedDescription(event, mode)) return undefined

  try {
    const response = await client.getEventDescription(event.id)
    const html = typeof response?.description === 'string' ? response.description.trim() : ''
    return html || undefined
  } catch {
    // Rendered-description hydration is best effort. A missing permission or
    // transient endpoint error must not block the rest of event synchronization.
    return undefined
  }
}
