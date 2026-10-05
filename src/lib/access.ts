import type { Access, Where } from 'payload'
import type { EventbritePluginOptions } from '../types.js'

export const publicRead: Access = () => true
export const authenticated: Access = ({ req }) => Boolean(req.user)

const publicEventWhere: Where = {
  listed: { equals: true },
  status: { in: ['live', 'started', 'ended', 'completed'] },
}

export const publicEventRead: Access = ({ req }) => {
  if (req.user) return true
  return publicEventWhere
}

export function publicDataAccess(options: EventbritePluginOptions) {
  const read = options.publicDataReadAccess || publicRead
  const write = options.managementAccess || authenticated
  return { read, create: write, update: write, delete: write }
}

export function eventDataAccess(options: EventbritePluginOptions) {
  const read = options.publicEventReadAccess || options.publicDataReadAccess || publicEventRead
  const write = options.managementAccess || authenticated
  return { read, create: write, update: write, delete: write }
}
