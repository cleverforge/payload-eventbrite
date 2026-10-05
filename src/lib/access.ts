import type { Access } from 'payload'
import type { EventbritePluginOptions } from '../types.js'

export const publicRead: Access = () => true
export const authenticated: Access = ({ req }) => Boolean(req.user)

export function publicDataAccess(options: EventbritePluginOptions) {
  const read = options.publicDataReadAccess || publicRead
  const write = options.managementAccess || authenticated
  return { read, create: write, update: write, delete: write }
}
