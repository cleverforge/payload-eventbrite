import type { PayloadRequest } from 'payload'
import type { EventbritePluginOptions, EventbriteResolverContext } from '../types.js'
import { EventbriteClient } from '../lib/client.js'

export async function getAccessToken(
  options: EventbritePluginOptions,
  req?: PayloadRequest,
  context?: EventbriteResolverContext,
) {
  const token = options.accessTokenResolver
    ? await options.accessTokenResolver(req, context)
    : options.accessToken
  if (!token) throw new Error('Configure accessToken or accessTokenResolver for @cleverforge/payload-eventbrite')
  return token
}

export async function getOrganizationId(
  options: EventbritePluginOptions,
  req?: PayloadRequest,
  context?: EventbriteResolverContext,
) {
  const organizationId = options.organizationIdResolver
    ? await options.organizationIdResolver(req, context)
    : options.organizationId
  if (!organizationId) {
    throw new Error('Configure organizationId or organizationIdResolver for @cleverforge/payload-eventbrite')
  }
  return organizationId
}

export async function getClient(
  options: EventbritePluginOptions,
  req?: PayloadRequest,
  context?: EventbriteResolverContext,
) {
  return new EventbriteClient(await getAccessToken(options, req, context), {
    timeoutMs: options.requestTimeoutMs,
    retries: options.requestRetries,
  })
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status })
}

export function requireUser(req: PayloadRequest) {
  if (!req.user) throw new Error('Authentication required')
}
