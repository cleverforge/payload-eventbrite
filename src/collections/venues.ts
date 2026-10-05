import type { CollectionConfig } from 'payload'
import type { EventbritePluginOptions } from '../types.js'

const serverManaged = { create: () => false, update: () => false }

export const buildVenuesCollection = (options: EventbritePluginOptions): CollectionConfig => ({
  slug: options.venuesSlug || 'eventbrite-venues',
  admin: {
    group: 'Eventbrite',
    useAsTitle: 'name',
    defaultColumns: ['name', 'city', 'region', 'country', 'capacity', 'syncStatus'],
    description: 'Eventbrite venues synchronized with the configured organization.',
  },
  fields: [
    { name: 'venueId', type: 'text', unique: true, index: true, access: serverManaged, admin: { readOnly: true, position: 'sidebar' } },
    { name: 'name', type: 'text', required: true },
    { name: 'address1', type: 'text', required: true },
    { name: 'address2', type: 'text' },
    { name: 'city', type: 'text' },
    { name: 'region', type: 'text' },
    { name: 'postalCode', type: 'text' },
    { name: 'country', type: 'text', required: true, minLength: 2, maxLength: 2, admin: { description: 'ISO 3166-1 two-letter country code.' } },
    { name: 'capacity', type: 'number', min: 0 },
    { name: 'ageRestriction', type: 'text' },
    { name: 'latitude', type: 'text', access: serverManaged, admin: { readOnly: true } },
    { name: 'longitude', type: 'text', access: serverManaged, admin: { readOnly: true } },
    {
      name: 'syncStatus',
      type: 'select',
      defaultValue: 'local',
      options: ['local', 'synced', 'error'],
      access: serverManaged,
      admin: { readOnly: true, position: 'sidebar' },
    },
    { name: 'lastSyncedAt', type: 'date', access: serverManaged, admin: { readOnly: true, position: 'sidebar' } },
    { name: 'lastSyncError', type: 'textarea', access: serverManaged, admin: { readOnly: true } },
    {
      name: 'raw',
      type: 'json',
      access: {
        read: () => options.storeRaw === true,
        create: () => false,
        update: () => false,
      },
      admin: { readOnly: true, condition: () => options.storeRaw === true },
    },
  ],
})
