import type { CollectionConfig } from 'payload'
import type { EventbritePluginOptions } from '../types.js'

export const buildEventsCollection = (options: EventbritePluginOptions): CollectionConfig => ({
  slug: options.eventsSlug || 'eventbrite-events',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'startAt', 'status', 'syncStatus', 'lastSyncedAt'],
    group: 'Eventbrite',
    description: 'Events synchronized between Payload CMS and Eventbrite.',
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'summary', type: 'textarea' },
    { name: 'descriptionHTML', type: 'textarea', admin: { description: 'Eventbrite rendered HTML description, when available.' } },
    { name: 'startAt', type: 'date', required: true },
    { name: 'endAt', type: 'date', required: true },
    { name: 'timezone', type: 'text', defaultValue: options.defaultTimezone || 'America/New_York' },
    { name: 'onlineEvent', type: 'checkbox', defaultValue: false },
    { name: 'listed', type: 'checkbox', defaultValue: true },
    { name: 'capacity', type: 'number', min: 0 },
    { name: 'currency', type: 'text', defaultValue: options.defaultCurrency || 'USD' },
    { name: 'eventbriteId', type: 'text', unique: true, index: true, admin: { position: 'sidebar', readOnly: true } },
    { name: 'eventbriteURL', type: 'text', admin: { position: 'sidebar', readOnly: true } },
    { name: 'status', type: 'text', admin: { position: 'sidebar', readOnly: true } },
    { name: 'venueId', type: 'text', admin: { readOnly: true } },
    { name: 'organizerId', type: 'text', admin: { readOnly: true } },
    { name: 'imageURL', type: 'text', admin: { readOnly: true } },
    { name: 'eventbriteChangedAt', type: 'date', admin: { readOnly: true } },
    { name: 'eventbritePublishedAt', type: 'date', admin: { readOnly: true } },
    {
      name: 'syncStatus', type: 'select', defaultValue: 'local',
      options: [
        { label: 'Local only', value: 'local' },
        { label: 'Synced', value: 'synced' },
        { label: 'Pending', value: 'pending' },
        { label: 'Error', value: 'error' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'lastSyncedAt', type: 'date', admin: { position: 'sidebar', readOnly: true } },
    { name: 'lastSyncError', type: 'textarea', admin: { position: 'sidebar', readOnly: true } },
    { name: 'raw', type: 'json', admin: { readOnly: true, condition: () => options.storeRaw !== false } },
  ],
})
