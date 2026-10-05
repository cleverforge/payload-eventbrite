import type { Access } from 'payload'
import type { EventbritePluginOptions } from '../types.js'

export const publicRead: Access = () => true
export const authenticated: Access = ({ req }) => Boolean(req.user)

export const publicEventRead: Access = ({ req }) => {
  if (req.user) return true

  return {
    and: [
      { listed: { equals: true } },
      { status: { in: ['live', 'started', 'ended', 'completed'] } },
    ],
  }
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
