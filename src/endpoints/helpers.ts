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

export class EventbriteEndpointError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'EventbriteEndpointError'
  }
}

export function requireUser(req: PayloadRequest) {
  if (!req.user) throw new EventbriteEndpointError('Authentication required', 401)
}

export async function requireManagement(options: EventbritePluginOptions, req: PayloadRequest) {
  requireUser(req)
  if (!options.managementEndpointAccess) return
  const allowed = await options.managementEndpointAccess(req)
  if (!allowed) throw new EventbriteEndpointError('Not authorized to manage Eventbrite', 403)
}

export function errorResponse(error: unknown, fallbackStatus = 400) {
  const message = error instanceof Error ? error.message : String(error)
  const status = error instanceof EventbriteEndpointError ? error.status : fallbackStatus
  return json({ ok: false, error: message }, status)
}
