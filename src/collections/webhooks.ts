import type { CollectionConfig } from 'payload'
import type { EventbritePluginOptions } from '../types.js'

const authenticated = ({ req }: { req: any }) => Boolean(req.user)

export const buildWebhookLogCollection = (options: EventbritePluginOptions): CollectionConfig => ({
  slug: options.webhookLogSlug || 'eventbrite-webhooks',
  admin: { group: 'Eventbrite', useAsTitle: 'action', defaultColumns: ['action', 'eventbriteWebhookId', 'processed', 'createdAt'] },
  access: {
    read: options.managementAccess || authenticated,
    create: () => false,
    update: () => false,
    delete: options.managementAccess || authenticated,
  },
  fields: [
    { name: 'action', type: 'text' },
    { name: 'apiURL', type: 'text' },
    { name: 'eventbriteWebhookId', type: 'text' },
    { name: 'processed', type: 'checkbox', defaultValue: false },
    { name: 'error', type: 'textarea' },
    { name: 'payload', type: 'json' },
  ],
  timestamps: true,
})
