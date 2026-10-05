import { timingSafeEqual } from 'node:crypto'
import type { PayloadRequest } from 'payload'
import type { WebhookPayload } from '../types.js'

export const WEBHOOK_TOKEN_QUERY_PARAM = 'cf_eventbrite_token'

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
