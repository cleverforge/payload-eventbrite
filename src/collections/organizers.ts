import type { CollectionConfig } from 'payload'
import type { EventbritePluginOptions } from '../types.js'

const serverManaged = { create: () => false, update: () => false }

export const buildOrganizersCollection = (options: EventbritePluginOptions): CollectionConfig => ({
  slug: options.organizersSlug || 'eventbrite-organizers',
  admin: {
    group: 'Eventbrite',
    useAsTitle: 'name',
    defaultColumns: ['name', 'organizerId', 'syncStatus', 'lastSyncedAt'],
    description: 'Eventbrite organizer profiles synchronized with the configured organization.',
  },
  fields: [
    { name: 'organizerId', type: 'text', unique: true, index: true, access: serverManaged, admin: { readOnly: true, position: 'sidebar' } },
    { name: 'name', type: 'text', required: true },
    { name: 'descriptionHTML', type: 'textarea', admin: { description: 'Organizer description sent to Eventbrite when creating the organizer.' } },
    { name: 'longDescriptionHTML', type: 'textarea', access: serverManaged, admin: { readOnly: true } },
    { name: 'eventbriteURL', type: 'text', access: serverManaged, admin: { readOnly: true } },
    { name: 'logoURL', type: 'text', access: serverManaged, admin: { readOnly: true } },
    { name: 'twitter', type: 'text', access: serverManaged, admin: { readOnly: true } },
    { name: 'facebook', type: 'text', access: serverManaged, admin: { readOnly: true } },
    { name: 'numPastEvents', type: 'number', min: 0, access: serverManaged, admin: { readOnly: true } },
    { name: 'numFutureEvents', type: 'number', min: 0, access: serverManaged, admin: { readOnly: true } },
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
