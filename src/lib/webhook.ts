import { timingSafeEqual } from 'node:crypto'
import type { PayloadRequest } from 'payload'
import type { WebhookPayload } from '../types.js'
import { assertEventbriteURL } from './client.js'

export const WEBHOOK_TOKEN_QUERY_PARAM = 'cf_eventbrite_token'

export const DEFAULT_EVENTBRITE_WEBHOOK_ACTIONS = [
  'event.created',
  'event.updated',
  'event.published',
  'event.unpublished',
  'organizer.updated',
  'venue.updated',
] as const

const WEBHOOK_ACTION_PATTERN = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/

const RESOURCE_PATHS: Array<{ matches: (action: string) => boolean; path: RegExp }> = [
  { matches: action => action.startsWith('event.'), path: /^\/v3\/events\/[^/]+\/?$/ },
  { matches: action => action.startsWith('attendee.'), path: /^\/v3\/events\/[^/]+\/attendees\/[^/]+\/?$/ },
  { matches: action => action.startsWith('order.'), path: /^\/v3\/orders\/[^/]+\/?$/ },
  { matches: action => action.startsWith('ticket_class.'), path: /^\/v3\/events\/[^/]+\/ticket_classes\/[^/]+\/?$/ },
  { matches: action => action === 'organizer.updated', path: /^\/v3\/organizers\/[^/]+\/?$/ },
  { matches: action => action === 'venue.updated', path: /^\/v3\/venues\/[^/]+\/?$/ },
]

export function normalizeWebhookActions(actions?: string[]) {
  const source = actions?.length ? actions : [...DEFAULT_EVENTBRITE_WEBHOOK_ACTIONS]
  if (source.length > 50) throw new Error('A maximum of 50 Eventbrite webhook actions may be registered')
  const normalized = Array.from(new Set(source.map(action => String(action || '').trim()).filter(Boolean)))
  if (!normalized.length) throw new Error('At least one Eventbrite webhook action is required')
  for (const action of normalized) {
    if (!WEBHOOK_ACTION_PATTERN.test(action)) {
      throw new Error(`Invalid Eventbrite webhook action: ${action}`)
    }
  }
  return normalized
}

export function assertWebhookPayload(payload: WebhookPayload) {
  const action = payload?.config?.action
  if (!action || typeof action !== 'string' || !WEBHOOK_ACTION_PATTERN.test(action)) {
    throw new Error('Eventbrite webhook payload requires a valid config.action')
  }
  if (payload.api_url != null && typeof payload.api_url !== 'string') {
    throw new Error('Eventbrite webhook api_url must be a string')
  }
  return action
}

export function assertWebhookResourceURL(action: string, value: string) {
  assertEventbriteURL(value)
  const url = new URL(value)
  const rule = RESOURCE_PATHS.find(item => item.matches(action))
  if (rule && !rule.path.test(url.pathname)) {
    throw new Error(`Eventbrite webhook resource does not match action ${action}`)
  }
  return url
}

export function withWebhookToken(endpointURL: string, token?: string) {
  const url = new URL(endpointURL)
  if (token) url.searchParams.set(WEBHOOK_TOKEN_QUERY_PARAM, token)
  return url.toString()
}

export function assertWebhookToken(req: PayloadRequest, expected?: string) {
  if (!expected) return

  const url = new URL(req.url || 'http://localhost')
  const provided =
    req.headers?.get?.('x-cleverforge-eventbrite-webhook-token') ||
    url.searchParams.get(WEBHOOK_TOKEN_QUERY_PARAM) ||
    ''

  const expectedBuffer = Buffer.from(expected)
  const providedBuffer = Buffer.from(provided)

  if (
    expectedBuffer.length === 0 ||
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw new Error('Invalid Eventbrite webhook token')
  }
}

export function sanitizeWebhookPayload(payload: WebhookPayload): WebhookPayload {
  const endpointURL = payload?.config?.endpoint_url
  if (!endpointURL) return payload

  try {
    const url = new URL(endpointURL)
    url.searchParams.delete(WEBHOOK_TOKEN_QUERY_PARAM)
    return {
      ...payload,
      config: {
        ...payload.config,
        endpoint_url: url.toString(),
      },
    }
  } catch {
    return {
      ...payload,
      config: {
        ...payload.config,
        endpoint_url: undefined,
      },
    }
  }
}
