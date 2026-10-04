import type { PayloadRequest } from 'payload'
import type { EventbritePluginOptions } from '../types.js'
import { EventbriteClient } from '../lib/client.js'

export async function getClient(options: EventbritePluginOptions, req?: PayloadRequest) {
  const token = options.accessTokenResolver ? await options.accessTokenResolver(req) : options.accessToken
  if (!token) throw new Error('Configure accessToken or accessTokenResolver for @cleverforge/payload-eventbrite')
  return new EventbriteClient(token)
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status })
}

export function requireUser(req: PayloadRequest) {
  if (!req.user) throw new Error('Authentication required')
}
